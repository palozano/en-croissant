import type { Config } from "@lichess-org/chessground/config";
import { parseSquare, type SquareName, type NormalMove } from "chessops";
import { positionFromFen } from "./chessops";

export const FLOATING_BOARD_CHANNEL = "schaak-floating-board";

export interface FloatingBoardSnapshot {
    revision: string;
    config: Config;
    autoPromote: boolean;
    is3d: boolean;
    pieceStylesheet: string;
    styles: Record<string, string>;
}

export interface FloatingBoardMoveRequest {
    type: "move";
    revision: string;
    from: string;
    to: string;
    promotion?: "queen" | "rook" | "bishop" | "knight";
}

// The main board remains authoritative, including when the floating window is stale.
export function getFloatingBoardMove(
    snapshot: FloatingBoardSnapshot | null,
    request: unknown,
): NormalMove | undefined {
    if (!snapshot || !request || typeof request !== "object") return;
    const data = request as Partial<FloatingBoardMoveRequest>;
    const { config } = snapshot;
    if (
        data.type !== "move" ||
        data.revision !== snapshot.revision ||
        config.viewOnly ||
        config.movable?.free
    )
        return;
    if (typeof data.from !== "string" || typeof data.to !== "string") return;
    const from = parseSquare(data.from);
    const to = parseSquare(data.to);
    if (from === undefined || to === undefined || !config.fen) return;
    const [position] = positionFromFen(config.fen);
    const piece = position?.board.get(from);
    if (!position || !piece || !config.movable?.color) return;
    if (config.movable.color !== "both" && config.movable.color !== piece.color) return;
    if (!config.movable.dests?.get(data.from as SquareName)?.includes(data.to as SquareName))
        return;
    if (
        data.promotion !== undefined &&
        !["queen", "rook", "bishop", "knight"].includes(data.promotion)
    )
        return;
    const move: NormalMove = { from, to, ...(data.promotion ? { promotion: data.promotion } : {}) };
    return position.isLegal(move) ? move : undefined;
}
