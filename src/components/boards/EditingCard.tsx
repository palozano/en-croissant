import { Button, Card, CloseButton, Divider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Piece } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { PositionEditor } from "@/features/board/PositionEditor";
import { getPositionMaterialError, getStudyPositionError } from "@/utils/positionEditor";
import DragPiece from "../common/Piece";
import { TreeStateContext } from "../common/TreeStateContext";
import FenInput from "../panels/info/FenInput";
import classes from "./EditingCard.module.css";

function EditingCard({
  boardRef,
  setEditingMode,
  selectedPiece,
  setSelectedPiece,
  eraseMode,
  setEraseMode,
}: {
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  setEditingMode: (editing: boolean) => void;
  eraseMode: boolean;
  setEraseMode: (erase: boolean) => void;
  selectedPiece: Piece | null;
  setSelectedPiece: (piece: Piece | null) => void;
}) {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const fen = useStore(store, (s) => s.currentNode().fen);
  const headers = useStore(store, (s) => s.headers);
  const setFen = useStore(store, (s) => s.setFen);

  const error = getStudyPositionError(fen);

  return (
    <Card
      shadow="md"
      style={{ position: "relative", overflow: "visible" }}
      className={classes.card}
      withBorder
    >
      <CloseButton
        style={{ position: "absolute", top: 10, right: 15 }}
        disabled={!!error}
        aria-label={t("Board.Editor.Done")}
        onClick={() => setEditingMode(false)}
      />
      <FenInput currentFen={fen} />
      <Divider my="md" />
      <PositionEditor
        fen={fen}
        selection={eraseMode ? "erase" : selectedPiece}
        onSelect={(piece) => {
          setEraseMode(piece === "erase");
          setSelectedPiece(piece === "erase" ? null : piece);
        }}
        onChange={setFen}
        onError={(message) => notifications.show({ color: "red", message })}
        translate={(key, fallback) => String(t(key, { defaultValue: fallback }))}
        renderPiece={(piece, selected, select) => (
          <DragPiece
            piece={piece}
            selected={selected}
            size={50}
            boardRef={boardRef}
            orientation={headers.orientation}
            onClick={select}
            putPiece={(square, value) => {
              const setup = parseFen(fen).unwrap();
              setup.board.set(square, value);
              const next = makeFen(setup);
              const invalid = getPositionMaterialError(next);
              if (invalid) notifications.show({ color: "red", message: t(invalid) });
              else setFen(next);
            }}
          />
        )}
        actions={
          <Button disabled={!!error} onClick={() => setEditingMode(false)}>
            {t("Board.Editor.Done")}
          </Button>
        }
      />
    </Card>
  );
}

export default EditingCard;
