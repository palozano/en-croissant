import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useStore } from "zustand";
import type { TreeStore } from "@/state/store/tree";
import * as treeModule from "@/state/store/tree";
import { createTab, type Tab } from "@/utils/tabs";
import { defaultTree } from "@/utils/treeReducer";
import { useTreeStore } from "./TreeStateContext";
import { TreeStateProvider } from "./TreeStateProvider";

vi.mock("@/utils/sound", () => ({ playSound: vi.fn<() => void>() }));

const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container.remove();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.append(container);
  root = createRoot(container);
}

it("opens persisted studies with isolated stores and keeps subscriptions on rerender", async () => {
  mount();
  const createStore = vi.spyOn(treeModule, "createTreeStore");
  const first = defaultTree();
  first.headers.event = "First study";
  const second = defaultTree();
  second.headers.event = "Second study";
  sessionStorage.setItem("study-one", JSON.stringify({ version: 0, state: first }));
  sessionStorage.setItem("study-two", JSON.stringify({ version: 0, state: second }));
  const stores: TreeStore[] = [];
  function Analysis({ index }: { index: number }) {
    const store = useTreeStore();
    useEffect(() => {
      stores[index] = store;
    }, [index, store]);
    const event = useStore(store, (state) => state.headers.event);
    return <p>{event}</p>;
  }
  const render = () => (
    <>
      <TreeStateProvider id="study-one">
        <Analysis index={0} />
      </TreeStateProvider>
      <TreeStateProvider id="study-two">
        <Analysis index={1} />
      </TreeStateProvider>
    </>
  );
  await act(async () => root.render(render()));
  expect(container.textContent).toBe("First studySecond study");
  const original = [...stores];
  await act(async () => root.render(render()));
  expect(stores[0]).toBe(original[0]);
  expect(stores[1]).toBe(original[1]);
  expect(stores[0]).not.toBe(stores[1]);
  expect(createStore).toHaveBeenCalledTimes(2);
  await act(async () => stores[0].getState().setHeaders({ ...first.headers, event: "Edited" }));
  expect(container.textContent).toBe("EditedSecond study");
});

it("preserves the shared context when the provider module is reloaded", async () => {
  mount();
  // Simulate a new provider module while existing consumers retain their imports.
  const context = await import("./TreeStateContext");
  vi.resetModules();
  // The context dependency stays cached across a component-only HMR update.
  vi.doMock("./TreeStateContext", () => context);
  try {
    const { TreeStateProvider: ReloadedProvider } = await import("./TreeStateProvider");
    function Analysis() {
      const store = useTreeStore();
      return <p>{useStore(store, (state) => state.dirty) ? "dirty" : "ready"}</p>;
    }
    await act(async () =>
      root.render(
        <ReloadedProvider>
          <Analysis />
        </ReloadedProvider>,
      ),
    );
    expect(container.textContent).toBe("ready");
  } finally {
    vi.doUnmock("./TreeStateContext");
  }
});

it("hydrates the PGN when New Tab replaces its sole new tab with a study", async () => {
  mount();
  let tabs: Tab[] = [{ name: "New Tab", value: "new", type: "new", gameOrigin: { kind: "none" } }];
  let active: string | null = "new";
  const id = await createTab({
    tab: { name: "Study.pgn", type: "analysis" },
    pgn: '[Event "Recent study"]\n\n1. e4 e5 *',
    setTabs: (update) => {
      tabs = typeof update === "function" ? update(tabs) : update;
    },
    setActiveTab: (update) => {
      active = typeof update === "function" ? update(active) : update;
    },
  });
  expect(tabs).toHaveLength(1);
  expect(tabs[0].type).toBe("analysis");
  expect(active).toBe(id);
  function Analysis() {
    const store = useTreeStore();
    const event = useStore(store, (state) => state.headers.event);
    const firstMove = useStore(store, (state) => state.root.children[0]?.san);
    return (
      <p>
        {event}: {firstMove}
      </p>
    );
  }
  await act(async () =>
    root.render(
      <TreeStateProvider key={id} id={id}>
        <Analysis />
      </TreeStateProvider>,
    ),
  );
  expect(container.textContent).toBe("Recent study: e4");
});
