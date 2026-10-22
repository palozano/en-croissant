import type { DrawShape } from "@lichess-org/chessground/draw";
import { BoardSurface } from "@/features/board/BoardSurface";
import type { Api } from "@lichess-org/chessground/api";
import type { Key } from "@lichess-org/chessground/types";
import { chessgroundDests } from "chessops/compat";
import { Chess, parseSquare, type NormalMove, type Piece } from "chessops";
import { parseFen } from "chessops/fen";
import { useLayoutEffect, useRef, useState } from "react";
import "@/styles/chessgroundBaseOverride.css";
import "@/styles/chessgroundColorsOverride.css";

interface Props {
  size?: number;
  fitViewport?: boolean;
  onSizeChange?: (size: number) => void;
  fen: string;
  orientation: "white" | "black";
  editing: boolean;
  onMove: (move: NormalMove) => void;
  onFen: (fen: string) => void | boolean;
  suggestedMove?: DrawShape;
  onShapes?: (shapes: DrawShape[]) => void;
  onSquare: (key: Key) => void;
}
export default function StudyBoard(props: Props) {
  const api = useRef<Api | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!props.fitViewport || props.size !== undefined) return;
    const update = () => {
      if (stage.current) {
        setAvailableHeight(
          Math.max(
            0,
            window.innerHeight - stage.current.getBoundingClientRect().top - window.scrollY - 16,
          ),
        );
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage.current!);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [props.fitViewport, props.size]);
  const resize = useRef<{ x: number; y: number; width: number; maximum: number } | null>(null);
  const changeSize = (value: number) =>
    props.onSizeChange?.(Math.round(Math.max(50, Math.min(100, value))));
  const [promotion, setPromotion] = useState<{
    from: number;
    to: number;
    fen: string;
    color: Piece["color"];
  } | null>(null);
  const parsed = parseFen(props.fen);
  const position = parsed.isOk ? Chess.fromSetup(parsed.value) : null;
  const pos = position?.isOk ? position.value : null;
  const config = {
    fen: props.fen,
    orientation: props.orientation,
    turnColor: pos?.turn ?? ("white" as const),
    check: !props.editing && !!pos?.isCheck(),
    coordinates: true,
    movable: {
      free: props.editing,
      color: props.editing ? ("both" as const) : pos?.turn,
      dests: props.editing ? undefined : pos ? chessgroundDests(pos) : new Map(),
      showDests: true,
      events: {
        after: (fromKey: Key, toKey: Key) => {
          if (props.editing) return;
          const from = parseSquare(fromKey)!;
          const to = parseSquare(toKey)!;
          const piece = parseFen(props.fen).unwrap().board.get(from);
          if (piece?.role === "pawn" && toKey[1] === (piece.color === "white" ? "8" : "1")) {
            api.current?.set({ fen: props.fen });
            api.current?.stop();
            setPromotion({ from, to, fen: props.fen, color: piece.color });
          } else props.onMove({ from, to });
        },
      },
    },
    draggable: { enabled: true, deleteOnDropOff: props.editing },
    selectable: { enabled: true },
    premovable: { enabled: false },
    drawable: {
      enabled: !props.editing,
      onChange: props.onShapes,
      autoShapes: !props.editing && props.suggestedMove ? [props.suggestedMove] : [],
    },
  };
  const pending = promotion?.fen === props.fen ? promotion : null;
  return (
    <div className="web-board-stage" ref={stage}>
      <div
        className="web-board-shell"
        style={{
          width:
            props.size === undefined && props.fitViewport && availableHeight !== undefined
              ? `min(100%, ${availableHeight}px)`
              : `${props.size ?? 100}%`,
        }}
      >
        <BoardSurface
          config={config}
          apiRef={api}
          className="web-board"
          onFen={props.editing ? props.onFen : undefined}
          onSquareClick={props.editing ? props.onSquare : undefined}
        />
        {props.onSizeChange && (
          <button
            className="web-board-resize"
            aria-label="Resize board"
            title="Drag to resize board. Double-click to reset."
            onDoubleClick={() => changeSize(100)}
            onKeyDown={(event) => {
              const delta = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 }[event.key];
              if (delta !== undefined || event.key === "Home" || event.key === "End") {
                event.preventDefault();
                changeSize(
                  event.key === "Home"
                    ? 50
                    : event.key === "End"
                      ? 100
                      : (props.size ?? 100) + (delta ?? 0),
                );
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              const maximum = stage.current!.getBoundingClientRect().width;
              resize.current = {
                x: event.clientX,
                y: event.clientY,
                width: stage.current!.querySelector(".web-board-shell")!.getBoundingClientRect()
                  .width,
                maximum,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const start = resize.current;
              if (!start) return;
              // The board stays centered, so its right edge moves half its width change.
              const delta = (2 * (event.clientX - start.x) + event.clientY - start.y) / 2;
              changeSize(((start.width + delta) / start.maximum) * 100);
            }}
            onPointerUp={(event) => {
              resize.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              resize.current = null;
            }}
            onLostPointerCapture={() => {
              resize.current = null;
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M4 14 14 4M9 14l5-5M14 14h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        {pending && (
          <div className="web-promotion" role="dialog" aria-label="Promotion">
            {(["queen", "rook", "bishop", "knight"] as const).map((role, index) => (
              <button
                key={role}
                aria-label={role}
                onClick={() => {
                  props.onMove({ from: pending.from, to: pending.to, promotion: role });
                  setPromotion(null);
                }}
              >
                {(pending.color === "white" ? ["♕", "♖", "♗", "♘"] : ["♛", "♜", "♝", "♞"])[index]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
