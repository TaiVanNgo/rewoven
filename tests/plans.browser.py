"""Optional local browser regression; provider stages are mocked."""
import json, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
fixture = json.loads(Path(os.environ.get('PLAN_BROWSER_FIXTURE', '/tmp/rewoven-plan-browser-fixture.json')).read_text())
base = os.environ.get('TEST_BASE_URL', 'http://localhost:3000')
out = Path('/tmp/rewoven-plans-browser')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    ctx.add_cookies([{'name': 'rewoven-session', 'value': fixture['token'], 'url': base}])
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/?query=' + fixture['queryId'])
    page.wait_for_load_state('networkidle')

    def prepare(route):
        response = page.request.get(base + '/api/plans/' + fixture['reviewId'])
        route.fulfill(status=201, content_type='application/json', body=response.text())
    page.route('**/api/queries/' + fixture['queryId'] + '/plans', prepare)
    page.get_by_role('button', name='Draft reuse plan', exact=True).click()
    page.wait_for_url('**/saved-plans/' + fixture['reviewId'])
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('textbox', name='Requirements', exact=True)).to_have_value('Build a concurrent registration workflow with audit history.')

    def generate(route):
        subprocess.run(['bun', '--env-file=.env.local', 'tests/plans.browser-fixture.ts', '--generate'], check=True)
        response = page.request.get(base + '/api/plans/' + fixture['reviewId'])
        route.fulfill(status=200, content_type='application/json', body=response.text())
    page.route('**/api/plans/' + fixture['reviewId'] + '/generate', generate)
    page.get_by_role('button', name='Confirm request and generate plan').click()
    visual = page.get_by_role('textbox', name='Plan content', exact=True)
    expect(visual).to_be_visible()
    expect(page.get_by_role('button', name='Export Markdown', exact=True)).to_be_disabled()
    original = page.request.get(base + '/api/plans/' + fixture['reviewId']).json()['plan']['generated_markdown']
    page.get_by_role('tab', name='Markdown', exact=True).click()
    editor = page.get_by_label('Edit Markdown', exact=True)
    expect(editor).to_have_value(original)
    page.get_by_role('tab', name='Visual', exact=True).click()
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('button', name='Save', exact=True)).to_be_disabled()
    page.reload()
    expect(visual).to_be_visible()
    visual.focus()
    page.get_by_role('tab', name='Markdown', exact=True).click()
    expect(editor).to_have_value(original)
    page.get_by_role('tab', name='Visual', exact=True).click()
    expect(page.get_by_role('button', name='Save', exact=True)).to_be_disabled()

    # A code-block conversion must not silently delete inline evidence nodes.
    visual.get_by_text('Evaluate transaction-enforced seat reservations.', exact=False).click()
    expect(page.get_by_role('button', name='Code block', exact=True)).to_be_disabled()
    page.keyboard.press('ControlOrMeta+Alt+c')
    expect(visual.locator('.plan-citation')).to_have_count(3)
    expect(page.get_by_role('button', name='Save', exact=True)).to_be_disabled()

    phrase = 'Toolbar review action'
    def source(markdown):
        page.get_by_role('tab', name='Markdown', exact=True).click()
        editor.fill(markdown)
        page.get_by_role('tab', name='Visual', exact=True).click()
        expect(visual).to_be_visible()

    def select_phrase():
        visual.evaluate("""(root, phrase) => {
            root.focus();
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const start = node.textContent.indexOf(phrase);
                if (start < 0) continue;
                const range = document.createRange();
                range.setStart(node, start);
                range.setEnd(node, start + phrase.length);
                const selection = window.getSelection();
                selection.removeAllRanges(); selection.addRange(range);
                document.dispatchEvent(new Event('selectionchange'));
                return;
            }
            throw new Error('Missing selection text');
        }""", phrase)
        expect(page.get_by_role('button', name='Edit link', exact=True)).to_be_enabled()

    source(original + '\n\n' + phrase)
    select_phrase()
    page.get_by_role('button', name='Bold', exact=True).click()
    expect(visual.locator('strong').get_by_text(phrase, exact=True)).to_be_visible()
    page.get_by_role('button', name='Undo', exact=True).click()
    expect(visual.locator('strong').get_by_text(phrase, exact=True)).to_have_count(0)
    page.get_by_role('button', name='Redo', exact=True).click()
    expect(visual.locator('strong').get_by_text(phrase, exact=True)).to_be_visible()

    for action, selector in [('Italic', 'em'), ('Strikethrough', 's'), ('Inline code', 'code'),
                             ('Heading 1', 'h1'), ('Heading 2', 'h2'), ('Heading 3', 'h3'),
                             ('Bullet list', 'ul'), ('Numbered list', 'ol'),
                             ('Blockquote', 'blockquote'), ('Code block', 'pre')]:
        source(original + '\n\n' + phrase)
        select_phrase()
        page.get_by_role('button', name=action, exact=True).click()
        expect(visual.locator(selector).get_by_text(phrase, exact=True)).to_be_visible()
        expect(visual.locator('.plan-citation')).to_have_count(3)
    source(original + '\n\n' + phrase)
    select_phrase()
    page.get_by_role('button', name='Heading 1', exact=True).click()
    page.get_by_role('button', name='Paragraph', exact=True).click()
    expect(visual.locator('p').get_by_text(phrase, exact=True)).to_be_visible()
    page.get_by_role('button', name='Horizontal rule', exact=True).click()
    expect(visual.locator('hr')).to_have_count(1)

    source(original + '\n\n' + phrase)
    select_phrase()
    page.get_by_role('button', name='Edit link', exact=True).click()
    page.get_by_label('Link URL', exact=True).fill('javascript:alert(1)')
    page.get_by_role('button', name='Apply link', exact=True).click()
    expect(page.get_by_text('Use an http://', exact=False)).to_be_visible()
    page.get_by_label('Link URL', exact=True).fill('https://example.com/review')
    page.get_by_role('button', name='Apply link', exact=True).click()
    expect(visual.locator('a[href="https://example.com/review"]')).to_have_text(phrase)
    select_phrase()
    page.get_by_role('button', name='Edit link', exact=True).click()
    page.get_by_role('button', name='Remove link', exact=True).click()
    expect(visual.locator('a')).to_have_count(0)

    # Typed citations become stable chips; unsupported pasted content stays literal.
    visual.focus()
    page.keyboard.press('ControlOrMeta+End')
    page.keyboard.press('Enter')
    page.keyboard.type('[S1]')
    expect(visual.locator('.plan-citation')).to_have_count(4)
    page.keyboard.press('Enter')
    visual.evaluate('''(root) => {
        const data = new DataTransfer();
        data.setData('text/plain', '<script>window.planPasteUnsafe=true</script>');
        data.setData('text/html', '<img src=x onerror="window.planPasteUnsafe=true">');
        root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }''')
    expect(visual.locator('pre')).to_contain_text('<script>window.planPasteUnsafe=true</script>')
    assert not page.evaluate('Boolean(window.planPasteUnsafe)')
    expect(visual.locator('script, img:not(.ProseMirror-separator)')).to_have_count(0)
    source(original + '\n\n' + phrase)
    select_phrase()

    # Check toolbar edits survive the real save/read/export flow.
    select_phrase()
    page.get_by_role('button', name='Bold', exact=True).focus()
    page.keyboard.press('Enter')
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('button', name='Save', exact=True)).to_be_disabled()
    page.reload()
    expect(visual.locator('strong').get_by_text(phrase, exact=True)).to_be_visible()
    assert '[S1]' in page.request.get(base + '/api/plans/' + fixture['reviewId']).json()['plan']['saved_markdown']
    with page.expect_download() as visual_download:
        page.get_by_role('button', name='Export Markdown', exact=True).click()
    assert '**' + phrase + '**' in Path(visual_download.value.path()).read_text()
    page.screenshot(path=str(out / 'visual-desktop.png'), full_page=True)

    # Unsupported source must remain exact, including after reload.
    page.get_by_role('tab', name='Markdown', exact=True).click()
    table = original + '\n\n| Name | Value |\n| --- | --- |\n| A | B |'
    editor.fill(table)
    expect(page.get_by_role('tab', name='Visual', exact=True)).to_be_disabled()
    expect(editor).to_have_value(table)
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('button', name='Save', exact=True)).to_be_disabled()
    page.reload()
    expect(editor).to_have_value(table)
    expect(page.get_by_role('tab', name='Visual', exact=True)).to_be_disabled()
    editor.fill(original)
    expect(page.get_by_role('tab', name='Markdown', exact=True)).to_have_attribute('aria-selected', 'true')
    source(original + '\n\n' + 'x' * (50000 - len(original) - 2))
    visual.focus()
    page.keyboard.press('ControlOrMeta+End')
    page.keyboard.insert_text('more text' * 20)
    expect(page.get_by_role('button', name='Save', exact=True)).to_be_disabled()
    expect(page.get_by_role('alert').filter(has_text='1–50,000')).to_be_visible()
    page.get_by_role('tab', name='Markdown', exact=True).click()
    editor.fill(original + '\n\nBrowser-reviewed next step.\n\n<script>window.planUnsafe=true</script>\n\n[unsafe](javascript:alert(1))')
    expect(page.get_by_label('Plan preview').get_by_text('Browser-reviewed next step.')).to_be_visible()
    assert not page.evaluate('Boolean(window.planUnsafe)')
    assert page.get_by_label('Plan preview').locator('a[href^="javascript:"]').count() == 0
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('button', name='Export Markdown', exact=True)).to_be_enabled()
    page.reload()
    page.wait_for_load_state('networkidle')
    expect(editor).to_contain_text('Browser-reviewed next step.')
    page.get_by_role('link', name='Source 1:', exact=False).first.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    expect(page.get_by_role('dialog').get_by_text('pilot-journal.md', exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    with page.expect_download() as download:
        page.get_by_role('button', name='Export Markdown', exact=True).click()
    path = download.value.path()
    exported = Path(path).read_text()
    assert 'Browser-reviewed next step.' in exported and 'transaction-enforced seat leases' in exported
    page.screenshot(path=str(out / 'desktop.png'), full_page=True)
    saved = editor.input_value()
    editor.fill(saved + '\n\nRecovered draft text.')
    page.once('dialog', lambda dialog: dialog.accept())
    page.reload()
    page.wait_for_load_state('networkidle')
    expect(editor).to_contain_text('Recovered draft text.')
    expect(page.get_by_text('Recovered unsaved edits from this tab.', exact=False)).to_be_visible()
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('button', name='Export Markdown', exact=True)).to_be_enabled()
    other = ctx.new_page()
    other.goto(page.url)
    other.wait_for_load_state('networkidle')
    other.get_by_label('Edit Markdown', exact=True).fill(saved + '\n\nSaved from another tab.')
    other.get_by_role('button', name='Save', exact=True).click()
    expect(other.get_by_role('button', name='Export Markdown', exact=True)).to_be_enabled()
    editor.fill(saved + '\n\nLocal edits retained on conflict.')
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_text('This plan changed in another tab', exact=False)).to_be_visible()
    expect(editor).to_contain_text('Local edits retained on conflict.')
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('link', name='Saved plans', exact=True).last.click()
    expect(page.get_by_role('main').get_by_role('link', name='Registration reuse plan', exact=True)).to_be_visible()
    other.close()
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(base + '/saved-plans/' + fixture['planId'])
    page.wait_for_load_state('networkidle')
    expect(visual).to_be_visible()
    page.get_by_role('button', name='Bold', exact=True).focus()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Toolbar overflow at 390px'
    page.screenshot(path=str(out / 'visual-mobile.png'), full_page=True)
    page.emulate_media(color_scheme='dark', reduced_motion='reduce')
    page.screenshot(path=str(out / 'visual-mobile-dark.png'), full_page=True)
    page.get_by_role('button', name='Preview', exact=True).click()
    expect(page.get_by_label('Plan preview')).to_be_visible()
    page.get_by_role('link', name='Source 1:', exact=False).first.focus()
    page.keyboard.press('Enter')
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    page.wait_for_timeout(300)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow at 390px'
    page.screenshot(path=str(out / 'mobile.png'), full_page=True)
    page.emulate_media(color_scheme='dark', reduced_motion='reduce')
    page.screenshot(path=str(out / 'mobile-dark.png'), full_page=True)
    page.once('dialog', lambda dialog: dialog.accept())
    page.goto(base + '/?query=' + fixture['queryId'])
    page.wait_for_load_state('networkidle')
    page.unroute('**/api/queries/' + fixture['queryId'] + '/plans')
    pending = []
    response = page.request.get(base + '/api/plans/' + fixture['reviewId']).text()
    page.route('**/api/queries/' + fixture['queryId'] + '/plans', lambda route: pending.append(route))
    page.get_by_role('button', name='Draft reuse plan', exact=True).click()
    expect(page.get_by_role('button', name='Preparing your request…', exact=True)).to_be_visible()
    page.get_by_role('link', name='Saved plans', exact=True).first.click()
    page.wait_for_url('**/saved-plans')
    assert pending, 'Preparation request was not captured'
    pending[0].fulfill(status=201, content_type='application/json', body=response)
    page.wait_for_timeout(500)
    expect(page).to_have_url(base + '/saved-plans')
    assert not errors, errors
    print('PASS: visual toolbar, keyboard formatting, links, undo/redo, source compatibility, clean mode switching, length validation, review/generation handoff, Markdown safety, citations, save/reload, export, recovery, save conflict, 390px layout, keyboard interaction and navigation during preparation. Model generation mocked; reads, saves, export, evidence and session use local APIs.')
    browser.close()
