// Run with Playwright CLI: run-code --filename tests/query-file-drop.browser.js
// Uses mocked saved chats; does not upload files or call AI services.
// biome-ignore lint/correctness/noUnusedVariables: Playwright CLI invokes this function.
async function verifyQueryFileDrop(page) {
  const base = new URL(page.url()).origin;
  const queryId = "00000000-0000-4000-8000-000000000019";
  const errors = [];
  const writes = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  await page.evaluate(() =>
    localStorage.setItem("rewoven-onboarding-v1", "dismissed"),
  );
  const fixture = {
    id: queryId,
    title: "File drop browser check",
    updated_at: new Date().toISOString(),
    assistant: true,
    chat_context: { mode: "library", caseIds: [] },
    context_revision: 0,
    selected_cases: [],
    files: [],
    focused_case_id: null,
    request: { request: "", deadline: "", technology: "", capabilities: "" },
    turns: [
      {
        id: "drop-test-turn",
        message: "A saved message",
        ordinal: 1,
        status: "ready",
        started_at: new Date().toISOString(),
        answer: null,
        work: {
          evidence: [
            {
              id: "e1",
              case_id: "case-1",
              source_id: "source-1",
              chunk_id: "chunk-1",
              title: "Browser fixture",
              source_title: "Fixture source",
              version: 1,
              page_number: 1,
              char_start: 0,
              char_end: 7,
              text: "Example",
            },
          ],
          retrieval: { mode: "keyword", warnings: [], cases: [] },
        },
      },
    ],
  };
  let releaseLoad;
  let loadGate = Promise.resolve();
  const mockApi = async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === `/api/queries/${queryId}`) {
      await loadGate;
      await route.fulfill({ json: { query: fixture } });
    } else if (path === "/api/demo-session") {
      await route.fulfill({ json: {} });
    } else if (request.method() !== "GET") {
      writes.push(path);
      await route.fulfill({ status: 500, json: { error: "Unexpected write" } });
    } else if (path === "/api/queries") {
      await route.fulfill({ json: { queries: [] } });
    } else {
      await route.fulfill({ json: { plans: [], cases: [] } });
    }
  };
  await page.route("**/api/**", mockApi);
  const overlay = page.getByText("Drop files here", { exact: true });
  const attachments = page.getByRole("list", {
    name: "Files for this message",
  });
  const picker = page.getByRole("button", {
    name: "Upload files",
    exact: true,
  });
  const thread = '[role="log"]';
  const file = (name = "brief.pdf", size = 10) => ({ name, size });
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  async function drag(selector, type, files = [file()], text = null) {
    return page.locator(selector).evaluate(
      (target, data) => {
        const transfer = new DataTransfer();
        if (data.text) transfer.setData(data.text, "A dragged sentence");
        else
          for (const item of data.files)
            transfer.items.add(new File(["x".repeat(item.size)], item.name));
        const event = new DragEvent(data.type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        });
        target.dispatchEvent(event);
        return { prevented: event.defaultPrevented };
      },
      { type, files, text },
    );
  }
  async function count(expected) {
    await page.waitForFunction(
      (value) =>
        document.querySelectorAll('[aria-label="Files for this message"] li')
          .length === value,
      expected,
    );
  }
  async function resetPage(url = base) {
    await page.goto(url);
    await picker.waitFor();
    await page.waitForFunction(
      () => !document.querySelector('input[type="file"]').disabled,
    );
  }
  try {
    await resetPage();
    await page
      .getByRole("textbox", { name: "Message Wren" })
      .fill("Keep my draft");
    await page.getByRole("textbox", { name: "Message Wren" }).focus();
    const before = await page.locator(".query-workspace").boundingBox();
    await drag(".query-workspace", "dragenter");
    await overlay.waitFor();
    assert(
      (await drag(thread, "dragover")).prevented,
      "Enabled drop target did not allow a file drop",
    );
    await drag(thread, "dragenter");
    await drag(".query-workspace", "dragleave");
    assert(await overlay.isVisible(), "Nested entry flickered the overlay");
    const after = await page.locator(".query-workspace").boundingBox();
    assert(
      JSON.stringify(before) === JSON.stringify(after),
      "Overlay shifted layout",
    );
    assert(
      await page
        .getByRole("textbox", { name: "Message Wren" })
        .evaluate((node) => node === document.activeElement),
      "Overlay stole keyboard focus",
    );
    await drag(thread, "drop");
    await overlay.waitFor({ state: "hidden" });
    await count(1);
    await drag(".query-chat-form", "dragenter", [file("constraints.md")]);
    await drag(".query-chat-form", "drop", [file("constraints.md")]);
    await count(2);
    await attachments.getByRole("button", { name: "Remove brief.pdf" }).click();
    await count(1);

    await picker.focus();
    await page.getByLabel("Upload problem documents").setInputFiles({
      name: "picked.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("text"),
    });
    await count(2);
    for (const [name, size, message] of [
      ["photo.png", 10, "Choose a .txt, .md, or text-based .pdf file."],
      ["empty.txt", 0, "This file is empty. Choose a file containing text."],
      [
        "large.pdf",
        5_000_001,
        "This file exceeds 5 MB. Choose a smaller file.",
      ],
    ]) {
      await drag(thread, "drop", [file(name, size)]);
      await page.getByText(message, { exact: true }).waitFor();
      await count(2);
    }
    await drag(thread, "drop", [
      file("a.txt"),
      file("b.txt"),
      file("c.txt"),
      file("d.txt"),
    ]);
    await page
      .getByText("Choose up to five files per message.", { exact: true })
      .waitFor();
    await count(2);
    for (const format of ["text/plain", "text/uri-list"])
      for (const type of ["dragenter", "dragover", "drop"])
        assert(
          !(await drag(thread, type, [], format)).prevented,
          "Text or link drag was intercepted",
        );
    assert(!(await overlay.count()), "Text drag showed the overlay");

    for (const cancellation of [
      "leave",
      "Escape",
      "blur",
      "dragend",
      "outside-drop",
    ]) {
      await drag(thread, "dragenter");
      await overlay.waitFor();
      if (cancellation === "leave") await drag(thread, "dragleave");
      else if (cancellation === "Escape") await page.keyboard.press("Escape");
      else if (cancellation === "outside-drop") await drag("nav", "drop");
      else
        await page.evaluate(
          (type) => window.dispatchEvent(new Event(type)),
          cancellation,
        );
      await overlay.waitFor({ state: "hidden" });
    }
    await drag("nav", "dragenter");
    assert(!(await overlay.count()), "Sidebar became a drop target");
    assert(
      (await page
        .getByRole("textbox", { name: "Message Wren" })
        .inputValue()) === "Keep my draft",
      "Draft changed on drop",
    );

    await resetPage(`${base}/?query=${queryId}`);
    await page
      .getByRole("complementary", { name: "Sources for the latest answer" })
      .waitFor();
    await drag(".query-cases", "dragenter");
    await overlay.waitFor();
    await drag(".query-cases", "drop", [file("evidence-drop.md")]);
    await count(1);
    await drag(thread, "drop", [file("follow-up.txt")]);
    await drag(".query-chat-form", "drop", [file("composer.pdf")]);
    await count(3);

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(value);
        }, theme);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page
          .getByRole("textbox", { name: "Message Wren" })
          .scrollIntoViewIfNeeded();
        await drag(".query-chat-form", "dragenter");
        await overlay.waitFor();
        const box = await page
          .locator(".query-file-drop-message")
          .boundingBox();
        assert(
          box &&
            box.x >= 0 &&
            box.x + box.width <= width &&
            box.y >= 0 &&
            box.y + box.height <= 900,
          `Overlay outside viewport at ${width}px in ${theme}`,
        );
        await page.screenshot({
          path: `output/playwright/query-file-drop-${width}-${theme}.png`,
        });
        await page.keyboard.press("Escape");
      }
    }

    await drag(thread, "dragenter");
    await overlay.waitFor();
    loadGate = new Promise((resolve) => {
      releaseLoad = resolve;
    });
    await page.goto(`${base}/?query=${queryId}`);
    await page.getByText("Opening your chat…", { exact: true }).waitFor();
    await drag(thread, "dragenter");
    assert(!(await overlay.count()), "Loading chat accepted a file drag");
    assert(
      (await drag(thread, "drop")).prevented,
      "Loading drop could open a file",
    );
    await count(0);
    releaseLoad();
    await page.waitForFunction(
      () => !document.querySelector('input[type="file"]').disabled,
    );

    fixture.turns[0].status = "processing";
    fixture.turns[0].started_at = new Date().toISOString();
    await page.reload();
    await page
      .getByText("Understanding your message…", { exact: true })
      .waitFor();
    assert(await picker.isDisabled(), "Processing picker is enabled");
    await drag(thread, "dragenter");
    assert(!(await overlay.count()), "Processing chat accepted a file drag");
    assert(
      (await drag(thread, "drop")).prevented,
      "Processing drop could open a file",
    );
    await count(0);

    assert(
      !writes.length,
      `Dropping submitted a request: ${writes.join(", ")}`,
    );
    assert(!errors.length, `Browser errors: ${errors.join(", ")}`);
    console.log(
      "File drop checks passed: new/saved chats, nested events, cancellation, validation, picker, disabled states, themes and mobile.",
    );
  } finally {
    releaseLoad?.();
    await page.unroute("**/api/**", mockApi);
    page.off("pageerror", onError);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base);
  }
}
