import { addItem, card, createRoom, expect, joinRoom, person, test, view } from "./helpers";

// A full refinement: the host, eight voters and an observer, all at once.
const VOTERS: [name: string, vote: string][] = [
  ["Ben", "5"],
  ["Cleo", "5"],
  ["Dan", "5"],
  ["Eve", "5"],
  ["Filip", "8"],
  ["Gosia", "8"],
  ["Hubert", "3"],
  ["Iga", "21"],
];

test("ten people in one room: everyone joins, votes at once and sees the same result", async ({ browser }) => {
  test.setTimeout(180_000);
  const host = await person(browser);
  const { slug } = await createRoom(host, "Big refinement", "Anna");

  const voters = await Promise.all(VOTERS.map(() => person(browser)));
  const observer = await person(browser, { width: 390 });
  await Promise.all([
    ...voters.map((page, i) => joinRoom(page, slug, VOTERS[i][0])),
    joinRoom(observer, slug, "PO", "Observer"),
  ]);
  const everyone = [host, ...voters, observer];
  await expect(view(host).getByText("Team · 10 of 10 online")).toBeVisible();

  await addItem(host, "Migrate billing to the new provider");
  await host.getByRole("button", { name: "Start voting" }).click();
  for (const page of voters) await expect(view(page).getByText("Your card")).toBeVisible();

  await test.step("nine votes land at the same time", async () => {
    await Promise.all([card(host, "5").click(), ...voters.map((page, i) => card(page, VOTERS[i][1]).click())]);
    await expect(view(host).getByText("9 of 9")).toBeVisible();
    await expect(view(host).getByText("Everyone has voted")).toBeVisible();
    // Nobody sees a value before the reveal: the observer sees none of the cast values,
    // and a voter sees Iga (21) only as "voted" at the table and ✓ in the team list — the 21
    // elsewhere on his screen is the card in his own hand.
    for (const value of ["3", "5", "8", "21"]) {
      await expect(view(observer).getByText(value, { exact: true })).toHaveCount(0);
    }
    const iga = view(voters[0]).getByRole("listitem").filter({ hasText: "Iga" });
    await expect(iga).toHaveCount(2);
    await expect(iga.first()).toContainText("voted");
    await expect(iga.last()).toContainText("✓");
    for (const row of await iga.all()) await expect(row).not.toContainText("21");
  });

  await test.step("everyone sees the same result after the reveal", async () => {
    await host.getByRole("button", { name: "Reveal cards" }).click();
    for (const page of everyone) {
      await expect(view(page).locator(".text-kpi")).toHaveText("5");
      await expect(view(page).getByText(/^Outlying votes/)).toBeVisible();
    }
    await view(observer).getByRole("tab", { name: /Questions/ }).click();
    await expect(view(observer).getByText("What does Iga (21) see that the rest of us don't?")).toBeVisible();
  });

  await test.step("the host confirms; the room is done for everyone", async () => {
    await host.getByRole("button", { name: "Confirm 5" }).click();
    for (const page of everyone) {
      await expect(view(page).getByText("Every item is estimated or skipped.")).toBeVisible();
    }
  });
});
