import { expect, test } from "vitest";
import { gameResultPresentation } from "../gameResult";

test.each([
    ["1-0", "white", "1-0", "green"],
    ["0-1", "white", "0-1", "red"],
    ["0-1", "black", "1-0", "green"],
    ["1-0", "black", "0-1", "red"],
    ["1/2-1/2", "white", "1/2-1/2", "orange"],
    ["1/2-1/2", "black", "1/2-1/2", "orange"],
    ["*", "white", "*", "dimmed"],
] as const)("displays %s from the %s player's perspective", (outcome, color, text, resultColor) => {
    expect(gameResultPresentation(outcome, color)).toEqual({ text, color: resultColor });
});
