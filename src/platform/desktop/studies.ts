import {
    BaseDirectory,
    exists,
    mkdir,
    readDir,
    readTextFile,
    rename,
    writeTextFile,
} from "@tauri-apps/plugin-fs";
import { studySchema, type Study } from "@/features/studies/model";
import type { StudyRepository } from "@/features/studies/platform";

const directory = "studies-v1";
const options = { baseDir: BaseDirectory.AppData };
let queue = Promise.resolve();
// Per-study atomic replacement; existing desktop PGN files are never migrated or
// overwritten. Serialize mutations so optimistic revision checks remain valid.
function serialize<T>(action: () => Promise<T>): Promise<T> {
    const next = queue.then(action);
    queue = next.then(
        () => {},
        () => {},
    );
    return next;
}
async function prepare() {
    await mkdir(directory, { ...options, recursive: true });
}
function filename(id: string) {
    const safe = [...new TextEncoder().encode(id)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    return `${directory}/${safe}.json`;
}
async function read(path: string): Promise<Study> {
    return studySchema.parse(JSON.parse(await readTextFile(path, options)));
}
export const desktopStudyRepository: StudyRepository = {
    load: () =>
        serialize(async () => {
            await prepare();
            const entries = await readDir(directory, options);
            const studies = await Promise.all(
                entries
                    .filter((entry) => /^[a-f0-9]+\.json$/.test(entry.name))
                    .map((entry) => read(`${directory}/${entry.name}`)),
            );
            return studies.sort((a, b) => b.updatedAt - a.updatedAt);
        }),
    save: (study, expectedUpdatedAt) =>
        serialize(async () => {
            const value = studySchema.parse(study);
            await prepare();
            const path = filename(value.id);
            if (expectedUpdatedAt !== undefined) {
                if (
                    !(await exists(path, options)) ||
                    (await read(path)).updatedAt !== expectedUpdatedAt
                )
                    throw new Error(
                        "This study has changed. Export your version and reload before editing further.",
                    );
            }
            const temporary = `${path}.tmp`;
            await writeTextFile(temporary, JSON.stringify(value), options);
            await rename(temporary, path, {
                oldPathBaseDir: BaseDirectory.AppData,
                newPathBaseDir: BaseDirectory.AppData,
            });
        }),
    delete: (id) =>
        serialize(async () => {
            // Retain a recoverable copy on deletion; it is excluded from the library.
            const path = filename(id);
            if (await exists(path, options))
                await rename(path, `${path}.deleted-${Date.now()}`, {
                    oldPathBaseDir: BaseDirectory.AppData,
                    newPathBaseDir: BaseDirectory.AppData,
                });
        }),
};
