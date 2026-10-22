import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import GameEndAnimation from "./GameEndAnimation";

vi.mock("@mantine/core", () => ({
  Portal: ({ children }: { children: React.ReactNode }) => children,
}));

test("animates the human result once, clears it, and ignores draws and spectators", async () => {
  vi.useFakeTimers();
  const container = document.createElement("div");
  const root = createRoot(container);
  async function render(
    gameState: string,
    outcome: "*" | "1-0" | "0-1" | "1/2-1/2",
    humanColor: "white" | "black" | null,
  ) {
    await act(async () =>
      root.render(
        <GameEndAnimation gameState={gameState} outcome={outcome} humanColor={humanColor} />,
      ),
    );
  }
  try {
    await render("gameOver", "1-0", "white");
    expect(container.children).toHaveLength(0);
    for (const humanColor of ["white", "black"] as const) {
      await render("playing", "*", humanColor);
      await render("gameOver", humanColor === "white" ? "1-0" : "0-1", humanColor);
      expect(container.querySelectorAll("span")).toHaveLength(80);
      await act(async () => vi.advanceTimersByTime(4000));
      expect(container.children).toHaveLength(0);
      await render("playing", "*", humanColor);
      await render("gameOver", humanColor === "white" ? "0-1" : "1-0", humanColor);
      expect(container.textContent).toBe("💀");
      await act(async () => vi.advanceTimersByTime(2999));
      expect(container.textContent).toBe("💀");
      await act(async () => vi.advanceTimersByTime(1));
      expect(container.children).toHaveLength(0);
    }
    await render("settingUp", "*", "white");
    expect(container.children).toHaveLength(0);
    await render("playing", "*", "white");
    await render("gameOver", "1/2-1/2", "white");
    expect(container.children).toHaveLength(0);
    await render("playing", "*", null);
    await render("gameOver", "1-0", null);
    expect(container.children).toHaveLength(0);
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
  }
});
