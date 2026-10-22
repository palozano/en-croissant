import { useElementSize } from "@mantine/hooks";
import { type ReactNode, useState } from "react";
import { Mosaic } from "react-mosaic-component";

// One notation row, its padding, navigation buttons and the splitter gutter.
const DEFAULT_NOTATION_HEIGHT = 96;

export default function PuzzleBoardLayout({
  board,
  notation,
}: {
  board: ReactNode;
  notation: ReactNode;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const [manualSplit, setManualSplit] = useState<number>();
  // Keep the board square at the full column width, even in a short window.
  const height = width + DEFAULT_NOTATION_HEIGHT;
  const splitPercentage = manualSplit ?? (height > 0 ? (width / height) * 100 : 70);
  return (
    <div ref={ref} style={{ height: "100%", overflowY: "auto" }}>
      <div data-puzzle-board-layout style={{ height, position: "relative" }}>
        <Mosaic<"board" | "notation">
          value={{ direction: "column", first: "board", second: "notation", splitPercentage }}
          onChange={(node) => {
            if (node && typeof node !== "string") {
              setManualSplit(node.splitPercentage ?? 70);
            }
          }}
          resize={{ minimumPaneSizePercentage: height > 0 ? (72 / height) * 100 : 0 }}
          renderTile={(panel) => (panel === "board" ? board : notation)}
        />
      </div>
    </div>
  );
}
