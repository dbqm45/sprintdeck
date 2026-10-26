import { TURNSTILE_TOKEN, addItem, createRoom, expect, person, test, view } from "./helpers";

test("the first sign-in carries the Turnstile token, on the landing page and from a room link", async ({
  browser,
}) => {
  const host = await person(browser);
  const signUps: unknown[] = [];
  host.on("request", (request) => {
    if (request.url().includes("/auth/v1/signup")) signUps.push(request.postDataJSON());
  });
  const { slug } = await createRoom(host, "Bot check", "Anna");
  expect(signUps).toEqual([expect.objectContaining({ gotrue_meta_security: { captcha_token: TURNSTILE_TOKEN } })]);
  await addItem(host, "Payment retries");

  const guest = await person(browser);
  const guestSignUps: unknown[] = [];
  guest.on("request", (request) => {
    if (request.url().includes("/auth/v1/signup")) guestSignUps.push(request.postDataJSON());
  });
  await guest.goto(`/r/${slug}`);
  await expect(view(guest).getByText("Bot check")).toBeVisible();
  expect(guestSignUps).toEqual([
    expect.objectContaining({ gotrue_meta_security: { captcha_token: TURNSTILE_TOKEN } }),
  ]);

  // Signed in once, the browser keeps its session: no second check on reload.
  await guest.reload();
  await expect(view(guest).getByText("Bot check")).toBeVisible();
  expect(guestSignUps).toHaveLength(1);
});
