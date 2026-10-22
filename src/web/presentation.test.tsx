import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { usePresentation, type PresentationSnapshot } from "./presentation";

const channels: FakeChannel[] = [];
class FakeChannel {
  onmessage?: (event: { data: unknown }) => void;
  postMessage = vi.fn<(value: unknown) => void>();
  close = vi.fn<() => void>();
  constructor(public name: string) {
    channels.push(this);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  channels.length = 0;
});

it("synchronizes the active study, reuses the popup and signals source closure", async () => {
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const popup = { closed: false, focus: vi.fn<() => void>() };
  const opened = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  let present: () => Promise<boolean>;
  function Source({ snapshot }: { snapshot: Omit<PresentationSnapshot, "type"> }) {
    const open = usePresentation(snapshot);
    useLayoutEffect(() => {
      present = open;
    }, [open]);
    return null;
  }
  const element = document.createElement("div");
  const root = createRoot(element);
  const snapshot = { fen: "initial", title: "Study 1", orientation: "white" as const, shapes: [] };
  act(() => root.render(<Source snapshot={snapshot} />));
  const channel = channels[0];
  channel.onmessage!({ data: "ready" });
  expect(channel.postMessage).toHaveBeenLastCalledWith({ ...snapshot, type: "position" });
  expect(await present!()).toBe(true);
  expect(opened).toHaveBeenCalledOnce();
  expect(String(opened.mock.calls[0][0])).toContain("presentation=");
  await present!();
  expect(opened).toHaveBeenCalledOnce();
  expect(popup.focus).toHaveBeenCalledOnce();
  act(() => root.render(<Source snapshot={{ ...snapshot, fen: "next", orientation: "black" }} />));
  expect(channel.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ fen: "next", orientation: "black" }),
  );
  window.dispatchEvent(new Event("pagehide"));
  expect(channel.postMessage).toHaveBeenLastCalledWith({ type: "closed" });
  window.dispatchEvent(new Event("pageshow"));
  expect(channel.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ fen: "next" }));
  act(() => root.unmount());
  expect(channel.close).toHaveBeenCalledOnce();
});
