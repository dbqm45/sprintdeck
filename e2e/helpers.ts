import { expect, type Browser, type Page } from "@playwright/test";

/** A participant with their own browser context = their own anonymous user. */
export async function person(
  browser: Browser,
  options: { colorScheme?: "light" | "dark"; width?: number } = {},
): Promise<Page> {
  const context = await browser.newContext({
    colorScheme: options.colorScheme ?? "light",
    viewport: { width: options.width ?? 1280, height: 1000 },
  });
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
