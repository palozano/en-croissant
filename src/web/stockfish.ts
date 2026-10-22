import type { EngineClient, EngineLine, EngineState } from "@/features/analysis/engine";
export type { EngineLine, EngineState } from "@/features/analysis/engine";
export function parseEngineLine(line: string, blackToMove: boolean): EngineLine | null {
    const depth = /\bdepth (\d+)/.exec(line);
    const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
    const pv = /\bpv (.+)/.exec(line);
    if (!depth || !score || !pv) return null;
    const value = Number(score[2]) * (blackToMove ? -1 : 1);
    return {
        depth: Number(depth[1]),
        multipv: Number(/\bmultipv (\d+)/.exec(line)?.[1] ?? 1),
        score:
            score[1] === "mate"
                ? `#${value}`
                : `${value >= 0 ? "+" : ""}${(value / 100).toFixed(2)}`,
        pv: pv[1].trim().split(/\s+/),
    };
}

// Only one search runs at a time. Wait for bestmove before changing position so
// output from an interrupted search can never be attributed to the next one.
export class BrowserStockfish implements EngineClient {
    private worker: Worker;
    private ready = false;
    private active: { fen: string; depth: number } | undefined;
    private desired: { fen: string; depth: number } | undefined;
    private lines: EngineLine[] = [];
    private startupTimer: ReturnType<typeof setTimeout>;
    private disposed = false;
    constructor(
        private publish: (state: EngineState) => void,
        createWorker = () =>
            new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`),
    ) {
        this.publish({ status: "loading", lines: [] });
        this.worker = createWorker();
        this.worker.onmessage = ({ data }: MessageEvent<string>) => this.receive(String(data));
        this.worker.onerror = () =>
            this.fail("Could not load Stockfish. Check your connection and try again.");
        this.worker.onmessageerror = () => this.fail("Could not communicate with Stockfish.");
        this.startupTimer = setTimeout(
            () => this.fail("Stockfish did not respond. Please try again."),
            30000,
        );
        this.worker.postMessage("uci");
    }
    analyze(fen: string, depth = 18) {
        if (this.disposed) return;
        this.desired = { fen, depth };
        if (this.active) this.worker.postMessage("stop");
        else this.start();
    }
    stop() {
        this.desired = undefined;
        if (this.active) this.worker.postMessage("stop");
        this.lines = [];
        if (!this.disposed) this.publish({ status: this.ready ? "ready" : "loading", lines: [] });
    }
    dispose() {
        this.disposed = true;
        clearTimeout(this.startupTimer);
        this.worker.terminate();
    }
    private fail(error: string) {
        this.dispose();
        this.publish({ status: "error", lines: [], error });
    }
    private start() {
        if (!this.ready || !this.desired || this.active || this.disposed) return;
        this.active = this.desired;
        this.lines = [];
        this.publish({ status: "searching", lines: [] });
        this.worker.postMessage(`position fen ${this.active.fen}`);
        this.worker.postMessage(`go depth ${this.active.depth}`);
    }
    private receive(line: string) {
        if (this.disposed) return;
        if (line === "uciok") {
            this.worker.postMessage("setoption name Hash value 32");
            this.worker.postMessage("setoption name MultiPV value 3");
            this.worker.postMessage("isready");
        } else if (line === "readyok") {
            clearTimeout(this.startupTimer);
            this.ready = true;
            this.publish({ status: "ready", lines: [] });
            this.start();
        } else if (line.startsWith("bestmove")) {
            const finished = this.active;
            this.active = undefined;
            if (this.desired !== finished) this.start();
            else this.publish({ status: "ready", lines: this.lines });
        } else if (this.active && this.active === this.desired && line.startsWith("info ")) {
            const result = parseEngineLine(line, this.active.fen.split(" ")[1] === "b");
            if (result) {
                this.lines = [
                    ...this.lines.filter((value) => value.multipv !== result.multipv),
                    result,
                ].sort((a, b) => a.multipv - b.multipv);
                this.publish({ status: "searching", lines: this.lines });
            }
        }
    }
}
