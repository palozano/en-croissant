import { test, expect } from "@playwright/test";

test("arrow keys navigate the active study while respecting editing and text fields", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
        name: "navigation.pgn",
        mimeType: "text/plain",
        buffer: Buffer.from(
            '[Event "Keyboard study"]\n\n1. e4 {First move} (1. d4 {Branch} d5 {Branch reply}) e5 {Second move} *',
        ),
    });
    const comments = page.getByLabel("Comments", { exact: true });
    const selected = page.locator(".move-tree-cell button.selected");
    await expect(page.getByLabel("Study title")).toHaveValue("Keyboard study");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("e4");
    await expect(comments).toHaveValue("First move");
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("e5");
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("e5");
    await page.keyboard.press("ArrowLeft");
    await expect(selected).toHaveText("e4");
    await comments.focus();
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("e4");
    await page.getByLabel("Study title").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(selected).toHaveText("e4");
    await page.getByLabel("Sort studies", { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("e4");
    await page.getByRole("button", { name: "d4", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("d5");
    await expect(comments).toHaveValue("Branch reply");
    await page.keyboard.press("Control+ArrowLeft");
    await expect(selected).toHaveText("d5");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const fen = page.locator(".web-fen input");
    const draftFen = await fen.inputValue();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await expect(fen).toHaveValue(draftFen);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(selected).toHaveText("d5");
    await page.getByRole("button", { name: "New study", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveCount(0);
    await page.locator(".web-study-list button").filter({ hasText: "Keyboard study" }).click();
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("e4");
    expect(errors).toEqual([]);
});

test("down enters variations and up returns from nested lines to the main line", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
        name: "variations.pgn",
        mimeType: "text/plain",
        buffer: Buffer.from(
            "1. e4 (1. d4 d5 2. c4 (2. Nf3 Nf6)) (1. c4 e5) e5 (1... c5 2. Nf3) 2. Nf3 *",
        ),
    });
    await expect(page.locator(".web-study-list button")).toHaveCount(2);
    const selected = page.locator(".move-tree-cell button.selected");
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveText("d4");
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveText("c4");
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveText("c4");
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveText("d4");
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("d5");
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveText("Nf3");
    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveText("Nf6");
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveText("c4");
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveText("e4");
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveText("e4");
    await page.getByLabel("Comments", { exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveText("e4");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const fen = page.locator(".web-fen input");
    const value = await fen.inputValue();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(fen).toHaveValue(value);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(selected).toHaveText("e4");
    expect(errors).toEqual([]);
});
