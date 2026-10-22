import { test, expect } from "@playwright/test";

test("notation folds variations, reveals keyboard selection and separates long comments", async ({
    page,
}) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
        name: "notation.pgn",
        mimeType: "text/plain",
        buffer: Buffer.from(
            `1. e4 e5 2. Nf3 (2. Bc4 {${"Develop the bishop. ".repeat(20)}} Bc5 3. d3 (3. Nc3 Nf6)) Nc6 3. Bb5 a6 *`,
        ),
    });
    const branch = page.getByRole("button", { name: "Alternative to 2.Nf3: 2.Bc4", exact: true });
    await expect(branch).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".move-tree-row").first()).toContainText("e5");
    await branch.click();
    await expect(branch).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Bc5", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Nf3", exact: true }).click();
    await page.keyboard.press("ArrowDown");
    await expect(branch).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator('.move-tree-cell[data-selected="true"]')).toHaveText("Bc4");
    const comment = page.locator("details.move-tree-comment");
    await expect(comment).not.toHaveAttribute("open", "");
    await comment.locator("summary").click();
    await expect(comment).toHaveAttribute("open", "");
    await page.getByRole("button", { name: "Bc5", exact: true }).click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('.move-tree-cell[data-selected="true"]')).toHaveText("Nf6");
    await expect(page.getByLabel("Current variation")).toHaveText("Principal › 2.Bc4 › 3.Nc3");
    const panel = await page.locator(".web-notation-scroll").boundingBox();
    const selected = await page.locator('.move-tree-cell[data-selected="true"]').boundingBox();
    expect(selected!.y).toBeGreaterThanOrEqual(panel!.y);
    expect(selected!.y + selected!.height).toBeLessThanOrEqual(panel!.y + panel!.height + 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
});
