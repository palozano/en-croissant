import { MantineProvider } from "@mantine/core";
import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createTreeStore } from "@/state/store/tree";
import { parsePGN } from "@/utils/chess";
import { tableViewAtom } from "@/state/atoms";
import GameNotation from "./GameNotation";
import { TreeStateContext } from "./TreeStateContext";

vi.mock("@/utils/sound", () => ({ playSound: vi.fn<() => void>() }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "linux" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./OpeningName", () => ({ default: () => null }));

it("uses the shared table in the desktop GUI while retaining annotations and move menus", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const originalScroll = HTMLElement.prototype.scrollTo;
  HTMLElement.prototype.scrollTo = () => {};
  const tree = await parsePGN("1. e4 $1 (1. d4 d5) e5 *");
  const store = createTreeStore(undefined, tree);
  const atoms = createStore();
  atoms.set(tableViewAtom, true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <Provider store={atoms}>
          <MantineProvider env="test">
            <TreeStateContext.Provider value={store}>
              <GameNotation />
            </TreeStateContext.Provider>
          </MantineProvider>
        </Provider>,
      ),
    );
    expect(host.querySelector(".move-tree")).not.toBeNull();
    const e4 = [...host.querySelectorAll("button")].find((button) => button.textContent === "e4!")!;
    expect(e4).toBeDefined();
    await act(async () => e4.click());
    expect(store.getState().position).toEqual([0]);
    expect(host.querySelector('[data-selected="true"]')?.textContent).toContain("e4!");
    await act(async () =>
      host
        .querySelector<HTMLElement>('[data-selected="true"] button')!
        .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
    );
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    await act(async () => store.getState().goToMove([1, 0]));
    expect(host.querySelector('[data-selected="true"]')?.textContent).toContain("d5");
    expect(host.querySelector(".move-tree-location")?.textContent).toContain("1.d4");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    HTMLElement.prototype.scrollTo = originalScroll;
    vi.unstubAllGlobals();
  }
});
