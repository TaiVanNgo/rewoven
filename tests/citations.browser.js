// Run with Playwright CLI's `run-code --filename tests/citations.browser.js`.
// Requires the app, local Supabase, and the seeded fictional case catalog.
// biome-ignore lint/correctness/noUnusedVariables: Playwright CLI evaluates and invokes this named function.
async function verifyCitationViewer(page) {
  const base = new URL(page.url()).origin;
  await page.goto(`${base}/case-library`);
  await page
    .getByRole("link", {
      name: /Fictional sample Ready Harbor Route Planning Pilot/,
    })
    .click();
  const marker = page.getByRole("link", { name: /^Source 1:/ }).first();
  await marker.waitFor();
  const caseId = new URL(page.url()).pathname.split("/").at(-1);
  const { case: record } = await (
    await page.request.get(`${base}/api/cases/${caseId}`)
  ).json();
  const finding = record.overview.sections.summary[0].evidence[0];
  const source = record.sources.find((item) => item.id === finding.sourceId);
  const location = new URLSearchParams({
    version: String(source.version),
    page: String(finding.page),
    quote: finding.quote,
  });
  const preview = await (
    await page.request.get(
      `${base}/api/sources/${source.id}/preview?${location}`,
    )
  ).json();
  if (!preview.highlight)
    throw new Error("The prepared sample quote could not be located.");
  const evidence = {
    id: "e1",
    chunk_id: "citation-regression",
    case_id: record.id,
    title: record.title,
    source_id: source.id,
    source_title: source.title,
    version: source.version,
    page_number: finding.page,
    char_start: preview.start + preview.highlight.start,
    char_end: preview.start + preview.highlight.end,
    text: preview.text.slice(preview.highlight.start, preview.highlight.end),
    outcome: record.outcome,
    score: 1,
  };
  const queryId = "11111111-1111-4111-8111-111111111111";
  const chatContext = { mode: "selected", caseIds: [record.id] };
  // A saved chat exercises the actual Wren citation path without a paid model call.
  const query = {
    id: queryId,
    title: "Citation stability regression",
    updated_at: new Date().toISOString(),
    assistant: true,
    chat_context: chatContext,
    context_revision: 0,
    selected_cases: [{ id: record.id, title: record.title, is_seed: true }],
    request: {
      request: "What happened in this pilot?",
      deadline: "",
      technology: "",
      capabilities: "",
    },
    focused_case_id: record.id,
    turns: [
      {
        id: "regression-turn",
        ordinal: 1,
        message: "What happened in this pilot?",
        scope: "case",
        focused_case_id: record.id,
        status: "ready",
        error_message: null,
        started_at: new Date().toISOString(),
        context_snapshot: chatContext,
        work: {
          searchQuery: "pilot",
          focusTitle: record.title,
          evidence: [evidence],
          retrieval: {
            cases: [
              {
                id: record.id,
                title: record.title,
                outcome: record.outcome,
                passages: [evidence],
              },
            ],
            mode: "keyword",
            warnings: [],
          },
          focus: { scope: "case", caseId: record.id },
          clarification: "",
          candidates: [],
        },
        answer: {
          sections: [
            {
              kind: "fact",
              heading: "",
              text: "The pilot measured route preparation in two depots.",
              evidence: ["e1"],
            },
          ],
        },
      },
    ],
  };
  const chatPattern = `**/api/queries/${queryId}`;
  await page.route(chatPattern, (route) => route.fulfill({ json: { query } }));
  await page.goto(`${base}/?query=${queryId}`);
  const chatCitation = page.getByRole("link", { name: /^Source 1:/ }).first();
  await chatCitation.waitFor();

  // macOS often uses overlay scrollbars, masking this bug. Emulate the gutter
  // that a classic scrollbar adds when the rendered page replaces the loader.
  // Both the PDF viewport and the surrounding dialog can become scrollable.
  const scrollbarStyle = `
      [aria-busy="false"]:has(> canvas) { scrollbar-gutter: stable; }
      [role="dialog"]:has(canvas:not(.hidden)) { scrollbar-gutter: stable; }
    `;
  await page.addInitScript((css) => {
    window.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    });
  }, scrollbarStyle);
  await page.addStyleTag({
    content: scrollbarStyle,
  });

  async function staysRendered(label, number) {
    const canvas = page.getByRole("img", {
      name: `Original PDF, physical page ${number}`,
      exact: true,
    });
    await canvas.waitFor({ state: "visible", timeout: 15000 });
    const state = await canvas.evaluate(async (element) => {
      let loadingTransitions = 0;
      const widths = new Set();
      const observer = new MutationObserver(() => {
        if (element.classList.contains("hidden")) loadingTransitions++;
        widths.add(element.parentElement.clientWidth);
      });
      observer.observe(element, {
        attributes: true,
        attributeFilter: ["class"],
      });
      // A rendered page must stay rendered, rather than only appearing for a frame.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      observer.disconnect();
      return {
        loadingTransitions,
        widths: [...widths],
        visible: element.isConnected && !element.classList.contains("hidden"),
      };
    });
    if (!state.visible || state.loadingTransitions > 2)
      throw new Error(
        `${label}: PDF keeps reloading: ${JSON.stringify(state)}`,
      );
  }

  await chatCitation.click();
  await staysRendered("Open Wren citation", 9);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Next page", exact: true }).click();
  await staysRendered("Change page", 10);
  await dialog.getByRole("button", { name: "Zoom in", exact: true }).click();
  await staysRendered("Zoom", 10);
  await dialog
    .getByRole("button", { name: "Fit to width", exact: true })
    .click();
  await staysRendered("Fit to width", 10);

  await page.setViewportSize({ width: 390, height: 844 });
  await staysRendered("Mobile resize", 10);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.reload();
  await chatCitation.click();
  await staysRendered("Reload and reopen Wren citation", 9);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });

  await page.goto(`${base}/case-library/${caseId}`);
  await marker.click();
  await page.waitForURL((url) => url.searchParams.has("finding"));
  await page.reload();
  await staysRendered("Reload case with citation open", 9);

  await page.getByRole("tab", { name: "Extracted text", exact: true }).click();
  await page.getByRole("dialog").locator("mark").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.unroute(chatPattern);
}
