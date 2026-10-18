// Run through Playwright CLI with the local app and Supabase running.
// This uses real browser sessions but never submits a chat or calls an AI model.
// biome-ignore lint/correctness/noUnusedVariables: Playwright CLI invokes this function.
async function verifyOnboarding(page) {
  const base = new URL(page.url()).origin;
  const browser = page.context().browser();
  const fresh = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const second = await browser.newContext();
  const blocked = await browser.newContext();
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const chat = (tab) =>
    tab.getByRole("textbox", { name: "Message Wren", exact: true });
  const next = (tab) => tab.getByRole("button", { name: "Next", exact: true });
  const step = (tab, index) =>
    tab.getByRole("button", { name: new RegExp(`^Step ${index}:`) });
  const requests = [];
  const errors = [];
  fresh.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/queries(?:$|\/[^/]+\/turns$)/.test(
        new URL(request.url()).pathname,
      )
    )
      requests.push(request.url());
  });
  fresh.on("page", (tab) =>
    tab.on("pageerror", (error) => errors.push(error.message)),
  );
  try {
    const tab = await fresh.newPage();
    await tab.goto(base);
    await tab.waitForURL(`${base}/onboarding`);
    const heading = tab.getByRole("heading", { level: 1 });
    await tab
      .getByRole("heading", { name: "Meet Threadline Delivery", exact: true })
      .waitFor();
    check(
      (await heading.textContent()) === "Meet Threadline Delivery",
      "Fresh visit did not start at step one.",
    );
    check(
      await tab.getByRole("button", { name: "Back", exact: true }).isDisabled(),
      "Back is enabled on the first step.",
    );
    await tab.keyboard.press("Tab");
    check(
      await next(tab).evaluate((node) => node === document.activeElement),
      "Keyboard navigation did not reach Next from the step heading.",
    );
    await tab.keyboard.press("Enter");
    check(
      (await tab
        .getByRole("list", { name: "Nine historical projects" })
        .getByRole("listitem")
        .count()) === 9,
      "The archive must show all nine projects.",
    );
    check(
      await heading.evaluate((node) => node === document.activeElement),
      "Step changes must focus the heading.",
    );
    await tab.getByRole("button", { name: "Back", exact: true }).click();
    check(
      (await heading.textContent()) === "Meet Threadline Delivery",
      "Back did not restore step one.",
    );
    for (const width of [1440, 768, 390, 320]) {
      await tab.setViewportSize({ width, height: 900 });
      for (const colorScheme of ["light", "dark"]) {
        await tab.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        for (let index = 1; index <= 5; index++) {
          const previousHeading = await heading.textContent();
          await step(tab, index).click();
          if ((await heading.textContent()) !== previousHeading)
            check(
              await heading.evaluate((node) => node === document.activeElement),
              "Heading lost keyboard focus.",
            );
          check(
            await tab.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `Step ${index} overflows at ${width}px in ${colorScheme}.`,
          );
        }
      }
    }
    await tab.setViewportSize({ width: 1440, height: 1000 });
    await tab.emulateMedia({
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    await step(tab, 1).click();
    await tab.screenshot({
      path: "output/playwright/onboarding-desktop.png",
      fullPage: true,
    });
    await step(tab, 2).click();
    await tab.screenshot({
      path: "output/playwright/onboarding-projects.png",
      fullPage: true,
    });
    await tab.setViewportSize({ width: 390, height: 844 });
    await tab.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await step(tab, 4).click();
    await tab.screenshot({
      path: "output/playwright/onboarding-mobile-dark.png",
      fullPage: true,
    });
    await step(tab, 5).click();
    await tab
      .getByRole("button", { name: "Ask about past projects", exact: true })
      .click();
    await chat(tab).waitFor();
    await tab.waitForURL(`${base}/`);
    check(
      (await chat(tab).inputValue()).includes("duplicate submissions"),
      "History action did not prepare its prompt.",
    );
    check(
      await chat(tab).evaluate((node) => node === document.activeElement),
      "Starter did not focus the composer.",
    );
    check(
      (await tab.evaluate(() =>
        localStorage.getItem("rewoven-onboarding-v1"),
      )) === "dismissed",
      "Finishing did not persist dismissal.",
    );
    await tab.reload();
    await chat(tab).waitFor();
    // Wait for hydration: browsers can briefly restore the old textarea value
    // before React reconnects the empty in-memory draft.
    await tab.waitForFunction(
      () => document.getElementById("wren-message")?.value === "",
    );
    check(
      new URL(tab.url()).pathname === "/",
      "Dismissed onboarding reappeared after reload.",
    );
    check(
      (await chat(tab).inputValue()) === "",
      "A consumed starter unexpectedly returned on reload.",
    );

    await tab.setViewportSize({ width: 1440, height: 1000 });
    await chat(tab).fill("Keep my unfinished client request.");
    await tab.getByRole("button", { name: "Collapse sidebar" }).click();
    await tab
      .getByRole("link", { name: "How to use Rewoven", exact: true })
      .click();
    await tab
      .getByRole("heading", { name: "Meet Threadline Delivery", exact: true })
      .waitFor();
    check(
      (await heading.textContent()) === "Meet Threadline Delivery",
      "Replay must start at step one.",
    );
    await step(tab, 5).click();
    await tab
      .getByRole("button", { name: "Bring a new request", exact: true })
      .click();
    await chat(tab).waitFor();
    check(
      (await chat(tab).inputValue()) === "Keep my unfinished client request.",
      "Replay overwrote an existing draft.",
    );
    await tab
      .getByRole("note")
      .filter({ hasText: "client-brief.pdf" })
      .waitFor();
    await tab.getByRole("button", { name: "New chat", exact: true }).click();
    await tab
      .getByRole("link", { name: "How to use Rewoven", exact: true })
      .click();
    await step(tab, 5).click();
    await tab
      .getByRole("button", { name: "Bring a new request", exact: true })
      .click();
    await chat(tab).waitFor();
    check(
      (await chat(tab).inputValue()).startsWith("Which previous projects help"),
      "Request action did not prepare its prompt.",
    );
    await chat(tab).fill("My edited prompt");
    await tab
      .getByRole("link", { name: "How to use Rewoven", exact: true })
      .click();
    await tab.getByRole("button", { name: "Skip", exact: true }).click();
    await chat(tab).waitFor();
    check(
      (await chat(tab).inputValue()) === "My edited prompt",
      "Skip on replay lost the draft.",
    );
    await tab.reload();
    await chat(tab).waitFor();
    await tab.waitForFunction(
      () => document.getElementById("wren-message")?.value === "",
    );
    check(
      (await chat(tab).inputValue()) === "",
      "Reload must retain the documented in-memory draft lifetime.",
    );

    // Same IP, separate browser contexts: the actual server issues different cookies.
    const other = await second.newPage();
    await other.goto(`${base}/case-library`);
    await other
      .getByRole("heading", { name: "Case library", exact: true })
      .waitFor();
    check(
      new URL(other.url()).pathname === "/case-library",
      "A direct library link was intercepted.",
    );
    for (const [key, value] of [
      ["case", "00000000-0000-4000-8000-000000000000"],
      ["query", "00000000-0000-4000-8000-000000000000"],
    ]) {
      await other.goto(`${base}/?${key}=${value}&starter=history`);
      await chat(other).waitFor();
      check(
        new URL(other.url()).searchParams.has(key),
        "A starter replaced an existing chat/case link.",
      );
      check(
        (await chat(other).inputValue()) === "",
        "A starter was applied to a direct chat/case link.",
      );
    }
    await chat(other).fill("Keep this unfinished follow-up.");
    await other
      .getByRole("link", { name: "How to use Rewoven", exact: true })
      .click();
    await other.getByRole("button", { name: "Skip", exact: true }).click();
    await chat(other).waitFor();
    check(
      new URL(other.url()).searchParams.has("query") &&
        (await chat(other).inputValue()) === "Keep this unfinished follow-up.",
      "Replay lost the conversation location or follow-up draft.",
    );
    // Clear the browser preference to keep testing a genuinely fresh homepage.
    await other.evaluate(() =>
      localStorage.removeItem("rewoven-onboarding-v1"),
    );
    await other.goto(base);
    await other.waitForURL(`${base}/onboarding`);
    await other.getByRole("button", { name: "Skip", exact: true }).click();
    await chat(other).waitFor();
    await other.reload();
    await chat(other).waitFor();
    const a = await fresh.request.post(`${base}/api/demo-session`);
    const b = await second.request.post(`${base}/api/demo-session`);
    check(
      a.ok() && b.ok(),
      "Local Supabase is required to verify session cookies.",
    );
    const cookie = async (context) =>
      (await context.cookies()).find((item) => item.name === "rewoven-session");
    const firstCookie = await cookie(fresh);
    const secondCookie = await cookie(second);
    check(
      firstCookie?.value &&
        secondCookie?.value &&
        firstCookie.value !== secondCookie.value,
      "Judges' browser sessions are not isolated.",
    );
    check(
      firstCookie.httpOnly && firstCookie.sameSite === "Lax",
      "Session cookie protections changed.",
    );
    const sibling = await fresh.newPage();
    await sibling.goto(base);
    await chat(sibling).waitFor();
    await sibling.request.post(`${base}/api/demo-session`);
    check(
      (await cookie(fresh)).value === firstCookie.value,
      "Tabs in one browser profile must share the session.",
    );

    await blocked.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    const storageTab = await blocked.newPage();
    await storageTab.goto(base);
    await storageTab.waitForURL(`${base}/onboarding`);
    await storageTab.getByRole("button", { name: "Skip", exact: true }).click();
    await chat(storageTab).waitFor();
    check(
      new URL(storageTab.url()).pathname === "/",
      "Blocked storage caused a skip redirect loop.",
    );
    await storageTab
      .getByRole("link", { name: "How to use Rewoven", exact: true })
      .click();
    await step(storageTab, 5).click();
    await storageTab
      .getByRole("button", { name: "Bring a new request", exact: true })
      .click();
    await chat(storageTab).waitFor();
    check(
      (await chat(storageTab).inputValue()).startsWith(
        "Which previous projects help",
      ),
      "Blocked storage prevented a starter handoff.",
    );
    check(requests.length === 0, "Onboarding automatically submitted a chat.");
    check(errors.length === 0, `Browser runtime errors: ${errors.join("; ")}`);
    return "PASS: onboarding, 40 responsive/theme step checks, starters, drafts, deep links, blocked storage, and isolated/shared session cookies. No chat submitted.";
  } finally {
    await fresh.close();
    await second.close();
    await blocked.close();
  }
}
