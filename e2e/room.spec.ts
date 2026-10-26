import { expect, test } from "@playwright/test";
import { addItem, card, createRoom, joinRoom, person, view } from "./helpers";

test("a full session: create, join, vote with hidden cards, reveal, re-vote, confirm, summary", async ({
  browser,
}) => {
  const anna = await person(browser);
  const ben = await person(browser, { colorScheme: "dark" });
  const cleo = await person(browser, { width: 390 });

  const { slug, secret } = await test.step("Anna creates a room and gets a host link", async () => {
    const room = await createRoom(anna, "Sprint 42 refinement", "Anna");
    await expect(view(anna).getByText("Save your host link")).toBeVisible();
    await anna.getByRole("button", { name: "I've saved it" }).click();
    return room;
  });

  await test.step("Ben joins as a voter, Cleo as an observer; presence shows everyone", async () => {
    await ben.goto(`/r/${slug}`);
    await expect(view(ben).getByText("Sprint 42 refinement")).toBeVisible();
    await joinRoom(ben, slug, "Ben");
    await joinRoom(cleo, slug, "Cleo", "Observer");
    await expect(view(anna).getByText("Team · 3 of 3 online")).toBeVisible();
  });

  await test.step("items appear for everyone in real time", async () => {
    await addItem(anna, "Payment retries for failed cards");
    await addItem(anna, "Refund flow");
    await expect(ben.getByRole("heading", { name: "Payment retries for failed cards" })).toBeVisible();
    await expect(view(ben).getByText("Waiting for the host to start voting.")).toBeVisible();
  });

  await test.step("votes stay hidden until the host reveals", async () => {
    await anna.getByRole("button", { name: "Start voting" }).click();
    await expect(view(ben).getByText("Your card")).toBeVisible();
    await expect(view(cleo).getByText("You're observing — you don't vote.")).toBeVisible();

    await card(anna, "5").click();
    await card(ben, "13").click();
    await card(ben, "8").click(); // a change of mind
    await expect(view(anna).getByText("Everyone has voted")).toBeVisible();

    // No vote value anywhere on the observer's screen.
    const main = view(cleo);
    for (const value of ["5", "8", "13"]) {
      await expect(main.getByText(value, { exact: true })).toHaveCount(0);
    }
  });

  await test.step("a reload keeps the participant and their vote", async () => {
    await ben.reload();
    await expect(card(ben, "8")).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("reveal shows the Consensus Engine result to everyone", async () => {
    await anna.getByRole("button", { name: "Reveal cards" }).click();
    for (const page of [anna, ben, cleo]) {
      await expect(view(page).getByText("suggested ·", { exact: true })).toBeVisible();
      await expect(view(page).getByText("Worth checking the differences in assumptions")).toBeVisible();
    }
  });

  await test.step("re-vote, then confirm with a note; the room moves on", async () => {
    await anna.getByRole("button", { name: "Re-vote" }).click();
    await expect(view(ben).getByText("Round 2")).toBeVisible();
    await card(anna, "8").click();
    await card(ben, "8").click();
    await expect(view(anna).getByText("Everyone has voted")).toBeVisible();
    await anna.getByRole("button", { name: "Reveal cards" }).click();
    await expect(view(anna).getByText("Full consensus")).toBeVisible();
    await anna.getByLabel("Decision note (optional)").fill("Dunning emails need legal review");
    await anna.getByRole("button", { name: "Confirm 8" }).click();
    await expect(ben.getByRole("heading", { name: "Refund flow" })).toBeVisible();
  });

  await test.step("the second item", async () => {
    await anna.getByRole("button", { name: "Start voting" }).click();
    await card(anna, "3").click();
    await card(ben, "3").click();
    await expect(view(anna).getByText("Everyone has voted")).toBeVisible();
    await anna.getByRole("button", { name: "Reveal cards" }).click();
    await anna.getByRole("button", { name: "Confirm 3" }).click();
    await expect(view(anna).getByText("Every item is estimated or skipped.")).toBeVisible();
  });

  await test.step("the host link hands the host role to another device", async () => {
    const laptop = await person(browser);
    await laptop.goto(`/r/${slug}#host=${secret}`);
    await laptop.getByLabel("Your name").fill("Anna (laptop)");
    await laptop.getByRole("button", { name: "Join room" }).click();
    await expect(laptop.getByRole("button", { name: "End session" })).toBeVisible();
    expect(laptop.url()).not.toContain("#host");
    await expect(anna.getByRole("button", { name: "End session" })).toHaveCount(0);

    await laptop.getByRole("button", { name: "End session" }).click();
  });

  await test.step("everyone sees the summary; Markdown export", async () => {
    for (const page of [anna, ben, cleo]) {
      await expect(view(page).getByText("This session has ended.")).toBeVisible();
    }
    await expect(view(anna).getByText("Total points").locator("..")).toContainText("11");
    await anna.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await anna.getByRole("button", { name: "Copy as Markdown" }).click();
    const markdown = await anna.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain(
      "| 1 | Payment retries for failed cards — Dunning emails need legal review | 8 | 2 | Full consensus |",
    );
    expect(markdown).toContain("| 2 | Refund flow | 3 | 1 | Full consensus |");
  });
});

test("a Risk room: levels on the cards, risk questions, high-risk count in the summary", async ({ browser }) => {
  const host = await person(browser);
  const voter = await person(browser);
  const { slug } = await createRoom(host, "Risk review", "Anna", "Risk");
  await joinRoom(voter, slug, "Ben");
  await addItem(host, "Migrate billing to the new provider");

  await host.getByRole("button", { name: "Start voting" }).click();
  await card(host, "High").click();
  await card(voter, "Very high").click();
  await expect(view(host).getByText("Everyone has voted")).toBeVisible();
  await host.getByRole("button", { name: "Reveal cards" }).click();

  // Median between High and Very high rounds up.
  await expect(voter.locator(".text-kpi")).toHaveText("Very high");
  await expect(view(voter).getByText("This looks risky to ship as specified")).toBeVisible();
  await voter.getByRole("tab", { name: /Questions/ }).click();
  await expect(view(voter).getByText("Can we make it safer to ship — smaller steps, a feature flag, a way back?")).toBeVisible();

  await host.getByRole("button", { name: "Confirm Very high" }).click();
  await host.getByRole("button", { name: "End session" }).click();
  await expect(view(voter).getByText("High risk or above").locator("..")).toContainText("1/1");
});

test("unknown rooms and bad links", async ({ page }) => {
  await page.goto("/r/zzzzzzzzzzzz");
  await expect(view(page).getByText("This room doesn't exist")).toBeVisible();

  await page.goto("/");
  await page.getByLabel("Join").fill("not a link");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(view(page).getByText("That doesn't look like a room link.")).toBeVisible();
});

test("the host manages the team: makes someone an observer, then hands the host role over", async ({ browser }) => {
  const anna = await person(browser);
  const ben = await person(browser);
  const { slug } = await createRoom(anna, "Team roles", "Anna");
  await joinRoom(ben, slug, "Ben");
  await addItem(anna, "Payment retries");

  // Only the host can manage others, and not themselves.
  await expect(view(anna).getByRole("button", { name: /^Anna/ })).toHaveCount(0);
  await expect(view(ben).getByRole("button", { name: /^Anna/ })).toHaveCount(0);

  await view(anna).getByRole("button", { name: /^Ben/ }).click();
  await anna.getByRole("button", { name: "Make observer" }).click();
  await expect(view(ben).getByRole("radio", { name: "Watch" })).toHaveAttribute("aria-checked", "true");

  await view(anna).getByRole("button", { name: /^Ben/ }).click();
  await anna.getByRole("button", { name: "Make host" }).click();
  await expect(view(anna).getByText("Hand the host role to Ben? You'll become a voter.")).toBeVisible();
  await anna.getByRole("button", { name: "Hand over" }).click();

  await expect(ben.getByRole("button", { name: "Start voting" })).toBeVisible();
  await expect(anna.getByRole("button", { name: "Start voting" })).toHaveCount(0);
  await expect(view(anna).getByText("Waiting for the host to start voting.")).toBeVisible();
  await expect(view(anna).getByRole("radio", { name: "Vote" })).toHaveAttribute("aria-checked", "true");
});
