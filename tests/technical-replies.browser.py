"""Local browser regression. Run after test:wren:live; no model calls here."""
import copy
import json
import os
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:3001")
OUT = Path("output/playwright")
OUT.mkdir(parents=True, exist_ok=True)
report = json.loads((OUT / "wren-engineering-live.json").read_text())
query = copy.deepcopy(report["results"][0]["query"])
turn = query["turns"][0]
sections = turn["answer"]["sections"]
sections[:] = [sections[0]] + [section for section in sections[1:] if "```" in section["text"]]
reference = sections[0]["evidence"][:1]
for section in sections:
    if "```mermaid" in section["text"]:
        section["text"] = section["text"].replace("\n```", "\nstyle A fill:red\n```", 1)
for label, source in [
    ("Sequence preview", "sequenceDiagram\nBrowser->>API: Submit\nAPI-->>Browser: Existing claim"),
    ("State preview", "stateDiagram-v2\n[*] --> Draft\nDraft --> Review: submit"),
    ("Entity preview", "erDiagram\nREQUEST ||--o{ EVENT : records\nREQUEST {\n uuid id\n}"),
    ("Malformed preview", "flowchart LR\nA[broken"),
    ("Blocked preview", "flowchart LR\nA --> B\nclick A callback"),
]:
    sections.append({"kind": "inference", "heading": label,
                     "text": f"Browser test fixture, not generated historical evidence.\n\n```mermaid\n{source}\n```",
                     "evidence": reference})
# Exercise escaped code and very wide content in a real chat bubble.
sections[-1]["text"] += '\n\n```typescript\nconst example = "<script>window.technicalXss = true</script>";\n' + 'const longLine = "' + ('wide' * 70) + '";\n```'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel=os.environ.get("PLAYWRIGHT_CHANNEL", "chrome"))
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, permissions=["clipboard-read", "clipboard-write"], reduced_motion="reduce")
    context.add_init_script("localStorage.setItem('rewoven-onboarding-v1','dismissed'); localStorage.setItem('rewoven-theme','light');")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route(f"**/api/queries/{query['id']}", lambda route: route.fulfill(json={"query": query}))
    page.route("**/api/plans?conversationId=*", lambda route: route.fulfill(json={"plans": []}))
    page.goto(f"{BASE}/?query={query['id']}")
    page.wait_for_load_state("networkidle")
    page.locator(".query-diagram-image img").nth(3).wait_for(timeout=60000)
    assert page.locator(".query-diagram-image img").count() == 4
    assert page.get_by_text("Diagram preview unavailable. The source is shown below.", exact=True).count() == 2
    assert page.locator(".query-diagram-image img").evaluate_all("imgs => imgs.every(i => i.complete && i.naturalWidth > 0)")
    assert page.locator(".query-diagram-image img").first.evaluate("img => !decodeURIComponent(img.src).includes('fill:red')")
    assert page.evaluate("window.technicalXss !== true")
    assert page.locator(".query-wren-message script").count() == 0
    block = page.locator(".query-code-block").filter(has=page.get_by_role("button", name="Copy code", exact=True)).first
    expected_code = block.locator("pre code").inner_text()
    block.get_by_role("button", name="Copy code", exact=True).click()
    page.wait_for_function("expected => navigator.clipboard.readText().then(text => text === expected)", arg=expected_code)
    page.get_by_role("button", name="Copy diagram source", exact=True).first.click()
    assert "flowchart" in page.evaluate("navigator.clipboard.readText()")
    image = page.locator(".query-diagram-image img").first
    image.scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / "technical-replies-light.png"))
    citation = page.get_by_role("link", name=re.compile(r"^Source 1:")).first
    citation.click()
    page.get_by_role("dialog").wait_for()
    page.get_by_role("button", name=re.compile("Close")).last.click()
    page.get_by_role("button", name="Change theme").click()
    old_src = image.get_attribute("src")
    page.get_by_role("menuitemradio", name="Dark", exact=True).click()
    page.wait_for_function("document.documentElement.classList.contains('dark')")
    page.wait_for_function("() => [...document.querySelectorAll('.query-diagram-image img')].length === 4")
    page.wait_for_function("old => document.querySelector('.query-diagram-image img')?.getAttribute('src') !== old", arg=old_src)
    image.scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / "technical-replies-dark.png"))
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_load_state("networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile document overflow"
    diagram_region = page.get_by_role("region", name="Architecture diagram", exact=True).first
    assert diagram_region.evaluate("el => el.scrollWidth > el.clientWidth"), "Wide diagrams should scroll rather than shrink labels"
    diagram_region.focus()
    diagram_region.press("ArrowRight")
    page.wait_for_function("document.querySelector('.query-diagram-image').scrollLeft > 0")
    image.scroll_into_view_if_needed()
    page.screenshot(path=str(OUT / "technical-replies-mobile.png"))
    source = page.locator(".query-diagram details").first
    source.locator("summary").click()
    source.get_by_role("region", name="Diagram source").focus()
    assert source.get_by_role("region", name="Diagram source").evaluate("el => el === document.activeElement")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.locator(".query-diagram-image img").nth(3).wait_for(timeout=30000)
    assert not errors, errors
    print("PASS: code/diagram copying, four static types, malformed/hostile fallback, inert code, citation, reload, desktop/mobile and themes")
    browser.close()
