import { boardSizePreference } from "@/platform/boardSizePreference";
import type { StudyPlatform } from "@/features/studies/platform";
import { BrowserStockfish } from "./stockfish";
import { deleteStudy, downloadFile, loadStudies, saveStudy, resetStudies } from "./storage";
import { downloadPgn } from "./downloads";

export const browserStudyPlatform: StudyPlatform = {
    fitBoardToViewport: true,
    boardSize: boardSizePreference("web-board-size-v2"),
    repository: { load: loadStudies, save: saveStudy, delete: deleteStudy, reset: resetStudies },
    createEngine: (publish) => new BrowserStockfish(publish),
    engineName: "Stockfish 19 Lite",
    engineCredit: {
        label: "Stockfish.js",
        url: "https://github.com/nmrugg/stockfish.js/tree/v19.0.1",
    },
    exportFile: downloadFile,
    downloadPgn,
    confirm: async (message) => window.confirm(message),
    requestPersistence: async () => navigator.storage?.persist?.() ?? false,
    prepareOffline:
        import.meta.env.PROD && import.meta.env.MODE === "web" && "serviceWorker" in navigator
            ? async () => {
                  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
                  await navigator.serviceWorker.ready;
              }
            : undefined,
    labels: {
        save: "Save studies in browser",
        saved: "Saved in this browser",
        privacy: "Private to this browser.",
        storageHelp:
            "Studies are saved on this device and domain. Export a backup to transfer or recover them if you clear your browser data.",
        deleteLocation: "from this browser",
    },
};
