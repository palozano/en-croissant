import { test, expect } from "@playwright/test";

test("study dates and import origins survive reload and support sorting", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://example.com/remote.pgn", (route) =>
        route.fulfill({
            contentType: "application/x-chess-pgn",
            body: '[Event "Remote study"]\n\n1. d4 *',
        }),
    );
    await page.route("https://lichess.org/api/study/AbCd1234.pgn?*", (route) =>
        route.fulfill({
            contentType: "application/x-chess-pgn",
            body: '[Event "Lichess study"]\n\n1. c4 *',
        }),
    );
    await page.goto("/");
    const metadata = page.getByLabel("Study metadata");
    await expect(metadata).toContainText("Origin: Manual");
    await page.locator('input[type="file"]').setInputFiles({
        name: "local-study.pgn",
        mimeType: "text/plain",
        buffer: Buffer.from('[Event "Local study"]\n\n1. e4 *'),
    });
    await expect(metadata).toContainText("local-study.pgn");
    const originalDate = await metadata.locator("time").getAttribute("datetime");
    await page.getByRole("button", { name: "Load PGN", exact: true }).click();
    await page.getByLabel("PGN URL", { exact: true }).fill("https://example.com/remote.pgn");
    await page.getByRole("button", { name: "Download and import", exact: true }).click();
    await expect(metadata.getByRole("link")).toHaveAttribute(
        "href",
        "https://example.com/remote.pgn",
    );
    await page.getByRole("button", { name: "Import Lichess", exact: true }).click();
    await page.getByLabel("Lichess study link").fill("lichess.org/study/AbCd1234");
    await page.getByRole("button", { name: "Import study", exact: true }).click();
    await expect(metadata.getByRole("link")).toHaveAttribute(
        "href",
        "https://lichess.org/study/AbCd1234",
    );
    await page.reload();
    const titles = page.locator(".web-study-list button > span");
    await expect(titles).toHaveText(["Lichess study", "Remote study", "Local study", "Study 1"]);
    await page.getByLabel("Sort studies", { exact: true }).selectOption("oldest");
    await expect(titles).toHaveText(["Study 1", "Local study", "Remote study", "Lichess study"]);
    await page.getByLabel("Sort studies", { exact: true }).selectOption("source");
    await expect(titles).toHaveText(["Lichess study", "Local study", "Study 1", "Remote study"]);
    await page.locator(".web-study-list button").filter({ hasText: "Local study" }).click();
    await expect(metadata).toContainText("Origin: Local PGN");
    await expect(metadata).toContainText("local-study.pgn");
    await expect(metadata.locator("time")).toHaveAttribute("datetime", originalDate!);
    expect(errors).toEqual([]);
});
