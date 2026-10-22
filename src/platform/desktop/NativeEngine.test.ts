import { afterEach, expect, test, vi } from "vitest";
import type { BestMovesPayload } from "@/bindings";
import type { EngineState } from "@/features/analysis/engine";
import { NativeEngine, type NativeEngineTransport } from "./NativeEngine";

afterEach(() => vi.useRealTimers());
test("native searches filter stale events, cancel during startup, and release listeners", async () => {
    vi.useFakeTimers();
    let receive!: (payload: BestMovesPayload) => void;
    const sessions = new Map<string, () => void>();
    const unlisten = vi.fn<() => void>();
    const io: NativeEngineTransport = {
        listen: async (callback) => {
            receive = callback;
            return unlisten;
        },
        search: vi.fn<NativeEngineTransport["search"]>(
            (_engine, tab) =>
                new Promise<null>((resolve) => sessions.set(tab, () => resolve(null))),
        ),
        kill: vi.fn<NativeEngineTransport["kill"]>(async () => {}),
    };
    const states: EngineState[] = [];
    const engine = new NativeEngine(
        { id: "sf", name: "Stockfish", path: "/sf", type: "local", version: "19" },
        (value) => states.push(value),
        io,
    );
    engine.analyze("first");
    await vi.advanceTimersByTimeAsync(0);
    const first = [...sessions.keys()][0];
    engine.analyze("second");
    await vi.advanceTimersByTimeAsync(0);
    const second = [...sessions.keys()][1];
    const payload: BestMovesPayload = {
        engine: "sf",
        tab: first,
        fen: "first",
        moves: [],
        progress: 50,
        bestLines: [
            {
                depth: 12,
                multipv: 1,
                nodes: 1,
                nps: 1,
                uciMoves: ["e7e5"],
                sanMoves: ["e5"],
                score: { value: { type: "cp", value: -25 }, wdl: null },
            },
        ],
    };
    receive(payload);
    expect(states.at(-1)?.lines).toEqual([]);
    receive({ ...payload, tab: second, fen: "second" });
    expect(states.at(-1)?.lines[0].score).toBe("-0.25");
    await vi.advanceTimersByTimeAsync(250);
    expect(io.kill).toHaveBeenCalledWith(expect.anything(), first);
    sessions.get(first)!();
    await vi.advanceTimersByTimeAsync(0);
    engine.dispose();
    expect(unlisten).toHaveBeenCalledOnce();
    sessions.get(second)!();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
});
