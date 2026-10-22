import { Chessground } from "@lichess-org/chessground";
import type { Key } from "@lichess-org/chessground/types";
import { parseSquare } from "chessops";
import { parseFen } from "chessops/fen";
import {
    FLOATING_BOARD_CHANNEL,
    type FloatingBoardSnapshot,
    type FloatingBoardMoveRequest,
} from "./utils/floatingBoardProtocol";
import "./styles/chessgroundBaseOverride.css";
import "./styles/chessgroundColorsOverride.css";

const style = document.createElement("style");
style.textContent = `html, body { margin: 0; width: 100%; height: 100%; background: #25262b; overflow: hidden; }
body { display: grid; place-items: center; } #app { width: min(100vw, 100vh); }
.promotion-overlay { position: fixed; inset: 0; z-index: 100; display: flex; justify-content: center; align-items: center; background: #0008; }
.promotion-overlay button { font-size: clamp(24px, 8vw, 60px); cursor: pointer; color: #111; background: #eee; border: 1px solid #888; padding: 8px; }
.promotion-overlay button:focus-visible { outline: 3px solid #228be6; }`;
document.head.append(style);
const pieces = document.createElement("link");
pieces.rel = "stylesheet";
document.head.append(pieces);
const container = document.getElementById("app")!;
const board = document.createElement("div");
container.append(board);
// Bind document drag handlers from the start; Chessground cannot toggle viewOnly dynamically.
const api = Chessground(board, {
    viewOnly: false,
    movable: { color: undefined },
    drawable: { enabled: false },
});
const channel = new BroadcastChannel(FLOATING_BOARD_CHANNEL);
let snapshot: FloatingBoardSnapshot | null = null;
let rendered3d: boolean | undefined;
let promotionOverlay: HTMLDivElement | undefined;

function cancelPromotion() {
    promotionOverlay?.remove();
    promotionOverlay = undefined;
}

function sendMove(request: FloatingBoardMoveRequest) {
    cancelPromotion();
    api.stop();
    channel.postMessage(request);
}

function afterMove(from: Key, to: Key, metadata: { ctrlKey?: boolean }) {
    if (!snapshot || snapshot.config.viewOnly) return;
    const request: FloatingBoardMoveRequest = {
        type: "move",
        revision: snapshot.revision,
        from,
        to,
    };
    const setup = parseFen(snapshot.config.fen ?? "").unwrap();
    const square = parseSquare(from);
    const piece = square === undefined ? undefined : setup.board.get(square);
    const promoting = piece?.role === "pawn" && to[1] === (piece.color === "white" ? "8" : "1");
    // The main window confirms every move before another move can be made here.
    api.set({ fen: snapshot.config.fen });
    api.stop();
    if (!promoting) {
        sendMove(request);
        return;
    }
    if (snapshot.autoPromote && !metadata.ctrlKey) {
        sendMove({ ...request, promotion: "queen" });
        return;
    }

    promotionOverlay = document.createElement("div");
    promotionOverlay.className = "promotion-overlay";
    promotionOverlay.setAttribute("role", "dialog");
    promotionOverlay.setAttribute("aria-modal", "true");
    promotionOverlay.setAttribute("aria-label", "Promotion");
    const symbols = piece.color === "white" ? ["♕", "♖", "♗", "♘"] : ["♛", "♜", "♝", "♞"];
    const roles = ["queen", "rook", "bishop", "knight"] as const;
    roles.forEach((promotion, index) => {
        const button = document.createElement("button");
        button.textContent = symbols[index];
        button.setAttribute("aria-label", promotion);
        button.onclick = () => sendMove({ ...request, promotion });
        promotionOverlay!.append(button);
    });
    promotionOverlay.onclick = (event) => {
        if (event.target === promotionOverlay) {
            cancelPromotion();
            renderSnapshot();
        }
    };
    document.body.append(promotionOverlay);
    promotionOverlay.querySelector("button")?.focus();
}

function renderSnapshot() {
    board.style.visibility = snapshot ? "visible" : "hidden";
    if (!snapshot) {
        api.stop();
        return;
    }
    pieces.setAttribute("href", snapshot.pieceStylesheet);
    board.classList.toggle("is3d", snapshot.is3d);
    board.style.width = "100%";
    board.style.aspectRatio = snapshot.is3d ? "auto" : "1";
    board.style.paddingBottom = snapshot.is3d ? "91%" : "0";
    for (const [key, value] of Object.entries(snapshot.styles)) board.style.setProperty(key, value);
    api.set({
        ...snapshot.config,
        viewOnly: false,
        movable: {
            ...snapshot.config.movable,
            color: snapshot.config.viewOnly ? undefined : snapshot.config.movable?.color,
            events: { after: afterMove },
        },
        premovable: { enabled: false },
        drawable: { ...snapshot.config.drawable, enabled: false },
        addPieceZIndex: snapshot.is3d,
    });
    if (promotionOverlay) api.stop();
    if (rendered3d !== snapshot.is3d) {
        rendered3d = snapshot.is3d;
        api.redrawAll();
    }
}

channel.onmessage = ({ data }: MessageEvent<FloatingBoardSnapshot | null>) => {
    if (snapshot?.revision !== data?.revision) cancelPromotion();
    snapshot = data;
    renderSnapshot();
};
window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && promotionOverlay) {
        cancelPromotion();
        renderSnapshot();
    }
});
board.style.visibility = "hidden";
channel.postMessage("ready");
window.addEventListener("unload", () => {
    channel.close();
    api.destroy();
});
