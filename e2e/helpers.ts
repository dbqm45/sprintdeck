import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

export const TURNSTILE_TOKEN = "e2e-turnstile-token";

/**
 * Stands in for Cloudflare's Turnstile script: renders nothing and hands out a
 * token right away. The tests check our side — that the first anonymous sign-in
 * carries the token. Cloudflare's own check happens in Supabase Auth.
 */
async function mockTurnstile(context: BrowserContext) {
  await context.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.turnstile = {
        render(el, options) { setTimeout(() => options.callback(${JSON.stringify(TURNSTILE_TOKEN)}), 50); return "w"; },
        remove() {},
      };`,
    }),
  );
}

/** `test` with the Turnstile stand-in on the default page's context. */
export const test = base.extend({
  // The fixture callback is named `provide`, not Playwright's usual `use`, so the React hooks lint rule leaves it alone.
  context: async ({ context }, provide) => {
    await mockTurnstile(context);
    await provide(context);
  },
});
export { expect };

/** A participant with their own browser context = their own anonymous user. */
export async function person(
  browser: Browser,
  options: { colorScheme?: "light" | "dark"; width?: number } = {},
): Promise<Page> {
  const context = await browser.newContext({
    colorScheme: options.colorScheme ?? "light",
    viewport: { width: options.width ?? 1280, height: 1000 },
  });
  await mockTurnstile(context);
  return context.newPage();
}

/** Creates a room from the landing page; returns its slug and the host secret. */
export async function createRoom(page: Page, title: string, name: string, deck: "Fibonacci" | "Risk" = "Fibonacci") {
  await page.goto("/");
  await page.getByLabel("Room title").fill(title);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("radio", { name: deck }).click();
  await page.getByRole("button", { name: "Create room" }).click();
  await page.waitForURL(/\/r\/[0-9A-Za-z]{12}$/);
  const slug = page.url().split("/r/")[1];
  const secret = await page.evaluate((s) => sessionStorage.getItem(`sprintdeck:host-secret:${s}`), slug);
  expect(secret).toBeTruthy();
  return { slug, secret: secret! };
}

export async function joinRoom(page: Page, slug: string, name: string, role: "Voter" | "Observer" = "Voter") {
  await page.goto(`/r/${slug}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(view(page).getByText(/^Team · /)).toBeVisible();
}

export async function addItem(host: Page, title: string) {
  await host.getByLabel("New item").fill(title);
  await host.getByRole("button", { name: "Add", exact: true }).click();
  await expect(host.getByLabel("New item")).toHaveValue("");
}

/**
 * The page on screen. After a client-side navigation Next.js keeps the previous
 * page in the DOM (hidden) for a fast way back, so text lookups go through the
 * visible <main> — getByRole skips hidden elements.
 */
export function view(page: Page) {
  return page.getByRole("main");
}

/** Clicks a card in the voting hand (or the estimate picker) by its label. */
export function card(page: Page, label: string) {
  return page.getByRole("button", { name: label, exact: true });
}

/**
 * A switch for one participant's network. `down()` cuts HTTP (offline mode) and
 * closes the realtime websocket on both ends — Chromium's offline mode alone
 * leaves an open websocket running — and refuses reconnects until `up()`.
 */
export async function networkSwitch(page: Page) {
  let online = true;
  const open = new Set<{ page: WebSocketRoute; server: WebSocketRoute }>();
  await page.context().routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    if (!online) {
      void ws.close({ code: 1006, reason: "offline" });
      return;
    }
    const pair = { page: ws, server: ws.connectToServer() };
    open.add(pair);
    ws.onClose(() => open.delete(pair));
  });
  return {
    async down() {
      online = false;
      await page.context().setOffline(true);
      for (const pair of open) {
        await pair.server.close();
        await pair.page.close({ code: 1006, reason: "offline" });
      }
      open.clear();
    },
    async up() {
      await page.context().setOffline(false);
      online = true;
    },
  };
}
