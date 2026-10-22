import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import MoveTree from "./MoveTree";
import { importStudies } from "@/features/studies/model";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const host = document.createElement("div");
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host.remove();
});

it("pairs moves, inserts alternatives at their fork, folds branches and reveals a nested selection", async () => {
  const [study] = importStudies("1. e4 e5 2. Nf3 (2. Bc4 Bc5 3. d3 (3. Nc3 Nf6)) Nc6 *");
  document.body.append(host);
  root = createRoot(host);
  const select = vi.fn<(path: number[]) => void>();
  const render = (path: number[]) => (
    <MoveTree root={study.root} path={path} onSelect={select} comments={(node) => node.comments} />
  );
  await act(async () => root.render(render([])));
  const firstRow = host.querySelector(".move-tree-row")!;
  expect(firstRow.textContent).toBe("1.e4e5");
  const toggles = () => [...host.querySelectorAll<HTMLButtonElement>(".move-tree-branch-toggle")];
  expect(toggles()[0].textContent).toContain("Alternative to 2.Nf3: 2.Bc4");
  expect(toggles()[0].getAttribute("aria-expanded")).toBe("true");
  expect(toggles()[1].getAttribute("aria-expanded")).toBe("false");
  await act(async () => toggles()[0].click());
  expect(host.textContent).not.toContain("Bc5");
  // Enter a nested line using the same path update supplied by keyboard navigation.
  const selected = [0, 0, 1, 0, 1, 0];
  await act(async () => root.render(render(selected)));
  expect(host.querySelector('[data-selected="true"]')?.textContent).toBe("Nf6");
  expect(host.querySelector(".move-tree-location")?.textContent).toBe("Principal › 2.Bc4 › 3.Nc3");
  expect(toggles().every((button) => button.getAttribute("aria-expanded") === "true")).toBe(true);
  const move = [...host.querySelectorAll<HTMLButtonElement>(".move-tree-cell button")].find(
    (button) => button.textContent === "Bc5",
  )!;
  await act(async () => move.click());
  expect(select).toHaveBeenCalledWith([0, 0, 1, 0]);
});

it("numbers black-to-move FEN positions correctly and collapses long comments", async () => {
  const [study] = importStudies(
    '[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 12"]\n\n12... e5 *',
  );
  study.root.children[0].comments = ["A long explanation. ".repeat(20)];
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MoveTree
        root={study.root}
        path={[]}
        onSelect={() => {}}
        comments={(node) => node.comments}
      />,
    ),
  );
  expect(host.querySelector(".move-tree-number")?.textContent).toBe("12...");
  expect(host.querySelector(".move-tree-row > .move-tree-cell:last-child")?.textContent).toBe("e5");
  expect(host.querySelector("details.move-tree-comment")?.hasAttribute("open")).toBe(false);
});
