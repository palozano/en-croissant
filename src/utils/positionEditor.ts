import { COLORS, SquareSet } from "chessops";
import { parseFen } from "chessops/fen";
import { chessopsError, positionFromFen } from "./chessops";

// Necessary material constraints for standard chess, including promoted pieces.
// Missing kings are allowed in a draft; final validation requires both kings.
export function getPositionMaterialError(fen: string) {
    const parsed = parseFen(fen);
    if (parsed.isErr) return chessopsError(parsed.error);
    const { board } = parsed.value;
    for (const color of COLORS) {
        const pieces = board[color];
        const count = (role: "pawn" | "king" | "queen" | "rook" | "knight") =>
            board[role].intersect(pieces).size();
        if (count("king") > 1) return "Errors.InvalidKings";
        if (count("pawn") > 8) return "Board.Editor.TooManyPawns";
        if (pieces.size() > 16) return "Board.Editor.TooManyPieces";
        const bishops = board.bishop.intersect(pieces);
        const promotions =
            Math.max(0, count("queen") - 1) +
            Math.max(0, count("rook") - 2) +
            Math.max(0, count("knight") - 2) +
            Math.max(0, bishops.intersect(SquareSet.lightSquares()).size() - 1) +
            Math.max(0, bishops.intersect(SquareSet.darkSquares()).size() - 1);
        if (promotions > 8 - count("pawn")) return "Board.Editor.TooManyPromotions";
    }
    return null;
}

export function getStudyPositionError(fen: string) {
    const material = getPositionMaterialError(fen);
    if (material) return material;
    const [, error] = positionFromFen(fen);
    return error ? chessopsError(error) : null;
}

// Even an imported draft with excess material must remain repairable one piece at a time.
export function isPositionRemoval(previousFen: string, nextFen: string) {
    const previous = parseFen(previousFen);
    const next = parseFen(nextFen);
    if (previous.isErr || next.isErr) return false;
    if (next.value.board.occupied.size() >= previous.value.board.occupied.size()) return false;
    for (const [square, piece] of next.value.board) {
        const original = previous.value.board.get(square);
        if (original?.color !== piece.color || original.role !== piece.role) return false;
    }
    return true;
}
