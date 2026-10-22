import { describe, expect, it } from "vitest";
import { Board, type Color, type Role, type SquareName, parseSquare } from "chessops";
import { EMPTY_FEN, INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import {
    getPositionMaterialError,
    getStudyPositionError,
    isPositionRemoval,
} from "../positionEditor";

function fenWith(pieces: [SquareName, Color, Role][]) {
    const setup = parseFen(EMPTY_FEN).unwrap();
    setup.board = Board.empty();
    for (const [square, color, role] of pieces)
        setup.board.set(parseSquare(square)!, { color, role });
    return makeFen(setup);
}

function add(fen: string, square: SquareName, color: Color, role: Role) {
    const setup = parseFen(fen).unwrap();
    setup.board.set(parseSquare(square)!, { color, role });
    return makeFen(setup);
}

describe("study position material", () => {
    it("accepts the initial position and incomplete drafts", () => {
        expect(getStudyPositionError(INITIAL_FEN)).toBeNull();
        expect(getPositionMaterialError(EMPTY_FEN)).toBeNull();
        expect(getStudyPositionError(EMPTY_FEN)).not.toBeNull();
    });

    it.each(["white", "black"] as const)("limits %s to 8 pawns and one king", (color) => {
        expect(getPositionMaterialError(add(INITIAL_FEN, "a4", color, "pawn"))).toBe(
            "Board.Editor.TooManyPawns",
        );
        expect(getPositionMaterialError(add(INITIAL_FEN, "a4", color, "king"))).toBe(
            "Errors.InvalidKings",
        );
    });

    it("limits each side to 16 pieces", () => {
        expect(getPositionMaterialError(add(INITIAL_FEN, "a4", "white", "knight"))).toBe(
            "Board.Editor.TooManyPieces",
        );
    });

    it("allows replacing a piece without counting it twice", () => {
        expect(getPositionMaterialError(add(INITIAL_FEN, "a2", "white", "queen"))).toBeNull();
    });

    it("requires a missing pawn for each extra promoted piece", () => {
        const setup = parseFen(INITIAL_FEN).unwrap();
        setup.board.take(parseSquare("a1")!);
        setup.board.set(parseSquare("a4")!, { color: "white", role: "queen" });
        expect(getPositionMaterialError(makeFen(setup))).toBe("Board.Editor.TooManyPromotions");
        setup.board.take(parseSquare("a2")!);
        expect(getPositionMaterialError(makeFen(setup))).toBeNull();
        setup.board.set(parseSquare("b4")!, { color: "white", role: "queen" });
        expect(getPositionMaterialError(makeFen(setup))).toBe("Board.Editor.TooManyPromotions");
    });

    it("accounts for promotions when bishops occupy the same square color", () => {
        const setup = parseFen(INITIAL_FEN).unwrap();
        setup.board.take(parseSquare("f1")!);
        setup.board.set(parseSquare("e3")!, { color: "white", role: "bishop" });
        expect(getPositionMaterialError(makeFen(setup))).toBe("Board.Editor.TooManyPromotions");
        setup.board.take(parseSquare("a2")!);
        expect(getPositionMaterialError(makeFen(setup))).toBeNull();
    });

    it("allows nine queens when all eight pawns have promoted", () => {
        const squares: SquareName[] = ["a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2", "a3"];
        const fen = fenWith(squares.map((square) => [square, "white", "queen"]));
        expect(getPositionMaterialError(fen)).toBeNull();
        expect(getPositionMaterialError(add(fen, "b3", "white", "queen"))).toBe(
            "Board.Editor.TooManyPromotions",
        );
    });
});

describe("finishing a study position", () => {
    it("requires exactly one king per side", () => {
        const fen = fenWith([["e1", "white", "king"]]);
        expect(getStudyPositionError(fen)).toBe("Errors.InvalidKings");
    });

    it("rejects adjacent kings and an attacked king of the side that just moved", () => {
        expect(
            getStudyPositionError(
                fenWith([
                    ["e1", "white", "king"],
                    ["e2", "black", "king"],
                ]),
            ),
        ).toBe("Errors.OppositeCheck");
        expect(
            getStudyPositionError(
                fenWith([
                    ["a1", "white", "king"],
                    ["h8", "black", "king"],
                    ["h1", "white", "rook"],
                ]),
            ),
        ).toBe("Errors.OppositeCheck");
    });

    it("rejects pawns on the back rank", () => {
        expect(
            getStudyPositionError(
                fenWith([
                    ["e1", "white", "king"],
                    ["e8", "black", "king"],
                    ["a8", "white", "pawn"],
                ]),
            ),
        ).toBe("Errors.PawnsOnBackrank");
    });

    it("accepts a study with just two distant kings", () => {
        expect(
            getStudyPositionError(
                fenWith([
                    ["e1", "white", "king"],
                    ["e8", "black", "king"],
                ]),
            ),
        ).toBeNull();
    });

    it("reports malformed FEN without crashing", () => {
        expect(getStudyPositionError("invalid")).toBeTruthy();
    });
});

describe("repairing imported drafts", () => {
    it("allows removal while excess material remains", () => {
        const invalid = add(add(INITIAL_FEN, "a3", "white", "pawn"), "b3", "white", "pawn");
        const setup = parseFen(invalid).unwrap();
        setup.board.take(parseSquare("a3")!);
        const next = makeFen(setup);
        expect(getPositionMaterialError(next)).toBe("Board.Editor.TooManyPawns");
        expect(isPositionRemoval(invalid, next)).toBe(true);
        expect(isPositionRemoval(next, invalid)).toBe(false);
    });

    it("does not mistake relocating or replacing pieces for a removal", () => {
        const setup = parseFen(INITIAL_FEN).unwrap();
        setup.board.take(parseSquare("a2")!);
        setup.board.set(parseSquare("b2")!, { color: "white", role: "queen" });
        expect(isPositionRemoval(INITIAL_FEN, makeFen(setup))).toBe(false);
    });
});
