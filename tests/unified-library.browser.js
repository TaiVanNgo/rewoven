// Run with Playwright CLI's `run-code --filename tests/unified-library.browser.js`.
// Requires the app, local Supabase, and all nine seeded projects. No AI calls.
// biome-ignore lint/correctness/noUnusedVariables: Playwright CLI evaluates and invokes this named function.
async function verifyUnifiedLibrary(page) {
  const base = new URL(page.url()).origin;
  await page.goto(base);
  const scope = page.getByText("Searching Case library", { exact: true });
  await scope.waitFor();
  if (
    await page
      .getByRole("button", { name: "Use demo library", exact: true })
      .count()
  )
    throw new Error("The default library still requires a demo switch.");

  await page.getByRole("button", { name: "Add cases", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add cases to this chat" });
  const checkboxes = picker.getByRole("checkbox");
  await checkboxes.first().waitFor();
  if ((await checkboxes.count()) !== 9)
    throw new Error(
      "All nine historical cases must appear without changing tabs.",
    );
  if (
    await picker
      .getByRole("button", { name: /^(My cases|Sample cases)$/ })
      .count()
  )
    throw new Error(
      "The picker still separates the archive into two libraries.",
    );
  for (let i = 0; i < 5; i++) await checkboxes.nth(i).check();
  if (!(await checkboxes.nth(5).isDisabled()))
    throw new Error(
      "Explicit selection no longer enforces its five-case limit.",
    );
  await picker
    .getByRole("button", { name: "Apply selection", exact: true })
    .click();
  await page.getByText("Using only attached cases", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Search full library", exact: true })
    .click();
  await scope.waitFor();

  await page
    .getByLabel("Upload problem documents")
    .setInputFiles([
      "output/pdf/rewoven-purchase-demo/upload/Client input/client-brief.pdf",
      "output/pdf/rewoven-purchase-demo/upload/Client input/constraints.md",
    ]);
  const files = page.getByRole("list", { name: "Files for this message" });
  await files.getByText("client-brief.pdf", { exact: true }).waitFor();
  await files.getByText("constraints.md", { exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Message" })
    .fill(
      "Which previous projects help with this request? Explain what we can reuse, what changes are needed, and what is still unknown.",
    );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        )
      )
        throw new Error(`The unified library layout overflows at ${width}px.`);
      await scope.waitFor();
    }
  }
  // Check the browser's actual submission payload without starting paid reading
  // or generation. The integration suite runs the full persisted flow with
  // mocked providers, real Northbank documents, and real historical retrieval.
  const pattern = `${base}/api/queries`;
  let submission;
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submission = route.request().postDataJSON();
    await route.fulfill({
      status: 400,
      json: { error: "Browser verification stopped before AI processing." },
    });
  });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page
    .getByText("Browser verification stopped before AI processing.", {
      exact: true,
    })
    .waitFor();
  await page.unroute(pattern);
  if (
    submission?.chatContext?.mode !== "library" ||
    submission.chatContext.caseIds.length ||
    submission.files.length !== 2
  )
    throw new Error(
      "Northbank files were not submitted with the default full-library scope.",
    );
}
