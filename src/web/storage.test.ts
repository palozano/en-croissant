import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createStudy } from "./studies";
import { deleteStudy, loadStudies, saveStudy, resetStudies } from "./storage";

describe("IndexedDB study persistence", () => {
    it("saves complete studies, updates atomically and deletes only the requested study", async () => {
        const first = createStudy("Uno");
        const second = createStudy("Dos");
        await saveStudy(first);
        await saveStudy(second);
        first.root.comments = ["Comentario persistente"];
        await saveStudy(first);
        expect((await loadStudies()).find((study) => study.id === first.id)).toEqual(first);
        await deleteStudy(second.id);
        expect((await loadStudies()).map((study) => study.id)).toEqual([first.id]);
    });
});

it("rejects stale writes from another tab without losing the saved version", async () => {
    const original = createStudy("Compartido entre pestañas");
    await saveStudy(original);
    const newer = { ...original, title: "Actualizado", updatedAt: original.updatedAt + 1 };
    await saveStudy(newer, original.updatedAt);
    await expect(
        saveStudy({ ...original, title: "Versión antigua" }, original.updatedAt),
    ).rejects.toThrow("another tab");
    expect((await loadStudies()).find((study) => study.id === original.id)?.title).toBe(
        "Actualizado",
    );
});

it("clears every saved study atomically and rejects stale edits after the reset", async () => {
    const previous = createStudy("Old study");
    await saveStudy(previous);
    const blank = createStudy();
    await resetStudies(blank);
    expect(await loadStudies()).toEqual([blank]);
    await expect(
        saveStudy({ ...previous, title: "Stale tab" }, previous.updatedAt),
    ).rejects.toThrow("another tab");
    expect(await loadStudies()).toEqual([blank]);
});
