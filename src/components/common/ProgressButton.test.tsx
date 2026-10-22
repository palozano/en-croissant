// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import ProgressButton from "./ProgressButton";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args: unknown) => Promise<void>>().mockResolvedValue(undefined),
  clear: vi.fn<() => void>(),
  notify: vi.fn<() => void>(),
  progress: {
    progress: 25,
    finished: false,
    isActive: true,
    bytesPerSecond: 1048576 as number | null,
  },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({
    ...mocks.progress,
    clear: mocks.clear,
  }),
}));

it("cancels the backend transfer without allowing a retry before it settles", async () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }),
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const setInProgress = vi.fn<() => void>();
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "engine_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick: vi.fn<() => void>(),
          inProgress: true,
          setInProgress,
          labels: { completed: "Installed", action: "Download", inProgress: "Downloading" },
        }),
      ),
    ),
  );
  expect(host.textContent).toContain("Downloading · 1 MB/s");
  mocks.progress.bytesPerSecond = 0;
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "engine_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick: vi.fn<() => void>(),
          inProgress: true,
          setInProgress,
          labels: {
            completed: "Installed",
            action: "Download",
            inProgress: "Downloading",
            finalizing: "Extracting",
          },
        }),
      ),
    ),
  );
  expect(host.textContent).toContain("Downloading · 0 KB/s");
  const cancel = host.querySelector<HTMLButtonElement>('[aria-label="Common.Cancel"]');
  expect(cancel).not.toBeNull();
  await act(async () => cancel!.click());
  expect(mocks.invoke).toHaveBeenCalledWith("cancel_download", { id: "engine_1" });
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(setInProgress).not.toHaveBeenCalled();
  mocks.progress.progress = 100;
  await act(async () =>
    root.render(
      createElement(
        MantineProvider,
        {},
        createElement(ProgressButton, {
          id: "engine_1",
          cancellableDownload: true,
          initInstalled: false,
          onClick: vi.fn<() => void>(),
          inProgress: true,
          setInProgress,
          labels: {
            completed: "Installed",
            action: "Download",
            inProgress: "Downloading",
            finalizing: "Extracting",
          },
        }),
      ),
    ),
  );
  expect(host.textContent).toContain("Extracting");
  expect(host.textContent).not.toContain("KB/s");
  await act(async () => root.unmount());
  host.remove();
});
