import MoveTree from "@/features/notation/MoveTree";
import {
  ActionIcon,
  Box,
  Divider,
  Group,
  Overlay,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useColorScheme } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconArticle,
  IconArticleOff,
  IconEye,
  IconEyeOff,
  IconLayoutList,
  IconList,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { INITIAL_FEN } from "chessops/fen";
import equal from "fast-deep-equal";
import { useAtom, useAtomValue } from "jotai";
import React, { memo, useContext, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import Comment from "@/components/common/Comment";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  currentInvisibleAtom,
  currentShowCommentsAtom,
  currentShowVariationsAtom,
  tableViewAtom,
} from "@/state/atoms";
import { keyMapAtom } from "@/state/keybinds";
import { gameResultPresentation } from "@/utils/gameResult";
import { formatScore } from "@/utils/score";
import { getNodeAtPath, type TreeNode } from "@/utils/treeReducer";
import CompleteMoveCell from "./CompleteMoveCell";
import styles from "./GameNotation.module.css";
import OpeningName from "./OpeningName";

function GameNotation({
  topBar,
  controls,
  humanColor,
}: {
  topBar?: boolean;
  controls?: React.ReactNode;
  humanColor?: "white" | "black" | null;
}) {
  const store = useContext(TreeStateContext)!;
  const currentFen = useStore(store, (s) => s.currentNode().fen);
  const copyPgn = useStore(store, (s) => s.copyPgn);
  const headers = useStore(store, (s) => s.headers);
  const result = gameResultPresentation(headers.result, humanColor);
  const rootComment = useStore(store, (s) => s.root.comment);

  const viewport = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (viewport.current) {
      if (currentFen === INITIAL_FEN) {
        viewport.current.scrollTo({ top: 0, behavior: "auto" });
      } else if (targetRef.current) {
        const viewportEl = viewport.current;
        const targetEl = targetRef.current;
        const viewportRect = viewportEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const offsetInViewport = targetRect.top - viewportRect.top + viewportEl.scrollTop;
        viewportEl.scrollTo({
          top: offsetInViewport - 65,
          behavior: "auto",
        });
      }
    }
  }, [currentFen]);

  const [invisibleValue, setInvisible] = useAtom(currentInvisibleAtom);
  const invisible = topBar && invisibleValue;
  const showComments = useAtomValue(currentShowCommentsAtom);
  const tableView = useAtomValue(tableViewAtom);
  const colorScheme = useColorScheme();

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.TOGGLE_BLUR.keys, () => setInvisible((v) => !v));
  useHotkeys(keyMap.COPY_PGN.keys, () => copyPgn());

  return (
    <Paper
      className={styles.notation}
      withBorder
      flex={1}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Group h="100%" wrap="nowrap" align="stretch" gap={0}>
        {controls && (
          <>
            <ScrollArea type="never" py="md" mx="xs" style={{ flexShrink: 0 }}>
              {controls}
            </ScrollArea>
            <Divider orientation="vertical" />
          </>
        )}
        <Stack h="100%" gap={0} style={{ flex: 1, minWidth: 0 }}>
          {topBar && <NotationHeader />}
          <ScrollArea flex={1} offsetScrollbars scrollbars="y" viewportRef={viewport}>
            <Stack gap="xs">
              <Box>
                {invisible && (
                  <Overlay
                    backgroundOpacity={0.6}
                    color={colorScheme === "dark" ? "#1a1b1e" : undefined}
                    blur={8}
                    zIndex={2}
                  />
                )}
                {!tableView && showComments && rootComment && (
                  <Box p="sm" fz="sm">
                    <Comment comment={rootComment} />
                  </Box>
                )}
                {tableView ? (
                  <TableNotation targetRef={targetRef} />
                ) : (
                  <Box pt="md" px="sm">
                    <RenderVariationTree targetRef={targetRef} nodePath={[]} depth={0} first />
                  </Box>
                )}
              </Box>
              <Box pb="md">
                {headers.result !== "*" && (
                  <Text ta="center" c={result.color}>
                    {result.text}
                    <br />
                    <Text span fs="italic">
                      {headers.result === "1/2-1/2"
                        ? "Draw"
                        : headers.result === "1-0"
                          ? "White wins"
                          : "Black wins"}
                    </Text>
                  </Text>
                )}
              </Box>
            </Stack>
          </ScrollArea>
        </Stack>
      </Group>
    </Paper>
  );
}

function NotationHeader() {
  const { t } = useTranslation();
  const [invisible, setInvisible] = useAtom(currentInvisibleAtom);
  const [showComments, setShowComments] = useAtom(currentShowCommentsAtom);
  const [showVariations, setShowVariations] = useAtom(currentShowVariationsAtom);
  const [tableView, setTableView] = useAtom(tableViewAtom);
  return (
    <Stack gap="xs" pt="xs">
      <Group justify="space-between" px="sm">
        <OpeningName />
        <Group gap="sm">
          <Tooltip label={invisible ? t("Notation.ShowMoves") : t("Notation.HideMoves")}>
            <ActionIcon onClick={() => setInvisible((v) => !v)}>
              {invisible ? <IconEyeOff size="1rem" /> : <IconEye size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tableView ? t("Notation.NormalView") : t("Notation.TableView")}>
            <ActionIcon onClick={() => setTableView((v) => !v)}>
              {tableView ? <IconList size="1rem" /> : <IconLayoutList size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={showComments ? t("Notation.HideComments") : t("Notation.ShowComments")}>
            <ActionIcon onClick={() => setShowComments((v) => !v)}>
              {showComments ? <IconArticle size="1rem" /> : <IconArticleOff size="1rem" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={showVariations ? t("Notation.HideVariations") : t("Notation.ShowVariations")}
          >
            <ActionIcon onClick={() => setShowVariations((v) => !v)}>
              {showVariations ? <IconArrowsSplit size="1rem" /> : <IconArrowRight size="1rem" />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Divider />
    </Stack>
  );
}

const RenderVariationTree = memo(
  function RenderVariationTree({
    nodePath,
    depth,
    first,
    targetRef,
  }: {
    nodePath: number[];
    depth: number;
    first?: boolean;
    targetRef: React.RefObject<HTMLSpanElement | null>;
  }) {
    const store = useContext(TreeStateContext)!;
    const showVariations = useAtomValue(currentShowVariationsAtom);
    const showComments = useAtomValue(currentShowCommentsAtom);
    const node = useStore(store, (s) => getNodeAtPath(s.root, nodePath));
    const variations = node.children;

    const variationNodes = showVariations
      ? variations.slice(1).map((variation, idx) => {
          const variationIndex = idx + 1;
          const newPath = [...nodePath, variationIndex];
          return (
            <React.Fragment key={variation.fen}>
              <CompleteMoveCell
                targetRef={targetRef}
                annotations={variation.annotations}
                comment={variation.comment}
                halfMoves={variation.halfMoves}
                move={variation.san}
                fen={variation.fen}
                movePath={newPath}
                showComments={showComments}
                first
              />
              <RenderVariationTree targetRef={targetRef} nodePath={newPath} depth={depth + 2} />
            </React.Fragment>
          );
        })
      : [];

    const mainLinePath = [...nodePath, 0];
    return (
      <>
        {variations.length > 0 && (
          <CompleteMoveCell
            targetRef={targetRef}
            annotations={variations[0].annotations}
            comment={variations[0].comment}
            halfMoves={variations[0].halfMoves}
            move={variations[0].san}
            fen={variations[0].fen}
            movePath={mainLinePath}
            showComments={showComments}
            first={first}
          />
        )}

        <VariationCell moveNodes={variationNodes} />

        {node.children.length > 0 && (
          <RenderVariationTree targetRef={targetRef} nodePath={mainLinePath} depth={depth + 1} />
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      equal(prev.nodePath, next.nodePath) && prev.depth === next.depth && prev.first === next.first
    );
  },
);

function TableNotation({ targetRef }: { targetRef: React.RefObject<HTMLSpanElement | null> }) {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (state) => state.root);
  const path = useStore(store, (state) => state.position);
  const goToMove = useStore(store, (state) => state.goToMove);
  const showComments = useAtomValue(currentShowCommentsAtom);
  const showVariations = useAtomValue(currentShowVariationsAtom);
  return (
    <MoveTree<TreeNode>
      root={root}
      path={path}
      onSelect={goToMove}
      comments={(node) => (node.comment ? [node.comment] : [])}
      showComments={showComments}
      showVariations={showVariations}
      renderComment={(text) => <Comment comment={text} />}
      renderMove={(node, movePath) => (
        <CompleteMoveCell
          targetRef={targetRef}
          annotations={node.annotations}
          comment={node.comment}
          halfMoves={node.halfMoves}
          move={node.san}
          fen={node.fen}
          movePath={movePath}
          showComments={showComments}
          tableLayout
          scoreText={showComments && node.score ? formatScore(node.score.value, 1) : undefined}
        />
      )}
    />
  );
}

function VariationCell({ moveNodes }: { moveNodes: React.ReactNode[] }) {
  const [expanded, setExpanded] = useState(true);
  if (moveNodes.length === 0) return null;
  return (
    <Box className={styles.variationBorder}>
      <ActionIcon size="xs" onClick={() => setExpanded((v) => !v)}>
        {expanded ? <IconMinus size="0.5rem" /> : <IconPlus size="0.5rem" />}
      </ActionIcon>
      {expanded &&
        moveNodes.map((node, i) => (
          <Box key={i} className={styles.lineBeforeVariation}>
            {node}
          </Box>
        ))}
    </Box>
  );
}

export default memo(GameNotation);
