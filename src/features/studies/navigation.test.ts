import { expect, it } from "vitest";
import { importStudies } from "./model";
import { studyVariationPath } from "./navigation";

const [study] = importStudies(
    "1. e4 (1. d4 d5 2. c4 (2. Nf3 Nf6)) (1. c4 e5) e5 (1... c5 2. Nf3) 2. Nf3 *",
);

it("enters side lines at the current move and moves between sibling variations", () => {
    expect(studyVariationPath(study, [0], "down")).toEqual([1]);
    expect(studyVariationPath(study, [1], "down")).toEqual([2]);
    expect(studyVariationPath(study, [2], "up")).toEqual([1]);
    expect(studyVariationPath(study, [1], "up")).toEqual([0]);
});
it("enters side lines starting at the current position, including the starting position", () => {
    expect(studyVariationPath(study, [], "down")).toEqual([1]);
    expect(studyVariationPath(study, [0, 0], "down")).toEqual([0, 1]);
});
it("exits an advanced or nested variation at its nearest fork", () => {
    expect(studyVariationPath(study, [2, 0], "up")).toEqual([1]);
    expect(studyVariationPath(study, [1, 0, 1, 0], "up")).toEqual([1, 0, 0]);
    expect(studyVariationPath(study, [1, 0, 0], "up")).toEqual([0]);
});
it("does not wrap around or change the study when no variation exists", () => {
    const original = structuredClone(study);
    expect(studyVariationPath(study, [], "up")).toEqual([]);
    expect(studyVariationPath(study, [0, 0, 0], "up")).toEqual([0, 0, 0]);
    expect(studyVariationPath(study, [2], "down")).toEqual([2]);
    expect(study).toEqual(original);
});
