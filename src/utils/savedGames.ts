import type { GameConfig, GameState, GameStatus, PlayerConfig } from "@/bindings";
import type { OpponentSettings } from "@/components/boards/OpponentForm";
import { createStudy, exportStudy, importStudies, type StudyNode } from "@/features/studies/model";

export interface SavedGame {
    version: number;
    id: string;
    startedAt: number;
    updatedAt: number;
    config: GameConfig & { sourcePgn?: string | null };
    state: GameState;
}
export interface SavedGameSummary {
    id: string;
    startedAt: number;
    updatedAt: number;
    white: string;
    black: string;
    status: GameStatus;
    ply: number;
    activeGameId: string | null;
    humanColor?: "white" | "black" | null;
}
export function savedGameResult(status: GameStatus): "*" | "1-0" | "0-1" | "1/2-1/2" {
    if (status === "playing") return "*";
    return status.finished.result.type === "whiteWins"
        ? "1-0"
        : status.finished.result.type === "blackWins"
          ? "0-1"
          : "1/2-1/2";
}
export function savedGamePgn(game: SavedGame): string {
    const study = createStudy("Saved game", game.state.initialFen);
    const whiteEngine = game.config.white.type === "engine";
    const blackEngine = game.config.black.type === "engine";
    study.title =
        whiteEngine && blackEngine
            ? "Engine Match"
            : whiteEngine || blackEngine
              ? "Player vs Engine"
              : "Player Match";
    const date = new Date(Number(game.startedAt)).toISOString();
    study.headers = [
        ["Event", study.title],
        ["Site", "Schaak"],
        ["White", game.state.whitePlayer],
        ["Black", game.state.blackPlayer],
        ["Date", date.slice(0, 10).replaceAll("-", ".")],
        ["UTCTime", date.slice(11, 19)],
        ["Result", savedGameResult(game.state.status)],
        [
            "Orientation",
            game.config.white.type === "engine" && game.config.black.type === "human"
                ? "black"
                : "white",
        ],
    ];
    const timeControl = (time: GameConfig["whiteTimeControl"]) =>
        time ? `${Number(time.initialTime) / 1000}+${Number(time.increment) / 1000}` : "-";
    const whiteTime = timeControl(game.config.whiteTimeControl);
    const blackTime = timeControl(game.config.blackTimeControl);
    if (whiteTime === blackTime) study.headers.push(["TimeControl", whiteTime]);
    else study.headers.push(["WhiteTimeControl", whiteTime], ["BlackTimeControl", blackTime]);
    if (game.state.status !== "playing")
        study.headers.push(["Termination", game.state.status.finished.result.reason]);
    let source: ReturnType<typeof importStudies>[number] | undefined;
    try {
        if (game.config.sourcePgn) source = importStudies(game.config.sourcePgn)[0];
    } catch {
        // The complete source remains in the archive. Unsupported source PGN
        // must not prevent recovering the actual game and its native move list.
    }
    if (source) {
        const headers = new Map(source.headers);
        for (const [key, value] of study.headers) headers.set(key, value);
        study.headers = [...headers];
        if (source.root.fen === study.root.fen) study.root.comments = [...source.root.comments];
    }
    let sourceNode = source?.root.fen === study.root.fen ? source.root : undefined;
    let parent = study.root;
    let whiteToMove = game.state.initialFen.split(" ")[1] === "w";
    for (const move of game.state.moves) {
        const clock = whiteToMove ? move.whiteTime : move.blackTime;
        const seconds = clock === null ? null : Number(clock) / 1000;
        const node: StudyNode = {
            fen: move.fenAfter,
            san: move.san,
            children: [],
            comments:
                seconds === null
                    ? []
                    : [
                          `[%clk ${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${(seconds % 60).toFixed(3).padStart(6, "0")}]`,
                      ],
        };
        sourceNode = sourceNode?.children.find((child) => child.fen === node.fen);
        if (sourceNode) {
            node.nags = sourceNode.nags;
            node.startingComments = sourceNode.startingComments;
            node.comments.unshift(
                ...sourceNode.comments
                    .map((comment) => comment.replace(/\[%clk[^\]]*\]/g, " ").trim())
                    .filter(Boolean),
            );
        }
        parent.children.push(node);
        parent = node;
        whiteToMove = !whiteToMove;
    }
    return exportStudy(study);
}
export function savedGamePlayers(config: GameConfig): {
    white: OpponentSettings;
    black: OpponentSettings;
} {
    const player = (
        value: PlayerConfig,
        time: GameConfig["whiteTimeControl"],
    ): OpponentSettings => {
        const timeControl = time
            ? { seconds: Number(time.initialTime), increment: Number(time.increment) }
            : undefined;
        if (value.type === "human") return { type: "human", name: value.name, timeControl };
        return {
            type: "engine",
            timeControl,
            go: value.go ?? { t: "Depth", c: 20 },
            engine: {
                type: "local",
                id: value.path,
                name: value.name,
                path: value.path,
                version: "",
                settings: value.options,
            },
            engineSettings: value.options,
        };
    };
    return {
        white: player(config.white, config.whiteTimeControl),
        black: player(config.black, config.blackTimeControl),
    };
}
