import { expect, test } from "vitest";
import { INITIAL_FEN } from "chessops/fen";
import { bestMoveArrow } from "./bestMoveArrow";
const line = (multipv: number, ...pv: string[]) => ({ multipv, pv, depth: 10, score: "+0.3" });
test("draws only the first move of the principal variation, regardless of output order", () => {
    expect(bestMoveArrow(INITIAL_FEN, [line(2, "d2d4"), line(1, "e2e4", "e7e5")])).toEqual({
        orig: "e2",
        dest: "e4",
        brush: "green",
    });
});
test("ignores absent, malformed and stale illegal engine moves", () => {
    for (const lines of [[], [line(2, "d2d4")], [line(1)], [line(1, "0000")], [line(1, "e7e5")]]) {
        expect(bestMoveArrow(INITIAL_FEN, lines)).toBeUndefined();
    }
});
test("supports promotion moves", () => {
    expect(bestMoveArrow("7k/P7/8/8/8/8/8/7K w - - 0 1", [line(1, "a7a8q")])).toEqual({
        orig: "a7",
        dest: "a8",
        brush: "green",
    });
});
