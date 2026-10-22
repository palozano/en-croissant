import { expect, test } from "vitest";
import { parsePGN } from "@/utils/chess";
import { desktopTreeToStudy, studyToDesktopTree } from "./desktopTree";
import { importStudies } from "./model";

const annotated = `[Event "Annotated"]
[Result "*"]
[Orientation "black"]
[Start "[0,0]"]
[Custom "preserved"]

{Root comment} 1. e4 $1 {Main [%clk 0:05:00] [%eval 0.32] [%cal Ge2e4]} (1. d4 $2 d5 (1... Nf6)) e5 2. Nf3 *`;

test("shared parser preserves desktop annotations and nested sibling variations", async () => {
    const tree = await parsePGN(annotated);
    expect(tree.root.children.map((n) => n.san)).toEqual(["e4", "d4"]);
    expect(tree.root.children[1].children.map((n) => n.san)).toEqual(["d5", "Nf6"]);
    expect(tree.root.children[0].children[0].san).toBe("e5");
    expect(tree.root.children[0].annotations).toContain("!");
    expect(tree.root.children[1].annotations).toContain("?");
    expect(tree.root.children[0].clock).toBe(300);
    expect(tree.root.children[0].score?.value).toEqual({ type: "cp", value: 32 });
    expect(tree.root.children[0].shapes).toHaveLength(1);
    expect(tree.headers.orientation).toBe("black");
    expect(tree.position).toEqual([0, 0]);
    const restored = await studyToDesktopTree(desktopTreeToStudy(tree));
    expect(restored.root).toEqual(tree.root);
    expect(restored.headers.other).toEqual(tree.headers.other);
});

test("shared parser preserves a custom position with Black to move", async () => {
    const text = `[Event "Black start"]\n[SetUp "1"]\n[FEN "7k/8/8/8/8/8/8/K7 b - - 0 12"]\n\n12... Kh7 *`;
    const study = importStudies(text)[0];
    const tree = await studyToDesktopTree(study);
    expect(tree.root.fen).toBe(study.root.fen);
    expect(tree.root.children[0].fen).toBe(study.root.children[0].fen);
});
