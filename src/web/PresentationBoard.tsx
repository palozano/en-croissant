import { BoardSurface } from "@/features/board/BoardSurface";
import type { Api } from "@lichess-org/chessground/api";
import { useEffect, useRef, useState } from "react";
import { presentationChannel, type PresentationSnapshot } from "./presentation";
import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";
import "./presentation.css";

export default function PresentationBoard() {
  const api = useRef<Api | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    document.documentElement.lang = "en";
    const id = new URLSearchParams(location.search).get("presentation")!;
    const channel = new BroadcastChannel(presentationChannel(id));
    channel.onmessage = ({ data }: MessageEvent<PresentationSnapshot | { type: "closed" }>) => {
      if (data.type === "closed") {
        setConnected(false);
        return;
      }
      if (data.type !== "position") return;
      document.title = `${data.title} — Presentation`;
      api.current?.set({
        fen: data.fen,
        orientation: data.orientation,
        drawable: { autoShapes: data.shapes },
      });
      setConnected(true);
    };
    channel.postMessage("ready");
    return () => {
      channel.close();
    };
  }, []);
  return (
    <main className="presentation">
      <link rel="stylesheet" href={`${import.meta.env.BASE_URL}pieces/cburnett.css`} />
      <div className="presentation-toolbar">
        <button
          onClick={async () => {
            try {
              if ("__TAURI_INTERNALS__" in window) {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                const current = getCurrentWindow();
                await current.setFullscreen(!(await current.isFullscreen()));
              } else if (document.fullscreenElement) await document.exitFullscreen();
              else if (document.documentElement.requestFullscreen)
                await document.documentElement.requestFullscreen();
              else throw new Error("Fullscreen unavailable");
            } catch {
              setError("Fullscreen is unavailable. Use the window's fullscreen control.");
            }
          }}
        >
          Fullscreen
        </button>
      </div>
      <BoardSurface
        apiRef={api}
        config={{ viewOnly: true, coordinates: true, drawable: { enabled: false } }}
        className="presentation-board"
        style={{ visibility: connected ? "visible" : "hidden" }}
      />
      {!connected && (
        <p role="status">Waiting for the study window. Keep it open to present the board.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
