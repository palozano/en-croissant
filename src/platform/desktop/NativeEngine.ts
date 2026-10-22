import { commands, events, type BestMoves, type BestMovesPayload } from "@/bindings";
import type { EngineClient, EngineState } from "@/features/analysis/engine";
import { unwrap } from "@/utils/unwrap";
import type { LocalEngine } from "@/utils/engines";

export interface NativeEngineTransport {
    listen(callback: (payload: BestMovesPayload) => void): Promise<() => void>;
    search(
        engine: LocalEngine,
        tab: string,
        fen: string,
        depth: number,
    ): Promise<BestMoves[] | null>;
    kill(engine: LocalEngine, tab: string): Promise<void>;
}
const transport: NativeEngineTransport = {
    listen: (callback) => events.bestMovesPayload.listen(({ payload }) => callback(payload)),
    search: async (engine, tab, fen, depth) => {
        const result = unwrap(
            await commands.getBestMoves(
                engine.id,
                engine.path,
                tab,
                { t: "Depth", c: depth },
                {
                    fen,
                    moves: [],
                    extraOptions: [
                        { name: "MultiPV", value: "3" },
                        { name: "Hash", value: "32" },
                    ],
                },
            ),
        );
        return result?.[1] ?? null;
    },
    kill: async (engine, tab) => {
        unwrap(await commands.killEngine(engine.id, tab));
    },
};

interface Session {
    tab: string;
    fen: string;
    launched: boolean;
    settled: boolean;
    cancellation?: ReturnType<typeof setInterval>;
}

// Unique sessions prevent a late native result being applied to another search.
// getBestMoves stays pending for the lifetime of the native process, so stopping
// must never queue behind that promise. Retry kill during startup to cover the
// interval before Rust inserts the newly spawned process into its registry.
export class NativeEngine implements EngineClient {
    private session: Session | undefined;
    private disposed = false;
    private unlisten: (() => void) | undefined;
    private listening: Promise<void>;
    constructor(
        private engine: LocalEngine,
        private publish: (state: EngineState) => void,
        private io = transport,
    ) {
        publish({ status: "loading", lines: [] });
        this.listening = io
            .listen((payload) => {
                if (
                    this.disposed ||
                    payload.engine !== engine.id ||
                    payload.tab !== this.session?.tab ||
                    payload.fen !== this.session.fen ||
                    payload.moves.length
                )
                    return;
                this.results(payload.bestLines, payload.progress >= 100 ? "ready" : "searching");
            })
            .then((unlisten) => {
                if (this.disposed) unlisten();
                else this.unlisten = unlisten;
            });
        void this.listening.catch((error) => this.fail(error));
    }
    analyze(fen: string, depth = 18) {
        if (this.disposed) return;
        this.cancel(this.session);
        const session: Session = {
            fen,
            tab: `study-${crypto.randomUUID()}`,
            launched: false,
            settled: false,
        };
        this.session = session;
        this.publish({ status: "loading", lines: [] });
        void this.listening
            .then(async () => {
                if (this.disposed || this.session !== session) return;
                session.launched = true;
                this.publish({ status: "searching", lines: [] });
                const lines = await this.io.search(this.engine, session.tab, fen, depth);
                if (!this.disposed && this.session === session) {
                    if (lines) this.results(lines, "ready");
                    else this.fail("The engine process stopped. Try analyzing again.");
                }
            })
            .catch((error) => {
                if (this.session === session) this.fail(error);
            })
            .finally(() => {
                session.settled = true;
                clearInterval(session.cancellation);
            });
    }
    stop() {
        this.cancel(this.session);
        this.session = undefined;
        if (!this.disposed) this.publish({ status: "ready", lines: [] });
    }
    dispose() {
        this.disposed = true;
        this.stop();
        this.unlisten?.();
        this.unlisten = undefined;
    }
    private cancel(session?: Session) {
        if (!session?.launched || session.settled || session.cancellation) return;
        const kill = () => {
            void this.io.kill(this.engine, session.tab).catch((error) => {
                if (this.session === session) this.fail(error);
            });
        };
        kill();
        session.cancellation = setInterval(kill, 250);
    }
    private fail(error: unknown) {
        if (!this.disposed) this.publish({ status: "error", lines: [], error: String(error) });
    }
    private results(lines: BestMoves[], status: EngineState["status"]) {
        this.publish({
            status,
            lines: lines
                .map((line) => ({
                    depth: line.depth,
                    multipv: line.multipv,
                    pv: line.uciMoves,
                    score:
                        line.score.value.type === "mate"
                            ? `#${line.score.value.value}`
                            : `${line.score.value.value >= 0 ? "+" : ""}${(line.score.value.value / 100).toFixed(2)}`,
                }))
                .sort((a, b) => a.multipv - b.multipv),
        });
    }
}
