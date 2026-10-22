import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getByLabel: vi.fn<() => Promise<unknown>>(),
    create: vi.fn<(label: string, options: unknown) => void>(),
}));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
    WebviewWindow: class {
        static getByLabel = mocks.getByLabel;
        constructor(label: string, options: unknown) {
            mocks.create(label, options);
        }
        once(event: string, callback: (event: { payload: string }) => void) {
            if (event === "tauri://created") callback({ payload: "" });
            return Promise.resolve(() => {});
        }
    },
}));
import { openFloatingBoard } from "../floatingBoard";

describe("floating board window", () => {
    beforeEach(() => vi.clearAllMocks());

    it("focuses an existing window instead of creating another", async () => {
        const existing = { show: vi.fn<() => void>(), setFocus: vi.fn<() => void>() };
        mocks.getByLabel.mockResolvedValue(existing);
        await openFloatingBoard();
        expect(existing.show).toHaveBeenCalledOnce();
        expect(existing.setFocus).toHaveBeenCalledOnce();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("coalesces simultaneous opens into one always-on-top window", async () => {
        mocks.getByLabel.mockResolvedValue(null);
        await Promise.all([openFloatingBoard(), openFloatingBoard()]);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
            "floating-board",
            expect.objectContaining({ alwaysOnTop: true, url: "index.html?floating-board" }),
        );
    });

    it("allows retrying after a lookup failure", async () => {
        mocks.getByLabel.mockRejectedValueOnce(new Error("unavailable"));
        await expect(openFloatingBoard()).rejects.toThrow("unavailable");
        mocks.getByLabel.mockResolvedValue(null);
        await openFloatingBoard();
        expect(mocks.create).toHaveBeenCalledOnce();
    });
});
