import { expect, test, vi } from "vitest";
import { downloadLichessStudy, lichessStudyPgnUrl } from "./lichess";
import { importStudies, exportStudy } from "./model";

test("normalizes study/chapter and export links and explicitly keeps annotations", () => {
    const all = new URL(lichessStudyPgnUrl("https://lichess.org/study/AbCd1234/ZyXw9876#12"));
    expect(all.pathname).toBe("/api/study/AbCd1234.pgn");
    for (const key of ["clocks", "comments", "variations", "orientation"])
        expect(all.searchParams.get(key)).toBe("true");
    expect(
        new URL(lichessStudyPgnUrl("lichess.org/study/AbCd1234/ZyXw9876", "chapter")).pathname,
    ).toBe("/api/study/AbCd1234/ZyXw9876.pgn");
    expect(
        new URL(
            lichessStudyPgnUrl(
                "https://www.lichess.org/api/study/AbCd1234/ZyXw9876.pgn?comments=false",
                "chapter",
            ),
        ).origin,
    ).toBe("https://lichess.org");
});
test.each([
    "https://lichess.org.evil/study/AbCd1234",
    "https://example.org/study/AbCd1234",
    "https://lichess.org/study/mine",
    "https://lichess.org/@/someone",
    "file:///study/AbCd1234",
    "https://user:password@lichess.org/study/AbCd1234",
])("rejects invalid links: %s", (input) => {
    expect(() => lichessStudyPgnUrl(input)).toThrow(/Lichess|lichess/);
});
test("does not download anything when the chapter link is missing", async () => {
    const download = vi.fn<(url: string) => Promise<string>>();
    await expect(
        downloadLichessStudy("https://lichess.org/study/AbCd1234", "chapter", download),
    ).rejects.toThrow("chapter ID");
    expect(download).not.toHaveBeenCalled();
});
test.each([403, 404, 429])("explains Lichess export failures (%s)", async (status) => {
    await expect(
        downloadLichessStudy("https://lichess.org/study/AbCd1234", "all", async () => {
            throw new Error(`Download failed (${status}).`);
        }),
    ).rejects.toThrow(status === 429 ? "Wait at least a minute" : "public study");
});
test("imports every exported chapter with comments, branches, clocks, and source headers", async () => {
    const pgn =
        '[Event "Study: First"]\n[StudyName "Study"]\n[ChapterName "First"]\n[ChapterURL "https://lichess.org/study/AbCd1234/ZyXw9876"]\n\n1. e4 $1 {Idea [%clk 0:02:00]} (1. d4 d5) e5 *\n\n[Event "Study: Second"]\n\n1. c4 *';
    const imported = importStudies(
        await downloadLichessStudy("https://lichess.org/study/AbCd1234", "all", async () => pgn),
    );
    expect(imported.map((study) => study.title)).toEqual(["Study: First", "Study: Second"]);
    expect(imported[0].root.children.map((node) => node.san)).toEqual(["e4", "d4"]);
    expect(exportStudy(imported[0])).toContain("Idea [%clk 0:02:00]");
    expect(new Map(imported[0].headers).get("ChapterName")).toBe("First");
});
test("a HTML/login page is never imported as an empty study", async () => {
    await expect(
        downloadLichessStudy(
            "https://lichess.org/study/AbCd1234",
            "all",
            async () => "<html>Sign in</html>",
        ),
    ).rejects.toThrow("did not return a study PGN");
});
