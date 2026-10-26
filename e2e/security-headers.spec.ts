import type { Page } from "@playwright/test";
import { addItem, card, createRoom, expect, joinRoom, person, test, view } from "./helpers";

/** Records every Content Security Policy violation the page reports. */
async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) =>
      violations.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
}

const violationsOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);

test("every page sends the security headers", async ({ request }) => {
  for (const path of ["/", "/simulator", "/r/AbCdEf123456"]) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  }
});

test("the policy blocks nothing the app uses: Turnstile, Supabase, realtime, the simulator", async ({ browser }) => {
  const host = await person(browser);
  const guest = await person(browser);
  await watchViolations(host);
  await watchViolations(guest);

  const { slug } = await createRoom(host, "CSP check", "Anna");
  await joinRoom(guest, slug, "Ben");
  await addItem(host, "Payment retries");
  // Realtime over the websocket: the guest sees the item without reloading.
  await expect(view(guest).getByRole("heading", { name: "Payment retries" })).toBeVisible();
  await host.getByRole("button", { name: "Start voting" }).click();
  await card(host, "5").click();
  await card(guest, "8").click();
  await host.getByRole("button", { name: "Reveal cards" }).click();
  await expect(view(guest).getByText("suggested ·", { exact: true })).toBeVisible();

  await host.goto("/simulator");
  await expect(view(host).getByText("Worth checking the differences in assumptions")).toBeVisible();

  expect(await violationsOf(host)).toEqual([]);
  expect(await violationsOf(guest)).toEqual([]);
});
