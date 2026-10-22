import type { NormalMove } from "chessops";
import { getFloatingBoardMove } from "@/utils/floatingBoardProtocol";
import type { Config } from "@lichess-org/chessground/config";
import { useEffect, useLayoutEffect, useRef } from "react";
import { FLOATING_BOARD_CHANNEL, type FloatingBoardSnapshot } from "@/utils/floatingBoardProtocol";

// Only the active main board publishes; secondary boards (previews, editors) do not.
export function useBoardMirror(
    enabled: boolean,
    element: React.RefObject<HTMLDivElement | null>,
    config: Config,
    is3d: boolean,
    boardImage: string,
    autoPromote: boolean,
    onMove?: (move: NormalMove) => void,
) {
    const channel = useRef<BroadcastChannel | null>(null);
    const latest = useRef<FloatingBoardSnapshot | null>(null);

    const moveHandler = useRef(onMove);
    useLayoutEffect(() => {
        moveHandler.current = onMove;
    }, [onMove]);
    const playableState = useRef("");
    const revision = useRef(crypto.randomUUID());

    useEffect(() => {
        if (!enabled) return;
        const connection = new BroadcastChannel(FLOATING_BOARD_CHANNEL);
        channel.current = connection;
        connection.onmessage = ({ data }) => {
            if (data === "ready") {
                connection.postMessage(latest.current);
                return;
            }
            const move = getFloatingBoardMove(latest.current, data);
            if (move && latest.current) {
                latest.current = {
                    ...latest.current,
                    revision: crypto.randomUUID(),
                    config: { ...latest.current.config, viewOnly: true },
                };
                playableState.current = "";
                moveHandler.current?.(move);
            }
            // Reset optimistic moves, rejected requests and cancelled promotions alike.
            connection.postMessage(latest.current);
        };
        return () => {
            connection.postMessage(null);
            connection.close();
            channel.current = null;
        };
    }, [enabled]);

    useLayoutEffect(() => {
        if (!enabled || !element.current) return;
        const computed = getComputedStyle(element.current);
        const styles = Object.fromEntries(
            ["--board-image", "--board-coord-color-white", "--board-coord-color-black"].map(
                (key) => [key, computed.getPropertyValue(key)],
            ),
        );
        const movable = config.movable;
        const state = JSON.stringify([
            config.fen,
            config.viewOnly,
            movable?.free,
            movable?.color,
            [...(movable?.dests ?? [])],
        ]);
        if (state !== playableState.current) {
            revision.current = crypto.randomUUID();
            playableState.current = state;
        }
        latest.current = {
            revision: revision.current,
            autoPromote,
            config: {
                fen: config.fen,
                viewOnly: config.viewOnly || !!movable?.free || !onMove,
                movable: {
                    free: false,
                    color: movable?.color,
                    dests: movable?.dests,
                    showDests: movable?.showDests,
                },
                draggable: { enabled: config.draggable?.enabled },
                selectable: { enabled: config.selectable?.enabled },
                orientation: config.orientation,
                turnColor: config.turnColor,
                check: config.check,
                lastMove: config.lastMove,
                coordinates: config.coordinates,
                coordinatesOnSquares: config.coordinatesOnSquares,
                drawable: {
                    autoShapes: config.drawable?.autoShapes,
                    brushes: config.drawable?.brushes,
                },
            },
            is3d,
            styles,
            pieceStylesheet:
                document
                    .querySelector<HTMLLinkElement>('link[href*="/pieces"]')
                    ?.getAttribute("href") || "/pieces/cburnett.css",
        };
        channel.current?.postMessage(latest.current);
    }, [enabled, element, config, is3d, boardImage, autoPromote, onMove]);
}
