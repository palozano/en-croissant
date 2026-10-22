import { atom, type SetStateAction } from "jotai";
import { atomFamily } from "jotai/utils";

export const engineActivationOrderFamily = atomFamily((_tab: string) => atom<string[]>([]));

export function createEngineSettingsAtom<T extends { enabled: boolean }>(
    initial: T,
    tab: string,
    engineId: string,
) {
    const settings = atom(initial);
    return atom(
        (get) => get(settings),
        (get, set, update: SetStateAction<T>) => {
            const previous = get(settings);
            const next = typeof update === "function" ? update(previous) : update;
            if (previous.enabled !== next.enabled) {
                set(engineActivationOrderFamily(tab), (order) => {
                    const withoutEngine = order.filter((id) => id !== engineId);
                    return next.enabled ? [...withoutEngine, engineId] : withoutEngine;
                });
            }
            set(settings, next);
        },
    );
}
