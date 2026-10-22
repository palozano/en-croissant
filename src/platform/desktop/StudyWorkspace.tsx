import { boardSizePreference } from "@/platform/boardSizePreference";
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ask, save } from "@tauri-apps/plugin-dialog";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import StudyWorkspace from "@/features/studies/StudyWorkspace";
import type { StudyPlatform } from "@/features/studies/platform";
import { enginesAtom } from "@/state/atoms";
import { downloadPgn } from "@/features/studies/downloadPgn";
import { NativeEngine } from "./NativeEngine";
import { desktopStudyRepository } from "./studies";

export default function DesktopStudyWorkspace() {
  const engines = useAtomValue(enginesAtom);
  const stockfish = engines?.find(
    (engine) => engine.type === "local" && /stockfish/i.test(engine.name),
  );
  const platform = useMemo<StudyPlatform>(
    () => ({
      repository: desktopStudyRepository,
      boardSize: boardSizePreference("desktop-study-board-size"),
      engineName: stockfish?.name ?? "Stockfish",
      createEngine: (publish) => {
        if (!stockfish || stockfish.type !== "local")
          throw new Error("Install Stockfish in Engines to analyze studies.");
        return new NativeEngine(stockfish, publish);
      },
      exportFile: async (name, contents) => {
        const path = await save({
          defaultPath: name,
          filters: [{ name: "PGN", extensions: ["pgn"] }],
        });
        if (path) await writeTextFile(path, contents);
      },
      downloadPgn: (url) =>
        downloadPgn(url, new URL(url).hostname === "lichess.org" ? nativeFetch : fetch),
      confirm: (message) => ask(message, { title: "Studies", kind: "warning" }),
      requestPersistence: async () => true,
      openPresentation: async (url, id) => {
        const label = `study-presentation-${id}`;
        const previous = await WebviewWindow.getByLabel(label);
        if (previous) {
          await previous.setFocus();
          return true;
        }
        return new Promise<boolean>((resolve, reject) => {
          const popup = new WebviewWindow(label, {
            url: `${url.pathname}${url.search}`,
            title: "Study — Presentation",
            width: 800,
            height: 840,
            resizable: true,
          });
          void popup.once("tauri://created", () => resolve(true));
          void popup.once("tauri://error", ({ payload }) => reject(new Error(String(payload))));
        });
      },
      labels: {
        save: "Save studies on device",
        saved: "Saved on this device",
        privacy: "Private to this device.",
        storageHelp:
          "Studies are saved in the app data folder. Export a backup to transfer or recover them.",
        deleteLocation: "from this device",
      },
    }),
    [stockfish],
  );
  return <StudyWorkspace platform={platform} />;
}
