import { beforeEach, expect, test, vi } from "vitest";
import { createStudy } from "@/features/studies/model";
const { disk, failRename } = vi.hoisted(() => ({
    disk: new Map<string, string>(),
    failRename: { value: false },
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
    BaseDirectory: { AppData: 1 },
    mkdir: vi.fn<() => Promise<void>>(async () => {}),
    exists: async (path: string) => disk.has(path),
    readDir: async () => [...disk.keys()].map((path) => ({ name: path.split("/").at(-1)! })),
    readTextFile: async (path: string) => {
        if (!disk.has(path)) throw new Error("Missing");
        return disk.get(path)!;
    },
    writeTextFile: async (path: string, text: string) => {
        disk.set(path, text);
    },
    rename: async (from: string, to: string) => {
        if (failRename.value) throw new Error("Disk failure");
        disk.set(to, disk.get(from)!);
        disk.delete(from);
    },
}));
import { desktopStudyRepository as repository } from "./studies";
beforeEach(() => {
    disk.clear();
    failRename.value = false;
});
test("native storage shares the Study format, checks revisions and serializes saves", async () => {
    const study = createStudy();
    await repository.save(study);
    const next = { ...study, title: "Changed", updatedAt: study.updatedAt + 1 };
    const last = { ...next, title: "Final", updatedAt: next.updatedAt + 1 };
    await Promise.all([
        repository.save(next, study.updatedAt),
        repository.save(last, next.updatedAt),
    ]);
    expect(await repository.load()).toEqual([last]);
    await expect(repository.save(study, study.updatedAt)).rejects.toThrow("changed");
    expect(await repository.load()).toEqual([last]);
});
test("failed atomic replacement keeps the previous study recoverable", async () => {
    const study = createStudy();
    await repository.save(study);
    failRename.value = true;
    await expect(
        repository.save({ ...study, title: "Uncommitted" }, study.updatedAt),
    ).rejects.toThrow("Disk failure");
    expect(await repository.load()).toEqual([study]);
});
test("deletion retains a recovery copy and ids cannot escape the studies directory", async () => {
    const study = { ...createStudy(), id: "../../other.json" };
    await repository.save(study);
    expect([...disk.keys()]).toHaveLength(1);
    expect([...disk.keys()][0]).toMatch(/^studies-v1\/[a-f0-9]+\.json$/);
    await repository.delete(study.id);
    expect(await repository.load()).toEqual([]);
    expect([...disk.values()].map((text) => JSON.parse(text))).toEqual([study]);
});
