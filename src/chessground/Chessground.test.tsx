import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import { INITIAL_FEN } from "chessops/fen";

const state = vi.hoisted(() => ({ api: undefined as Api | undefined, method: "select" }));
vi.mock("@/state/atoms", () => ({
  autoPromoteAtom: "autoPromote",
  boardImageAtom: "boardImage",
  is3dAtom: "is3d",
  moveMethodAtom: "moveMethod",
}));
vi.mock("jotai", () => ({
  useAtomValue: (atom: string) => {
    if (atom === "moveMethod") return state.method;
    if (atom === "boardImage") return "blue.jpg";
    return false;
  },
}));
vi.mock("./useBoardMirror", () => ({ useBoardMirror: () => {} }));
vi.mock("@mantine/core", () => ({
  Box: (props: Record<string, unknown>) => createElement("div", props),
}));
vi.mock("@lichess-org/chessground", async (importOriginal) => {
  const original = await importOriginal<typeof import("@lichess-org/chessground")>();
  return {
    Chessground: (element: HTMLElement, config: Config) => {
      state.api = original.Chessground(element, config);
      return state.api;
    },
  };
});
import { Chessground } from "./Chessground";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  state.method = "select";
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  state.api?.destroy();
  container.remove();
  vi.useRealTimers();
});

function render(editing: boolean, onChange = vi.fn<(fen: string) => void>()) {
  act(() =>
    root.render(
      <Chessground
        fen={INITIAL_FEN}
        movable={{ free: editing, color: "both" }}
        draggable={{ deleteOnDropOff: editing }}
        setBoardFen={onChange}
      />,
    ),
  );
  return onChange;
}

function dropOutside() {
  const api = state.api!;
  // Start a real Chessground drag and let its document mouseup handler finish it.
  const bounds = { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 } as DOMRect;
  api.state.trustAllEvents = true;
  api.state.dom.bounds = Object.assign(() => bounds, { clear: () => {} });
  api.state.dom.elements.board.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: 25,
      clientY: 325,
      buttons: 1,
      button: 0,
    }),
  );
  expect(api.state.draggable.current?.orig).toBe("a2");
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 450, clientY: 325 }));
  act(() => vi.advanceTimersByTime(10));
}

describe("editing board drag deletion", () => {
  it("deletes a piece dropped outside even when moves normally use clicks", () => {
    const changed = render(true);
    expect(state.api!.state.draggable.enabled).toBe(true);
    dropOutside();
    expect(state.api!.state.pieces.has("a2")).toBe(false);
    expect(changed).toHaveBeenCalledWith("rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR");
  });

  it("restores the normal click-only preference when editing ends", () => {
    render(true);
    render(false);
    expect(state.api!.state.draggable.enabled).toBe(false);
    expect(state.api!.state.draggable.deleteOnDropOff).toBe(false);
  });

  it("keeps off-board drops from deleting pieces outside editing mode", () => {
    state.method = "drag";
    const changed = render(false);
    dropOutside();
    expect(state.api!.state.pieces.has("a2")).toBe(true);
    expect(changed).not.toHaveBeenCalled();
  });
});
