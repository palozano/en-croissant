import { nodeAt, type Study } from "./model";

export function studyVariationPath(
    study: Study,
    path: number[],
    direction: "up" | "down",
): number[] {
    if (direction === "up") {
        // Return to the preceding line at the nearest variation fork,
        // including when the user has already advanced several moves into it.
        for (let depth = path.length - 1; depth >= 0; depth--) {
            if (path[depth] > 0) return [...path.slice(0, depth), path[depth] - 1];
        }
        return path;
    }
    if (path.length) {
        const parentPath = path.slice(0, -1);
        const index = path[path.length - 1];
        if (index + 1 < nodeAt(study, parentPath).children.length) {
            return [...parentPath, index + 1];
        }
    }
    // At a position with several continuations, enter the first side line.
    return nodeAt(study, path).children.length > 1 ? [...path, 1] : path;
}
