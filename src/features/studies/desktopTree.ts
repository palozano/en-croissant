// The existing desktop tree retains its reports, annotations and repertoire
// metadata. PGN is the interchange boundary, so its persistent format stays intact.
import { getPGN, parsePGN } from "@/utils/chess";
import type { TreeState } from "@/utils/treeReducer";
import { exportStudy, importStudies, type Study } from "./model";

export function desktopTreeToStudy(tree: TreeState): Study {
    return importStudies(
        getPGN(tree.root, {
            headers: tree.headers,
            glyphs: true,
            comments: true,
            variations: true,
            extraMarkups: true,
        }),
    )[0];
}
export function studyToDesktopTree(study: Study): Promise<TreeState> {
    return parsePGN(exportStudy(study));
}
