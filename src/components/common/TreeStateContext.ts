import { createContext, useContext } from "react";
import type { TreeStore } from "@/state/store/tree";

// Keep context identity separate from the component refreshed by Vite.
export const TreeStateContext = createContext<TreeStore | null>(null);

export function useTreeStore(): TreeStore {
    const store = useContext(TreeStateContext);
    if (!store) {
        throw new Error("useTreeStore must be used within a TreeStateProvider");
    }
    return store;
}
