import { useState, type ReactNode } from "react";
import { createTreeStore } from "@/state/store/tree";
import type { TreeState } from "@/utils/treeReducer";
import { TreeStateContext } from "./TreeStateContext";

export function TreeStateProvider({
  id,
  initial,
  children,
}: {
  id?: string;
  initial?: TreeState;
  children: ReactNode;
}) {
  const [store] = useState(() => createTreeStore(id, initial));
  return <TreeStateContext.Provider value={store}>{children}</TreeStateContext.Provider>;
}
