import { describe, expect, it } from "vitest";
import { Chess, makeSquare, parseSquare } from "chessops";
import { chessgroundDests } from "chessops/compat";
import { INITIAL_FEN, parseFen } from "chessops/fen";
import {
    getFloatingBoardMove,
    type FloatingBoardMoveRequest,
    type FloatingBoardSnapshot,
} from "../floatingBoardProtocol";

function snapshot(fen = INITIAL_FEN): FloatingBoardSnapshot {
    const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
    return {
        revision: "active-position",
        config: {
            fen,
            turnColor: pos.turn,
            viewOnly: false,
            movable: { free: false, color: pos.turn, dests: chessgroundDests(pos) },
        },
        autoPromote: false,
        is3d: false,
        pieceStylesheet: "",
        styles: {},
    };
}
const request: FloatingBoardMoveRequest = {
    type: "move",
    revision: "active-position",
    from: "e2",
    to: "e4",
};

describe("floating board move validation", () => {
    it("accepts a legal move from the current position", () => {
        expect(getFloatingBoardMove(snapshot(), request)).toEqual({
            from: parseSquare("e2"),
            to: parseSquare("e4"),
        });
    });

    it("rejects moves after switching boards or positions", () => {
        expect(
            getFloatingBoardMove(snapshot(), { ...request, revision: "previous-board" }),
        ).toBeUndefined();
        expect(getFloatingBoardMove(null, request)).toBeUndefined();
    });

    it("respects locked boards, editing mode and the player's color", () => {
        for (const override of [
            { viewOnly: true },
            { movable: { free: true } },
            { movable: { color: undefined } },
            { movable: { color: "black" as const } },
        ]) {
            const state = snapshot();
            state.config = { ...state.config, ...override };
            expect(getFloatingBoardMove(state, request)).toBeUndefined();
        }
    });

    it("respects restricted destinations even for otherwise legal moves", () => {
        const state = snapshot();
        state.config.movable!.dests = new Map();
        expect(getFloatingBoardMove(state, request)).toBeUndefined();
    });

    it("validates chess legality independently of received destinations", () => {
        const state = snapshot();
        state.config.movable!.dests = new Map([["e2", ["e5"]]]);
        expect(getFloatingBoardMove(state, { ...request, to: "e5" })).toBeUndefined();
    });

    it.each([
        null,
        {},
        { ...request, from: "invalid" },
        { ...request, to: 5 },
        { ...request, promotion: "king" },
    ])("rejects malformed requests: %j", (data) => {
        expect(getFloatingBoardMove(snapshot(), data)).toBeUndefined();
    });

    it.each(["queen", "rook", "bishop", "knight"] as const)(
        "supports promotion to %s",
        (promotion) => {
            const state = snapshot("7k/P7/8/8/8/8/8/7K w - - 0 1");
            const move = getFloatingBoardMove(state, {
                ...request,
                from: "a7",
                to: "a8",
                promotion,
            });
            expect(move?.promotion).toBe(promotion);
            expect(move && makeSquare(move.to)).toBe("a8");
            expect(
                getFloatingBoardMove(state, { ...request, from: "a7", to: "a8" }),
            ).toBeUndefined();
        },
    );

    it.each([
        ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1", "g1"],
        ["7k/8/8/3pP3/8/8/8/7K w - d6 0 1", "e5", "d6"],
    ])("supports castling and en passant: %s", (fen, from, to) => {
        expect(getFloatingBoardMove(snapshot(fen), { ...request, from, to })).toBeDefined();
    });
});
