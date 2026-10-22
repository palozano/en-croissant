import type { DrawShape } from "@lichess-org/chessground/draw";
import { Chess, makeSquare, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import type { EngineLine } from "./engine";

export function bestMoveArrow(fen: string, lines: EngineLine[]): DrawShape | undefined {
    const uci = lines.find((line) => line.multipv === 1)?.pv[0];
    if (!uci) return;
    const move = parseUci(uci);
    const setup = parseFen(fen);
    if (!move || !("from" in move) || !setup.isOk) return;
    const position = Chess.fromSetup(setup.value);
    if (!position.isOk || !position.value.isLegal(move)) return;
    return { orig: makeSquare(move.from), dest: makeSquare(move.to), brush: "green" };
}
