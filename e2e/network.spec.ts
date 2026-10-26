import { addItem, card, createRoom, expect, joinRoom, networkSwitch, person, test, view } from "./helpers";

test("a voter who loses the network catches up without reloading", async ({ browser }) => {
  const host = await person(browser);
  const voter = await person(browser);
  const network = await networkSwitch(voter);
  const { slug } = await createRoom(host, "Flaky wifi", "Anna");
  await joinRoom(voter, slug, "Ben");
  await addItem(host, "Payment retries");
  await host.getByRole("button", { name: "Start voting" }).click();
  await card(voter, "8").click();
  await card(host, "5").click();
  await expect(view(host).getByText("Everyone has voted")).toBeVisible();

  await test.step("Ben goes offline; the host sees him drop out", async () => {
    await network.down();
    await expect(view(host).getByText("Team · 1 of 2 online")).toBeVisible();
  });

  await test.step("while he is away the host reveals and starts the next round", async () => {
    await host.getByRole("button", { name: "Reveal cards" }).click();
    await expect(view(host).getByText("suggested ·", { exact: true })).toBeVisible();
    // Ben's screen still shows the open round: nothing reaches him.
    await expect(view(voter).getByText("Your card")).toBeVisible();
    // Trying to change his vote tells him he's offline instead of failing silently.
    await card(voter, "13").click();
    await expect(view(voter).getByRole("alert")).toContainText("You're offline");
  });

  await test.step("Ben comes back: the room catches up on its own", async () => {
    await network.up();
    // The realtime client retries with backoff (up to ~10 s), then rejoins and refetches the room.
    await expect(view(voter).getByText("suggested ·", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(view(host).getByText("Team · 2 of 2 online")).toBeVisible();
    // The change he tried while offline didn't happen: his vote is still the 8 everyone saw.
    await expect(view(host).getByRole("listitem").filter({ hasText: "Ben" })).toContainText("8");
  });

  await test.step("and keeps working: the next round reaches him live", async () => {
    await host.getByRole("button", { name: "Re-vote" }).click();
    await expect(view(voter).getByText("Round 2")).toBeVisible();
    await card(voter, "5").click();
    await expect(view(host).getByText("Everyone has voted")).not.toBeVisible();
    await card(host, "5").click();
    await expect(view(host).getByText("Everyone has voted")).toBeVisible();
  });
});
