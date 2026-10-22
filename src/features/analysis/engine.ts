export interface EngineLine {
    depth: number;
    multipv: number;
    score: string;
    pv: string[];
}
export interface EngineState {
    status: "loading" | "ready" | "searching" | "error";
    lines: EngineLine[];
    error?: string;
}
export interface EngineClient {
    analyze(fen: string, depth?: number): void;
    stop(): void;
    dispose(): void;
}
export type EngineFactory = (publish: (state: EngineState) => void) => EngineClient;
