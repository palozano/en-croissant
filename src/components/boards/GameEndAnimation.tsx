import { Portal } from "@mantine/core";
import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import type { Outcome } from "@/bindings";
import classes from "./GameEndAnimation.module.css";

type Props = {
  boardRef?: RefObject<HTMLDivElement | null>;
  gameState: string;
  outcome: Outcome;
  humanColor: "white" | "black" | null;
};

const colors = ["#ffd43b", "#ff6b6b", "#69db7c", "#74c0fc", "#da77f2", "#ffa94d"];

export default function GameEndAnimation({ gameState, outcome, humanColor, boardRef }: Props) {
  const [previousState, setPreviousState] = useState(gameState);
  const [effect, setEffect] = useState<"win" | "loss" | null>(null);

  if (previousState !== gameState) {
    setPreviousState(gameState);
    const justFinished = previousState === "playing" && gameState === "gameOver";
    const winner = outcome === "1-0" ? "white" : outcome === "0-1" ? "black" : null;
    setEffect(
      justFinished && humanColor && winner ? (winner === humanColor ? "win" : "loss") : null,
    );
  }

  useEffect(() => {
    if (!effect) return;
    const timer = window.setTimeout(() => setEffect(null), effect === "loss" ? 3000 : 4000);
    return () => window.clearTimeout(timer);
  }, [effect]);

  if (!effect) return null;

  return (
    <Portal target={effect === "loss" ? (boardRef?.current ?? undefined) : undefined}>
      <div
        className={`${classes.overlay} ${effect === "loss" ? classes.boardOverlay : ""}`}
        aria-hidden="true"
      >
        {effect === "win" ? (
          Array.from({ length: 80 }, (_, index) => (
            <span
              key={index}
              className={classes.confetti}
              style={
                {
                  left: `${(index * 37) % 100}%`,
                  backgroundColor: colors[index % colors.length],
                  "--delay": `${(index % 13) * 65}ms`,
                  "--drift": `${((index * 19) % 240) - 120}px`,
                  "--rotation": `${360 + (index % 5) * 180}deg`,
                } as CSSProperties
              }
            />
          ))
        ) : (
          <span className={classes.skull}>💀</span>
        )}
      </div>
    </Portal>
  );
}
