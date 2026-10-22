import { afterEach, expect, it, vi } from "vitest";
import { parseUci } from "chessops";
import {
    addStudyMove,
    createStudy,
    importStudies,
    replaceStudyPosition,
    sortStudies,
    studySchema,
    type StudySource,
} from "./model";

afterEach(() => vi.restoreAllMocks());

it("records manual creation and preserves metadata through edits", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const study = createStudy();
    expect(study.metadata).toEqual({ createdAt: 1000, source: { type: "manual" } });
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const moved = addStudyMove(study, [], parseUci("e2e4")!).study;
    expect(moved.updatedAt).toBe(2000);
    expect(moved.metadata).toEqual(study.metadata);
    expect(replaceStudyPosition(moved, moved.root.children[0].fen).metadata).toEqual(
        study.metadata,
    );
});

it.each<StudySource>([
    { type: "lichess", url: "https://lichess.org/study/abcdefgh/ijklmnop" },
    { type: "local_pgn", filename: "my-studies.pgn" },
    { type: "remote_pgn", url: "https://example.com/studies.pgn" },
])("stores the import date and source for every chapter: $type", (source) => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    const studies = importStudies('[Event "One"]\n\n1. e4 *\n\n[Event "Two"]\n\n1. d4 *', source);
    expect(studies).toHaveLength(2);
    for (const study of studies) {
        expect(study.metadata).toEqual({ createdAt: 123456, source });
        expect(studySchema.parse(JSON.parse(JSON.stringify(study)))).toEqual(study);
    }
});

it("loads legacy studies without inventing their date or origin", () => {
    const { metadata: _metadata, ...legacy } = createStudy();
    expect(studySchema.parse(legacy).metadata).toBeUndefined();
});

it("sorts by creation date and source, leaving legacy dates last without mutating the library", () => {
    const old = createStudy("Old");
    old.metadata = {
        createdAt: 10,
        source: { type: "remote_pgn", url: "https://example.com/a.pgn" },
    };
    old.updatedAt = 9999;
    const recent = createStudy("Recent");
    recent.metadata = {
        createdAt: 20,
        source: { type: "lichess", url: "https://lichess.org/study/abcdefgh" },
    };
    const legacy = createStudy("Legacy");
    delete legacy.metadata;
    const studies = [legacy, old, recent];
    expect(sortStudies(studies, "newest")).toEqual([recent, old, legacy]);
    expect(sortStudies(studies, "oldest")).toEqual([old, recent, legacy]);
    expect(sortStudies(studies, "source")).toEqual([recent, old, legacy]);
    expect(sortStudies(studies, "title")).toEqual([legacy, old, recent]);
    expect(studies).toEqual([legacy, old, recent]);
});
