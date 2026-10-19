// Run with Playwright CLI: run-code --filename tests/ai-key.browser.js
// Uses fake keys and a mocked chat route. No OpenAI requests or saved test chats.
// biome-ignore lint/correctness/noUnusedVariables: Playwright CLI invokes this function.
async function verifyPersonalKey(page) {
  const base = new URL(page.url()).origin;
  const key = `sk-proj-${"browser-fake".repeat(5)}`;
  const replacement = `sk-proj-${"replacement".repeat(5)}`;
  const queryId = "00000000-0000-4000-8000-000000000009";
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    localStorage.setItem("rewoven-onboarding-v1", "dismissed"),
  );
  const fixture = {
    id: queryId,
    title: "Personal key browser check",
    updated_at: new Date().toISOString(),
    assistant: true,
    chat_context: { mode: "library", caseIds: [] },
    context_revision: 0,
    selected_cases: [],
    files: [],
    focused_case_id: null,
    turns: [],
    request: { request: "", deadline: "", technology: "", capabilities: "" },
  };
  const sent = [];
  await page.route(`**/api/queries/${queryId}`, (route) =>
    route.fulfill({ json: { query: fixture } }),
  );
  await page.route(`**/api/queries/${queryId}/turns`, async (route) => {
    const request = route.request();
    sent.push({
      key: request.headers()["x-rewoven-openai-key"],
      body: request.postData(),
    });
    await route.fulfill({
      status: 503,
      json: { error: "Controlled browser provider failure." },
    });
  });
  await page.goto(`${base}/?query=${queryId}`);
  const inactive = page.getByRole("button", {
    name: "Use your own API key",
    exact: true,
  });
  const active = page.getByRole("button", {
    name: "Your API key is active",
    exact: true,
  });
  const dialog = page.getByRole("dialog", {
    name: "OpenAI API key",
    exact: true,
  });
  const input = page.getByLabel("Your API key", { exact: true });
  async function addKey(value) {
    await inactive.click();
    await input.fill(value);
    await dialog
      .getByRole("button", { name: "Use my key", exact: true })
      .click();
    await active.waitFor();
  }
  async function send(expected) {
    const before = sent.length;
    await page
      .getByRole("textbox", { name: "Message Wren" })
      .fill("Test personal key routing.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page
      .getByText("Controlled browser provider failure.", { exact: true })
      .waitFor();
    if (sent.length !== before + 1 || sent.at(-1).key !== expected)
      throw new Error("The chat used the wrong credential.");
    if (sent.at(-1).body.includes("sk-"))
      throw new Error("Credential entered chat content.");
  }
  await inactive.click();
  await input.fill("bad-key");
  await dialog.getByRole("button", { name: "Use my key", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  if ((await input.getAttribute("type")) !== "password")
    throw new Error("Key input must be masked.");
  await page.keyboard.press("Escape");
  await addKey(key);
  await send(key);
  await active.click();
  await page.getByLabel("Replace your key", { exact: true }).fill(replacement);
  await dialog
    .getByRole("button", { name: "Replace key", exact: true })
    .click();
  await send(replacement);

  await page.getByRole("link", { name: "Case library", exact: true }).click();
  await active.waitFor();
  await page.getByRole("link", { name: "New chat", exact: true }).click();
  await active.waitFor();
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await active.click();
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(value);
      }, theme);
      await active.click();
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      if (
        !box ||
        box.x < 0 ||
        box.x + box.width > width ||
        box.y < 0 ||
        box.y + box.height > 900
      )
        throw new Error(`Key dialog overflows at ${width}px in ${theme}.`);
      if (
        await page.getByLabel("Replace your key", { exact: true }).inputValue()
      )
        throw new Error("The settings form retained a secret.");
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `output/playwright/api-key-${width}-${theme}.png`,
          animations: "disabled",
        });
      await page.keyboard.press("Escape");
    }
  }
  const leaked = await page.evaluate(() =>
    [
      JSON.stringify(localStorage),
      JSON.stringify(sessionStorage),
      document.cookie,
      document.body.innerText,
    ].join("\n"),
  );
  if (leaked.includes(key) || leaked.includes(replacement))
    throw new Error("A key was persisted or displayed.");
  const secondTab = await page.context().newPage();
  await secondTab.goto(base);
  await secondTab
    .getByRole("button", { name: "Use your own API key", exact: true })
    .waitFor();
  await secondTab.close();

  await active.click();
  await dialog
    .getByRole("button", { name: "Remove my key", exact: true })
    .click();
  await inactive.waitFor();
  await page.reload();
  await inactive.waitFor();
  await addKey(key);
  await page.reload();
  await inactive.waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await inactive.click();
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Personal key browser checks passed: routing, replace/remove, tab isolation, reload, responsive themes, collapsed sidebar, keyboard, and reduced motion.",
  );
}
