import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import type { Key } from "@lichess-org/chessground/types";
import { makeSquare } from "chessops";
import { squareFromCoords } from "chessops/util";
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";

export interface BoardSurfaceProps {
  config: Config;
  className?: string;
  style?: CSSProperties & { [key: `--${string}`]: string | number };
  hostRef?: RefObject<HTMLDivElement | null>;
  apiRef?: RefObject<Api | null>;
  onFen?: (fen: string) => void | boolean;
  onSquareClick?: (key: Key) => void;
}

// The native board lifecycle and editing rollback are shared by every platform.
// The surface knows nothing about Tauri, storage, app atoms or game state.
export function BoardSurface(props: BoardSurfaceProps) {
  const internalHost = useRef<HTMLDivElement>(null);
  const host = props.hostRef ?? internalHost;
  const api = useRef<Api | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  useEffect(() => {
    const element = host.current!;
    const initial = latest.current;
    const instance = Chessground(element, {
      ...initial.config,
      // Bind document handlers even if the board initially starts locked.
      viewOnly: false,
      addDimensionsCssVarsTo: element,
      events: {
        ...initial.config.events,
        change: () => {
          const current = latest.current;
          if (current.onFen?.(instance.getFen()) === false)
            instance.set({ fen: current.config.fen });
          current.config.events?.change?.();
        },
      },
    });
    api.current = instance;
    const externalApi = initial.apiRef;
    if (externalApi) externalApi.current = instance;
    let origin: [number, number] | undefined;
    const down = (event: PointerEvent) => {
      origin = [event.clientX, event.clientY];
    };
    const click = (event: MouseEvent) => {
      const current = latest.current;
      if (
        !current.onSquareClick ||
        !origin ||
        Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) >= 6
      )
        return;
      const bounds = element.getBoundingClientRect();
      let file = Math.floor(((event.clientX - bounds.left) / bounds.width) * 8);
      let rank = 7 - Math.floor(((event.clientY - bounds.top) / bounds.height) * 8);
      if (current.config.orientation === "black") {
        file = 7 - file;
        rank = 7 - rank;
      }
      const square = squareFromCoords(file, rank);
      if (square !== undefined) current.onSquareClick(makeSquare(square));
    };
    element.addEventListener("pointerdown", down, true);
    element.addEventListener("click", click);
    return () => {
      element.removeEventListener("pointerdown", down, true);
      element.removeEventListener("click", click);
      instance.destroy();
      api.current = null;
      // This is an output handle for this instance, not a DOM input ref.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      if (externalApi) externalApi.current = null;
    };
  }, [host]);
  useEffect(() => {
    const instance = api.current;
    if (!instance) return;
    const previousViewOnly = instance.state.viewOnly;
    instance.set({
      ...props.config,
      events: {
        ...props.config.events,
        change: () => {
          const current = latest.current;
          if (current.onFen?.(instance.getFen()) === false)
            instance.set({ fen: current.config.fen });
          current.config.events?.change?.();
        },
      },
    });
    if (previousViewOnly !== instance.state.viewOnly) instance.redrawAll();
  }, [props.config]);
  return <div ref={host} className={props.className} style={props.style} />;
}
