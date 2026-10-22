import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { createEngineSettingsAtom, engineActivationOrderFamily } from "@/state/engineActivation";
import { orderAnalysisEngines, reorderAnalysisEngines } from "../analysisEngineOrder";
import type { Engine } from "../engines";

const engine = (id: string, loaded = true): Engine => ({
    id,
    name: id,
    loaded,
    type: "local",
    path: "",
    version: "",
});
const engines = [engine("stockfish"), engine("dragon"), engine("komodo")];

function settings(store: ReturnType<typeof createStore>, id: string, tab = "analysis") {
    const atom = createEngineSettingsAtom<{ enabled: boolean; hash: number }>(
        { enabled: false, hash: 128 },
        tab,
        id,
    );
    return {
        set: (enabled: boolean) => store.set(atom, (previous) => ({ ...previous, enabled })),
        atom,
    };
}

describe("active analysis engine order", () => {
    it("moves Komodo first and appends Stockfish when enabled next", () => {
        const store = createStore();
        const komodo = settings(store, "komodo");
        const stockfish = settings(store, "stockfish");
        komodo.set(true);
        expect(
            orderAnalysisEngines(engines, store.get(engineActivationOrderFamily("analysis"))).map(
                (e) => e.id,
            ),
        ).toEqual(["komodo", "stockfish", "dragon"]);
        stockfish.set(true);
        expect(store.get(engineActivationOrderFamily("analysis"))).toEqual(["komodo", "stockfish"]);
        expect(
            orderAnalysisEngines(engines, store.get(engineActivationOrderFamily("analysis"))).map(
                (e) => e.id,
            ),
        ).toEqual(["komodo", "stockfish", "dragon"]);
    });

    it("puts a reactivated engine after the motors that are still running", () => {
        const store = createStore();
        const komodo = settings(store, "komodo");
        const stockfish = settings(store, "stockfish");
        komodo.set(true);
        stockfish.set(true);
        komodo.set(false);
        expect(store.get(engineActivationOrderFamily("analysis"))).toEqual(["stockfish"]);
        komodo.set(true);
        expect(store.get(engineActivationOrderFamily("analysis"))).toEqual(["stockfish", "komodo"]);
    });

    it("does not reorder active engines when settings change or enable-all repeats", () => {
        const store = createStore();
        const komodo = settings(store, "komodo");
        const stockfish = settings(store, "stockfish");
        komodo.set(true);
        stockfish.set(true);
        store.set(komodo.atom, (previous) => ({ ...previous, hash: 256 }));
        stockfish.set(true);
        komodo.set(true);
        expect(store.get(engineActivationOrderFamily("analysis"))).toEqual(["komodo", "stockfish"]);
    });

    it("keeps each analysis tab's activation sequence independent", () => {
        const store = createStore();
        settings(store, "komodo", "first-tab").set(true);
        settings(store, "stockfish", "second-tab").set(true);
        expect(store.get(engineActivationOrderFamily("first-tab"))).toEqual(["komodo"]);
        expect(store.get(engineActivationOrderFamily("second-tab"))).toEqual(["stockfish"]);
    });

    it("preserves the order of inactive engines and excludes unloaded engines", () => {
        const source = [
            engine("stockfish"),
            engine("unloaded", false),
            engine("dragon"),
            engine("komodo"),
        ];
        expect(orderAnalysisEngines(source, ["unloaded", "komodo"]).map((e) => e.id)).toEqual([
            "komodo",
            "stockfish",
            "dragon",
        ]);
        expect(source.map((e) => e.id)).toEqual(["stockfish", "unloaded", "dragon", "komodo"]);
    });

    it("uses the displayed order for dragging, leaving unloaded entries in their slots", () => {
        const source = [
            engine("stockfish"),
            engine("unloaded", false),
            engine("dragon"),
            engine("komodo"),
        ];
        const displayed = orderAnalysisEngines(source, ["komodo", "stockfish"]);
        const reordered = reorderAnalysisEngines(source, displayed, 0, 1);
        expect(reordered.map((e) => e.id)).toEqual(["stockfish", "unloaded", "komodo", "dragon"]);
    });
});
