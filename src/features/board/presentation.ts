import type { DrawShape } from "@lichess-org/chessground/draw";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface PresentationSnapshot {
    type: "position";
    fen: string;
    orientation: "white" | "black";
    title: string;
    shapes: DrawShape[];
}
export function presentationChannel(id: string) {
    return `schaak-presentation-${id}`;
}

export function usePresentation(
    snapshot: Omit<PresentationSnapshot, "type">,
    openWindow?: (url: URL, id: string) => Promise<boolean>,
) {
    const [id] = useState(() => crypto.randomUUID());
    const channel = useRef<BroadcastChannel | null>(null);
    const latest = useRef<PresentationSnapshot>({ ...snapshot, type: "position" });
    const popup = useRef<Window | null>(null);
    useLayoutEffect(() => {
        latest.current = { ...snapshot, type: "position" };
        channel.current?.postMessage(latest.current);
    }, [snapshot]);
    useEffect(() => {
        const connection = new BroadcastChannel(presentationChannel(id));
        channel.current = connection;
        connection.onmessage = ({ data }) => {
            if (data === "ready") connection.postMessage(latest.current);
        };
        const closed = () => connection.postMessage({ type: "closed" });
        const resumed = () => connection.postMessage(latest.current);
        window.addEventListener("pagehide", closed);
        window.addEventListener("pageshow", resumed);
        return () => {
            closed();
            connection.close();
            channel.current = null;
            window.removeEventListener("pagehide", closed);
            window.removeEventListener("pageshow", resumed);
        };
    }, [id]);
    return async () => {
        if (popup.current && !popup.current.closed) {
            popup.current.focus();
            return true;
        }
        const url = new URL(location.href);
        url.search = "";
        url.hash = "";
        url.searchParams.set("presentation", id);
        if (openWindow) return openWindow(url, id);
        popup.current = window.open(
            url,
            `presentation-${id}`,
            "popup,width=800,height=840,resizable=yes",
        );
        return !!popup.current;
    };
}
