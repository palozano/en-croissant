import { afterEach, describe, expect, it, vi } from "vitest";
import { INITIAL_FEN } from "chessops/fen";
import { BrowserStockfish, parseEngineLine, type EngineState } from "./stockfish";
class FakeWorker {
    onmessage?: (event: MessageEvent<string>) => void;
    onerror?: () => void;
    postMessage = vi.fn<(command: string) => void>();
    terminate = vi.fn<() => void>();
    emit(data: string) {
        this.onmessage?.({ data } as MessageEvent<string>);
    }
}
afterEach(() => vi.useRealTimers());
describe("browser Stockfish protocol", () => {
    it("converts scores to white's perspective and parses mate scores", () => {
        expect(parseEngineLine("info depth 12 multipv 2 score cp 35 pv e7e5", true)).toMatchObject({
            depth: 12,
            multipv: 2,
            score: "-0.35",
        });
        expect(parseEngineLine("info depth 5 score mate -3 pv e2e4", false)?.score).toBe("#-3");
        expect(parseEngineLine("info string network loaded", false)).toBeNull();
    });
    it("waits for engine readiness and ignores stale output until bestmove", () => {
        vi.useFakeTimers();
        const worker = new FakeWorker();
        const states: EngineState[] = [];
        const engine = new BrowserStockfish(
            (value) => states.push(value),
            () => worker as unknown as Worker,
        );
        engine.analyze(INITIAL_FEN);
        expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith("uci");
        worker.emit("uciok");
        worker.emit("readyok");
        expect(worker.postMessage).toHaveBeenLastCalledWith("go depth 18");
        engine.analyze(INITIAL_FEN.replace(" w ", " b "));
        expect(worker.postMessage).toHaveBeenLastCalledWith("stop");
        worker.emit("info depth 10 score cp 900 pv e2e4");
        expect(states.at(-1)?.lines).toEqual([]);
        worker.emit("bestmove e2e4");
        expect(worker.postMessage).toHaveBeenCalledWith(
            `position fen ${INITIAL_FEN.replace(" w ", " b ")}`,
        );
        worker.emit("info depth 10 score cp 20 pv e7e5");
        expect(states.at(-1)?.lines[0].score).toBe("-0.20");
        engine.dispose();
        expect(worker.terminate).toHaveBeenCalledOnce();
    });
    it("times out failed startup and releases the worker", () => {
        vi.useFakeTimers();
        const worker = new FakeWorker();
        const states: EngineState[] = [];
        new BrowserStockfish(
            (value) => states.push(value),
            () => worker as unknown as Worker,
        );
        vi.advanceTimersByTime(30000);
        expect(states.at(-1)?.status).toBe("error");
        expect(worker.terminate).toHaveBeenCalledOnce();
    });
});
