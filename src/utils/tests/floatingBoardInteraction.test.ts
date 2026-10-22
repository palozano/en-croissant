import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@lichess-org/chessground/config";
import { INITIAL_FEN } from "chessops/fen";
import type { FloatingBoardSnapshot } from "../floatingBoardProtocol";

const api = vi.hoisted(() => ({
    set: vi.fn<(config: Config) => void>(),
    stop: vi.fn<() => void>(),
    redrawAll: vi.fn<() => void>(),
    destroy: vi.fn<() => void>(),
}));
const create = vi.hoisted(() => vi.fn<(element: HTMLElement, config: Config) => typeof api>());
vi.mock("@lichess-org/chessground", () => ({ Chessground: create }));

const channels: FakeChannel[] = [];
function currentChannel() {
    return channels.at(-1)!;
}
class FakeChannel {
    onmessage?: (event: MessageEvent<FloatingBoardSnapshot | null>) => void;
    postMessage = vi.fn<(data: unknown) => void>();
    close() {}
    constructor() {
        channels.push(this);
    }
}
function receive(overrides: Partial<FloatingBoardSnapshot> = {}) {
    currentChannel().onmessage?.({
        data: {
            revision: "position-1",
            config: {
                fen: INITIAL_FEN,
                viewOnly: false,
                movable: { color: "white", dests: new Map([["e2", ["e4"]]]) },
            },
            autoPromote: false,
            is3d: false,
            styles: {},
            pieceStylesheet: "/pieces/cburnett.css",
            ...overrides,
        },
    } as MessageEvent<FloatingBoardSnapshot>);
}
function move(from: "e2" | "a7", to: "e4" | "a8") {
    api.set.mock.calls.at(-1)![0].movable!.events!.after!(from, to, { premove: false });
}

describe("floating board interaction", () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.stubGlobal("BroadcastChannel", FakeChannel);
        create.mockReturnValue(api);
        document.body.innerHTML = '<div id="app"></div>';
        await import("../../floatingBoard");
    });
    afterEach(() => {
        window.dispatchEvent(new Event("unload"));
        vi.unstubAllGlobals();
    });

    it("binds drag handlers and sends moves for main-window confirmation", () => {
        expect(create.mock.calls[0][1].viewOnly).toBe(false);
        expect(currentChannel().postMessage).toHaveBeenCalledWith("ready");
        receive();
        move("e2", "e4");
        expect(api.stop).toHaveBeenCalled();
        expect(currentChannel().postMessage).toHaveBeenLastCalledWith({
            type: "move",
            revision: "position-1",
            from: "e2",
            to: "e4",
        });
        receive({
            revision: "locked",
            config: { fen: INITIAL_FEN, viewOnly: true, movable: { color: "white" } },
        });
        expect(api.set.mock.calls.at(-1)![0].movable?.color).toBeUndefined();
    });

    it("chooses an underpromotion inside the floating window", () => {
        receive({ config: { fen: "7k/P7/8/8/8/8/8/7K w - - 0 1", movable: { color: "white" } } });
        move("a7", "a8");
        const knight = document.querySelector<HTMLButtonElement>('button[aria-label="knight"]');
        expect(knight).not.toBeNull();
        knight!.click();
        expect(currentChannel().postMessage).toHaveBeenLastCalledWith({
            type: "move",
            revision: "position-1",
            from: "a7",
            to: "a8",
            promotion: "knight",
        });
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("cancels pending promotion when the main position changes", () => {
        receive({ config: { fen: "7k/P7/8/8/8/8/8/7K w - - 0 1", movable: { color: "white" } } });
        move("a7", "a8");
        receive({ revision: "position-2" });
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(currentChannel().postMessage).toHaveBeenCalledTimes(1);
    });
});
