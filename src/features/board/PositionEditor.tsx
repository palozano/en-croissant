import { COLORS, ROLES, type Piece } from "chessops";
import { EMPTY_FEN, INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { parseSquare } from "chessops";
import type { ReactNode } from "react";
import {
  getPositionMaterialError,
  getStudyPositionError,
  isPositionRemoval,
} from "@/utils/positionEditor";
import "./positionEditor.css";

export type EditorSelection = Piece | "erase" | null;
export function PiecePalette({
  selection,
  onSelect,
  renderPiece,
}: {
  selection: EditorSelection;
  onSelect: (piece: Piece | null) => void;
  renderPiece?: (piece: Piece, selected: boolean, select: () => void) => ReactNode;
}) {
  return (
    <div className="study-piece-palette">
      {COLORS.flatMap((color) =>
        ROLES.map((role) => {
          const piece = { color, role };
          const selected =
            selection !== "erase" && selection?.color === color && selection.role === role;
          const select = () => onSelect(selected ? null : piece);
          return (
            <div key={color + role}>
              {renderPiece ? (
                renderPiece(piece, selected, select)
              ) : (
                <button
                  aria-label={`${color} ${role}`}
                  className={selected ? "selected" : ""}
                  onClick={select}
                >
                  <span aria-hidden="true" className={`study-palette-piece ${color} ${role}`} />
                </button>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function PositionEditor({
  fen,
  selection,
  onSelect,
  onChange,
  onError,
  actions,
  translate = (_key, fallback) => fallback,
  renderPiece,
}: {
  fen: string;
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onChange: (fen: string) => void;
  onError: (message: string) => void;
  actions?: ReactNode;
  translate?: (key: string, fallback: string) => string;
  renderPiece?: (piece: Piece, selected: boolean, select: () => void) => ReactNode;
}) {
  const t = translate;
  const setup = parseFen(fen);
  if (setup.isErr) return <p role="alert">{t("Errors.InvalidFen", "Invalid FEN.")}</p>;
  const error = getStudyPositionError(fen);
  const change = (next: string) => {
    const invalid = getPositionMaterialError(next);
    if (invalid && !isPositionRemoval(fen, next)) {
      onError(t(invalid, invalid));
      return;
    }
    onChange(next);
  };
  return (
    <section className="study-position-editor">
      <h2>{t("Board.Editor.Title", "Create a study position")}</h2>
      <p>
        {t(
          "Board.Editor.Help",
          "Select a piece and click a square. Drag pieces to move them; drop them outside the board to remove them.",
        )}
      </p>
      <PiecePalette selection={selection} onSelect={onSelect} renderPiece={renderPiece} />
      <div className="study-editor-actions">
        <button
          className={selection === "erase" ? "selected" : ""}
          onClick={() => onSelect(selection === "erase" ? null : "erase")}
        >
          {t("Board.Editor.Erase", "Eraser")}
        </button>
        <button
          onClick={() => change(setup.value.board.occupied.isEmpty() ? INITIAL_FEN : EMPTY_FEN)}
        >
          {setup.value.board.occupied.isEmpty()
            ? t("Fen.Start", "Initial board")
            : t("Fen.Empty", "Empty board")}
        </button>
      </div>
      <label>
        {t("Board.Editor.SideToMove", "Side to move")}
        <select
          value={setup.value.turn}
          onChange={(event) => {
            const value = parseFen(fen).unwrap();
            value.turn = event.target.value as "white" | "black";
            onChange(makeFen(value));
          }}
        >
          <option value="white">{t("Fen.White", "White")}</option>
          <option value="black">{t("Fen.Black", "Black")}</option>
        </select>
      </label>
      <fieldset className="study-castling">
        <legend>{t("Board.Editor.Castling", "Castling rights")}</legend>
        {(
          [
            ["h1", "e1", "white", "White O-O"],
            ["a1", "e1", "white", "White O-O-O"],
            ["h8", "e8", "black", "Black O-O"],
            ["a8", "e8", "black", "Black O-O-O"],
          ] as const
        ).map(([rookKey, kingKey, color, label]) => {
          const value = setup.value;
          const rook = parseSquare(rookKey)!;
          const king = parseSquare(kingKey)!;
          const available =
            value.board.get(king)?.role === "king" &&
            value.board.get(king)?.color === color &&
            value.board.get(rook)?.role === "rook" &&
            value.board.get(rook)?.color === color;
          return (
            <label key={rookKey}>
              <input
                type="checkbox"
                checked={available && value.castlingRights.has(rook)}
                disabled={!available}
                onChange={(event) => {
                  const next = parseFen(fen).unwrap();
                  next.castlingRights = next.castlingRights.set(rook, event.target.checked);
                  onChange(makeFen(next));
                }}
              />
              {label}
            </label>
          );
        })}
      </fieldset>
      {error && <p className="study-editor-warning">{t(error, error)}</p>}
      {actions}
    </section>
  );
}
