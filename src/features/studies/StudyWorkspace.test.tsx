import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { createStudy } from "./model";
import type { StudyPlatform } from "./platform";
import StudyWorkspace from "./StudyWorkspace";

vi.mock("@/features/board/StudyBoard", () => ({ default: () => <div>Board</div> }));
vi.mock("@/features/board/presentation", () => ({ usePresentation: () => async () => true }));
afterEach(() => vi.unstubAllGlobals());

test("the shared workspace uses injected native storage and engine without IndexedDB or a worker", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const study = createStudy("On disk");
  const client = {
    analyze: vi.fn<(fen: string) => void>(),
    stop: vi.fn<() => void>(),
    dispose: vi.fn<() => void>(),
  };
  const repository: StudyPlatform["repository"] = {
    load: vi.fn<StudyPlatform["repository"]["load"]>(async () => [study]),
    save: vi.fn<StudyPlatform["repository"]["save"]>(async () => {}),
    delete: vi.fn<StudyPlatform["repository"]["delete"]>(async () => {}),
  };
  const platform: StudyPlatform = {
    repository,
    createEngine: () => client,
    engineName: "Native Stockfish",
    exportFile: vi.fn<() => void>(),
    downloadPgn: async () => "",
    confirm: async () => true,
    requestPersistence: async () => true,
    labels: {
      save: "Save on disk",
      saved: "Saved on disk",
      privacy: "On device",
      storageHelp: "On disk",
      deleteLocation: "from this device",
    },
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (text: string) =>
    [...host.querySelectorAll("button")].find((item) => item.textContent === text)!;
  try {
    await act(async () => root.render(<StudyWorkspace platform={platform} />));
    expect(host.textContent).toContain("On disk");
    expect(host.textContent).toContain("Native Stockfish");
    expect(host.textContent).not.toContain("Private to this browser");
    await act(async () => button("Analyze").click());
    expect(client.analyze).toHaveBeenCalledWith(study.root.fen);
    await act(async () => button("Edit").click());
    expect(client.stop).toHaveBeenCalled();
    await act(async () => button("Save current study").click());
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: study.id }),
      study.updatedAt,
    );
    expect(host.querySelector(".study-position-editor")).toBeNull();
    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="Save on disk"]')!.click(),
    );
    expect(host.textContent).toContain("Saved with persistent storage");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
  expect(client.dispose).toHaveBeenCalledOnce();
});

test.each(["lichess", "remote_pgn", "local_pgn"] as const)(
  "records %s imports and lets the library sort by date and type",
  async (sourceType) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const old = createStudy("Existing");
    old.metadata!.createdAt = 1;
    const save = vi.fn<StudyPlatform["repository"]["save"]>(async () => {});
    const url =
      sourceType === "lichess"
        ? "https://lichess.org/study/abcdefgh"
        : "https://example.com/study.pgn";
    const pgn = '[Event "Imported"]\n\n1. e4 *';
    const platform: StudyPlatform = {
      repository: { load: async () => [old], save, delete: async () => {} },
      createEngine: () => ({ analyze() {}, stop() {}, dispose() {} }),
      engineName: "Stockfish",
      exportFile() {},
      downloadPgn: async () => pgn,
      confirm: async () => true,
      requestPersistence: async () => true,
      labels: {
        save: "Save",
        saved: "Saved",
        privacy: "Private",
        storageHelp: "Storage",
        deleteLocation: "here",
      },
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const button = (text: string) =>
      [...host.querySelectorAll("button")].find((item) => item.textContent === text)!;
    try {
      await act(async () => root.render(<StudyWorkspace platform={platform} />));
      if (sourceType === "local_pgn") {
        const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
        Object.defineProperty(input, "files", {
          configurable: true,
          value: [{ name: "local.pgn", size: pgn.length, text: async () => pgn }],
        });
        await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
      } else {
        await act(async () =>
          button(sourceType === "lichess" ? "Import Lichess" : "Load PGN").click(),
        );
        const input = host.querySelector<HTMLInputElement>('input[name="url"]')!;
        input.value = url;
        await act(async () =>
          input
            .closest("form")!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
        );
      }
      const imported = save.mock.calls[0][0];
      expect(imported.metadata?.source).toEqual(
        sourceType === "local_pgn"
          ? { type: sourceType, filename: "local.pgn" }
          : { type: sourceType, url },
      );
      expect(imported.metadata?.createdAt).toBeGreaterThan(1);
      const metadata = host.querySelector('[aria-label="Study metadata"]')!;
      expect(metadata.querySelector("time")?.getAttribute("datetime")).toBe(
        new Date(imported.metadata!.createdAt).toISOString(),
      );
      expect(
        sourceType === "local_pgn"
          ? metadata.textContent?.includes("local.pgn")
          : metadata.querySelector("a")?.href === url,
      ).toBe(true);
      const titles = () =>
        [...host.querySelectorAll(".web-study-list button > span")].map((item) => item.textContent);
      expect(titles()).toEqual(["Imported", "Existing"]);
      const sort = host.querySelector<HTMLSelectElement>('select[aria-label="Sort studies"]')!;
      await act(async () => {
        sort.value = "oldest";
        sort.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(titles()).toEqual(["Existing", "Imported"]);
      await act(async () => {
        sort.value = "source";
        sort.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(titles()).toEqual(
        sourceType === "remote_pgn" ? ["Existing", "Imported"] : ["Imported", "Existing"],
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
