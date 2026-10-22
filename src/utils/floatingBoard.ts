import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let opening: Promise<void> | undefined;

export function openFloatingBoard(): Promise<void> {
    if (opening) return opening;
    opening = (async () => {
        const existing = await WebviewWindow.getByLabel("floating-board");
        if (existing) {
            await existing.show();
            await existing.setFocus();
            return;
        }
        await new Promise<void>((resolve, reject) => {
            const window = new WebviewWindow("floating-board", {
                url: "index.html?floating-board",
                title: "Schaak — Board",
                width: 520,
                height: 540,
                minWidth: 240,
                minHeight: 260,
                alwaysOnTop: true,
            });
            void window.once("tauri://created", () => resolve());
            void window.once("tauri://error", ({ payload }) => reject(new Error(String(payload))));
        });
    })().finally(() => {
        opening = undefined;
    });
    return opening;
}
