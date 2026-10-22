import { replaceStudyPosition } from "./studies";
import { describe, expect, it } from "vitest";
import { parseUci } from "chessops";
import {
    nextStudyTitle,
    addStudyMove,
    createStudy,
    exportStudy,
    importStudies,
    nodeAt,
} from "./studies";
import { getStudyPositionError } from "@/utils/positionEditor";

describe("browser studies", () => {
    it("adds branches without modifying the original study or duplicating moves", () => {
        const initial = createStudy();
        const e4 = addStudyMove(initial, [], parseUci("e2e4")!);
        const d4 = addStudyMove(e4.study, [], parseUci("d2d4")!);
        expect(initial.root.children).toHaveLength(0);
        expect(d4.study.root.children.map((node) => node.san)).toEqual(["e4", "d4"]);
        expect(addStudyMove(d4.study, [], parseUci("e2e4")!).study.root.children).toHaveLength(2);
        expect(nodeAt(e4.study, e4.path).san).toBe("e4");
    });
    it("roundtrips PGN headers, root comments, annotations and nested variations", () => {
        const pgn = '[Event "Prueba"]\n[White "Ana"]\n\n{Start} 1. e4 $1 {Idea} (1. d4 d5) e5 *';
        const [study] = importStudies(pgn);
        const [restored] = importStudies(exportStudy(study));
        expect(restored.root).toEqual(study.root);
        expect(new Map(restored.headers).get("White")).toBe("Ana");
        expect(restored.id).not.toBe(study.id);
    });
    it("supports study positions, underpromotion, and several imported games", () => {
        const study = createStudy("Promotion", "7k/P7/8/8/8/8/8/7K w - - 0 1");
        const result = addStudyMove(study, [], parseUci("a7a8n")!);
        expect(nodeAt(result.study, result.path).san).toContain("=N");
        expect(importStudies(exportStudy(result.study))[0].root.fen).toBe(study.root.fen);
        expect(
            importStudies(`${exportStudy(study)}\n\n${exportStudy(createStudy())}`),
        ).toHaveLength(2);
    });
    it("rejects illegal moves, broken paths and invalid imported starting positions", () => {
        expect(() => addStudyMove(createStudy(), [], parseUci("e2e5")!)).toThrow("Illegal move");
        expect(() => nodeAt(createStudy(), [10])).toThrow("variation");
        expect(() => importStudies('[FEN "8/8/8/8/8/8/8/8 w - - 0 1"]\n\n*')).toThrowError(Error);
        expect(() => importStudies("1. e4 e5 2. Ke3 *")).toThrow("Illegal PGN move");
        expect(getStudyPositionError(importStudies("1. e4 *")[0].root.fen)).toBeNull();
    });
});

it("numbers new studies after the highest existing number", () => {
    expect(nextStudyTitle([])).toBe("Study 1");
    expect(
        nextStudyTitle([{ title: "Study 1" }, { title: "Study 3" }, { title: "Mi repertorio" }]),
    ).toBe("Study 4");
    expect(createStudy().title).toBe("Study 1");
});

it("replaces a study position while preserving its identity, title and notes", () => {
    const original = addStudyMove(createStudy("My study"), [], parseUci("e2e4")!).study;
    original.root.comments = ["Study notes"];
    const updated = replaceStudyPosition(original, original.root.children[0].fen);
    expect(updated.id).toBe(original.id);
    expect(updated.title).toBe(original.title);
    expect(updated.root.comments).toEqual(["Study notes"]);
    expect(updated.root.children).toHaveLength(0);
    expect(original.root.children).toHaveLength(1);
    expect(replaceStudyPosition(original, original.root.fen).root.children).toEqual(
        original.root.children,
    );
});
