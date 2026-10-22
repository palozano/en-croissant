import type { Engine } from "./engines";

export function orderAnalysisEngines(engines: Engine[], activationOrder: string[]): Engine[] {
    const rank = new Map(activationOrder.map((id, index) => [id, index]));
    return engines
        .filter((engine) => engine.loaded)
        .sort(
            (a, b) =>
                (rank.get(a.id) ?? activationOrder.length) -
                (rank.get(b.id) ?? activationOrder.length),
        );
}

export function reorderAnalysisEngines(
    engines: Engine[],
    displayed: Engine[],
    source: number,
    destination: number,
): Engine[] {
    const reordered = [...displayed];
    const [engine] = reordered.splice(source, 1);
    reordered.splice(destination, 0, engine);
    let index = 0;
    return engines.map((entry) => (entry.loaded ? reordered[index++] : entry));
}
