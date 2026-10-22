import type { Outcome } from "@/bindings";

/** Display a personal score without changing the canonical white/black PGN result. */
export function gameResultPresentation(outcome: Outcome, humanColor?: "white" | "black" | null) {
    if (outcome === "*") return { text: outcome, color: "dimmed" } as const;
    if (outcome === "1/2-1/2") return { text: outcome, color: "orange" } as const;
    const won = humanColor === "black" ? outcome === "0-1" : outcome === "1-0";
    return { text: won ? "1-0" : "0-1", color: won ? "green" : "red" } as const;
}
