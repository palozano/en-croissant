import { test, expect } from "@playwright/test";

test("studies survive reload and export comments and variations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.getByLabel("Study title").fill("Mi estudio web");
    await page.getByLabel("Comments", { exact: true }).fill("Un estudio guardado sin servidor.");
    await expect(page.getByRole("status")).toHaveText("Saved in this browser");
    await page.reload();
    await expect(page.getByLabel("Study title")).toHaveValue("Mi estudio web");
    await expect(page.getByLabel("Comments", { exact: true })).toHaveValue(
        "Un estudio guardado sin servidor.",
    );
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PGN", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("Mi estudio web.pgn");
    expect(errors).toEqual([]);
});

test("imports legal variations and Stockfish analyzes inside a real WASM worker", async ({
    page,
}) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
        name: "test.pgn",
        mimeType: "text/plain",
        buffer: Buffer.from('[Event "Importado"]\n\n1. e4 {Comentario} (1. d4 d5) e5 2. Nf3 *'),
    });
    await expect(page.getByLabel("Study title")).toHaveValue("Importado");
    await expect(page.getByRole("button", { name: "e4", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "d4", exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Best move" })).toHaveCount(0);
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(page.locator(".web-engine-line").first()).toBeVisible({ timeout: 30000 });
    const bestMoveToggle = page.getByRole("switch", { name: "Best move" });
    const arrows = page.locator(".web-board svg.cg-shapes g line");
    await expect(bestMoveToggle).not.toBeChecked();
    await expect(arrows).toHaveCount(0);
    await bestMoveToggle.check();
    await expect(arrows).toHaveCount(1);
    await bestMoveToggle.uncheck();
    await expect(arrows).toHaveCount(0);
    await bestMoveToggle.check();
    await page.getByRole("button", { name: "e4", exact: true }).click();
    await expect(page.getByLabel("Comments", { exact: true })).toHaveValue("Comentario");
    await expect(page.locator(".web-engine-line").first()).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Stop analysis", exact: true }).click();
    await expect(page.locator(".web-engine-line")).toHaveCount(0);
    await expect(arrows).toHaveCount(0);
    await expect(bestMoveToggle).toHaveCount(0);
});

test("editor toggles empty and initial boards and creates a separate study", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Empty board", exact: true }).click();
    await expect(page.locator(".web-board piece:not(.ghost)")).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Create study from this position" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Initial board", exact: true }).click();
    await expect(page.locator(".web-board piece:not(.ghost)")).toHaveCount(32);
    await page.getByRole("button", { name: "Create study from this position" }).click();
    await expect(page.getByLabel("Study title")).toHaveValue("Study 2");
    await expect(page.locator(".web-study-list button")).toHaveCount(2);
});

test("downloaded application and engine run offline", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller)
            await new Promise<void>((resolve) =>
                navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
                    once: true,
                }),
            );
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByLabel("Study title")).toBeVisible();
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(page.locator(".web-engine-line").first()).toBeVisible({ timeout: 30000 });
});

test("moves pieces on the board and edits a position by dragging pieces off-board", async ({
    page,
}) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    const board = page.locator(".web-board cg-board");
    const square = async (file: number, rank: number) => {
        const bounds = (await board.boundingBox())!;
        return {
            x: bounds.x + (bounds.width * (file + 0.5)) / 8,
            y: bounds.y + (bounds.height * (7 - rank + 0.5)) / 8,
        };
    };
    const e2 = await square(4, 1);
    const e4 = await square(4, 3);
    await page.mouse.click(e2.x, e2.y);
    await page.mouse.click(e4.x, e4.y);
    await expect(page.getByRole("button", { name: "e4", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const a2 = await square(0, 1);
    const bounds = (await board.boundingBox())!;
    await page.mouse.move(a2.x, a2.y);
    await page.mouse.down();
    await page.mouse.move(bounds.x - 20, a2.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator(".web-board piece:not(.ghost)")).toHaveCount(31);
    await page.getByRole("button", { name: "white knight", exact: true }).click();
    const a3 = await square(0, 2);
    await page.mouse.click(a3.x, a3.y);
    await expect(page.locator(".web-board piece:not(.ghost)")).toHaveCount(32);
    await page.getByRole("button", { name: "Create study from this position" }).click();
    await expect(page.getByLabel("Study title")).toBeVisible();
});

test("works on a mobile viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: "/tmp/schaak-web-mobile.png", fullPage: true });
});

test("editor restores the board after a material-invalid drag", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const before = await page.locator(".web-fen input").inputValue();
    const bounds = (await page.locator(".web-board cg-board").boundingBox())!;
    const x = bounds.x + (bounds.width * 2.5) / 8;
    const fromY = bounds.y + (bounds.height * 7.5) / 8;
    const toY = bounds.y + (bounds.height * 4.5) / 8;
    await page.mouse.move(x, fromY);
    await page.mouse.down();
    await page.mouse.move(x, toY, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("alert")).toContainText("promotions");
    await expect(page.locator(".web-fen input")).toHaveValue(before);
    await expect
        .poll(() =>
            page
                .locator(".web-board piece.white.bishop")
                .evaluateAll((elements) =>
                    elements
                        .map((element) => (element as HTMLElement & { cgKey: string }).cgKey)
                        .sort(),
                ),
        )
        .toEqual(["c1", "f1"]);
});

test("stale edits in another tab show an error and preserve the saved study", async ({
    page,
    context,
}) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    const second = await context.newPage();
    await second.goto("/");
    await expect(second.getByLabel("Study title")).toBeVisible();
    await page.getByLabel("Study title").fill("Versión guardada");
    await expect(page.getByRole("status")).toHaveText("Saved in this browser");
    await second.getByLabel("Study title").fill("Versión antigua");
    await expect(second.getByRole("alert")).toContainText("another tab");
    await page.reload();
    await expect(page.getByLabel("Study title")).toHaveValue("Versión guardada");
});

test("palette icons match the color of pieces placed on the board", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Empty board", exact: true }).click();
    const bounds = (await page.locator(".web-board cg-board").boundingBox())!;
    for (const [color, file, rank] of [
        ["white", 0, 2],
        ["black", 7, 5],
    ] as const) {
        const button = page.getByRole("button", { name: `${color} knight`, exact: true });
        await button.click();
        await page.mouse.click(
            bounds.x + (bounds.width * (file + 0.5)) / 8,
            bounds.y + (bounds.height * (7 - rank + 0.5)) / 8,
        );
        const piece = page.locator(`.web-board piece.${color}.knight:not(.ghost)`);
        await expect(piece).toHaveCount(1);
        const iconImage = await button
            .locator("span")
            .evaluate((element) => getComputedStyle(element).backgroundImage);
        expect(iconImage).not.toBe("none");
        expect(await piece.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(
            iconImage,
        );
    }
    await expect(page.locator(".web-fen input")).toHaveValue("8/8/7n/8/8/N7/8/8 w - - 0 1");
});

test("saves an edited starting position in the same study with one FEN field", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toHaveValue("Study 1");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("FEN", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Import FEN position", { exact: true })).toHaveCount(0);
    await page.getByLabel("FEN", { exact: true }).fill("7k/8/8/8/8/8/8/K7 w - - 0 1");
    await page.getByRole("button", { name: "Apply FEN", exact: true }).click();
    await page.getByRole("button", { name: "Save current study", exact: true }).click();
    await expect(page.getByLabel("Study title")).toHaveValue("Study 1");
    await expect(page.locator(".web-study-list button")).toHaveCount(1);
    await page.getByRole("button", { name: "Starting position", exact: true }).click();
    await expect(page.getByLabel("FEN", { exact: true })).toHaveValue(
        "7k/8/8/8/8/8/8/K7 w - - 0 1",
    );
    await page.reload();
    await expect(page.getByLabel("FEN", { exact: true })).toHaveValue(
        "7k/8/8/8/8/8/8/K7 w - - 0 1",
    );
});

test("presentation popup mirrors the active position and orientation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Study title")).toBeVisible();
    const popupEvent = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Present", exact: true }).click();
    const popup = await popupEvent;
    await expect(popup.locator(".presentation-board")).toBeVisible();
    await expect(popup.locator("piece:not(.ghost)")).toHaveCount(32);
    await page.getByRole("button", { name: "Flip", exact: true }).click();
    await expect(popup.locator(".presentation-board")).toHaveClass(/orientation-black/);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Empty board", exact: true }).click();
    await expect(popup.locator("piece:not(.ghost)")).toHaveCount(0);
    await popup.reload();
    await expect(popup.locator(".presentation-board")).toBeVisible();
    await page.getByRole("button", { name: "Initial board", exact: true }).click();
    await expect(popup.locator("piece:not(.ghost)")).toHaveCount(32);
    await page.close();
    await expect(popup.getByRole("status")).toContainText("Waiting for the study window");
});

test("resizes from the corner, remembers the size and resets with double click", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const board = page.locator(".web-board");
    const handle = page.getByRole("button", { name: "Resize board", exact: true });
    await expect(page.getByLabel("Study title")).toBeVisible();
    await expect(page.locator('input[type="range"]')).toHaveCount(0);
    const column = (await page.locator(".web-board-column").boundingBox())!;
    const initial = (await board.boundingBox())!.width;
    expect(Math.abs(initial - column.width)).toBeLessThan(1);
    const corner = (await handle.boundingBox())!;
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x + corner.width / 2 - 80, corner.y + corner.height / 2 - 160, {
        steps: 10,
    });
    await page.mouse.up();
    await expect.poll(async () => (await board.boundingBox())!.width).toBeLessThan(initial * 0.8);
    const resized = (await board.boundingBox())!.width;
    await page.reload();
    await expect(handle).toBeVisible();
    await expect
        .poll(async () => Math.round((await board.boundingBox())!.width))
        .toBe(Math.round(resized));
    await handle.dblclick();
    await expect
        .poll(async () => Math.round((await board.boundingBox())!.width))
        .toBe(Math.round(initial));
    await handle.focus();
    await page.keyboard.press("Home");
    await expect.poll(async () => (await board.boundingBox())!.width).toBeLessThan(initial * 0.6);
    await page.keyboard.press("End");
    await expect
        .poll(async () => Math.round((await board.boundingBox())!.width))
        .toBe(Math.round(initial));
    // The maximum follows the column edges even in a shorter window.
    await page.setViewportSize({ width: 1440, height: 600 });
    await expect
        .poll(async () => Math.round((await board.boundingBox())!.width))
        .toBe(Math.round(column.width));
    const fullBoard = (await board.boundingBox())!;
    expect(Math.abs(fullBoard.x - column.x)).toBeLessThan(1);
    expect(Math.abs(fullBoard.x + fullBoard.width - column.x - column.width)).toBeLessThan(1);
});

test("imports all Lichess chapters and preserves annotations after reload", async ({ page }) => {
    const requested: string[] = [];
    await page.route("https://lichess.org/api/study/AbCd1234.pgn?*", async (route) => {
        requested.push(route.request().url());
        await route.fulfill({
            contentType: "application/x-chess-pgn",
            body: '[Event "Lichess study: First"]\n[StudyName "Lichess study"]\n[ChapterName "First"]\n\n1. e4 {A useful idea} (1. d4 d5) e5 *\n\n[Event "Lichess study: Second"]\n\n1. c4 *',
        });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Import Lichess", exact: true }).click();
    await page
        .getByLabel("Lichess study link")
        .fill("https://lichess.org/study/AbCd1234/ZyXw9876#10");
    await page.getByRole("button", { name: "Import study", exact: true }).click();
    await expect(page.getByLabel("Study title")).toHaveValue("Lichess study: First");
    await expect(page.locator(".web-study-list button")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "d4", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "e4", exact: true }).click();
    await expect(page.getByLabel("Comments", { exact: true })).toHaveValue("A useful idea");
    expect(requested).toHaveLength(1);
    expect(new URL(requested[0]).searchParams.get("variations")).toBe("true");
    await page.reload();
    await expect(page.locator(".web-study-list button")).toHaveCount(3);
});

test("imports one linked chapter and explains a private/unavailable study without losing local studies", async ({
    page,
}) => {
    await page.route("https://lichess.org/api/study/AbCd1234/ZyXw9876.pgn?*", (route) =>
        route.fulfill({
            contentType: "application/x-chess-pgn",
            body: '[Event "Only this chapter"]\n\n1. Nf3 *',
        }),
    );
    await page.route("https://lichess.org/api/study/AbCd1234.pgn?*", (route) =>
        route.fulfill({ status: 403, body: "Forbidden" }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Import Lichess", exact: true }).click();
    await page.getByLabel("Lichess study link").fill("lichess.org/study/AbCd1234/ZyXw9876");
    await page.getByLabel("Lichess import scope", { exact: true }).selectOption("chapter");
    await page.getByRole("button", { name: "Import study", exact: true }).click();
    await expect(page.getByLabel("Study title")).toHaveValue("Only this chapter");
    await expect(page.locator(".web-study-list button")).toHaveCount(2);
    await page.getByRole("button", { name: "Import Lichess", exact: true }).click();
    await page.getByLabel("Lichess study link").fill("https://lichess.org/study/AbCd1234");
    await page.getByRole("button", { name: "Import study", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("public study with downloads enabled");
    await expect(page.locator(".web-study-list button")).toHaveCount(2);
});

test("delete-all requires confirmation and leaves only a new blank study after reload", async ({
    page,
}) => {
    await page.goto("/");
    await page.getByLabel("Study title").fill("Keep until confirmed");
    await page.getByRole("button", { name: "New study", exact: true }).click();
    await page.getByLabel("Study title").fill("Another saved study");
    await expect(page.getByRole("status")).toHaveText("Saved in this browser");
    const removeAll = page.getByRole("button", { name: "Delete all studies", exact: true });
    await expect(
        page.locator(".web-header nav").getByRole("button", { name: "Delete all studies" }),
    ).toBeVisible();
    page.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain("cannot be undone");
        await dialog.dismiss();
    });
    await removeAll.click();
    await expect(page.locator(".web-study-list button")).toHaveCount(2);
    page.once("dialog", (dialog) => dialog.accept());
    await removeAll.click();
    await expect(page.locator(".web-study-list button")).toHaveCount(1);
    await expect(page.getByLabel("Study title")).toHaveValue("Study 1");
    await expect(page.getByLabel("Comments", { exact: true })).toHaveValue("");
    await page.reload();
    await expect(page.locator(".web-study-list button")).toHaveCount(1);
    await expect(page.getByLabel("Study title")).toHaveValue("Study 1");
    await expect(
        page.getByRole("button", { name: "Keep until confirmed", exact: true }),
    ).toHaveCount(0);
});

test("initial board fits the visible height and can still expand to the column edges", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 650 });
    await page.goto("/");
    const board = page.locator(".web-board");
    await expect(page.getByLabel("Study title")).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = (await board.boundingBox())!;
            return Math.round(bounds.y + bounds.height);
        })
        .toBe(634);
    await page.setViewportSize({ width: 1600, height: 750 });
    await expect
        .poll(async () => {
            const bounds = (await board.boundingBox())!;
            return Math.round(bounds.y + bounds.height);
        })
        .toBe(734);
    await page.getByRole("button", { name: "Resize board", exact: true }).dblclick();
    const column = (await page.locator(".web-board-column").boundingBox())!;
    await expect
        .poll(async () => Math.round((await board.boundingBox())!.width))
        .toBe(Math.round(column.width));
});
