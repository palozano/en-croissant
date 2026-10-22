import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import "./moveTree.css";

interface NodeLike<T> {
  fen: string;
  san: string | null;
  children: T[];
}
interface Props<T extends NodeLike<T>> {
  root: T;
  path: number[];
  onSelect(path: number[]): void;
  comments(node: T): string[];
  renderMove?(node: T, path: number[]): ReactNode;
  renderComment?(text: string): ReactNode;
  showComments?: boolean;
  showVariations?: boolean;
  disabled?: boolean;
  className?: string;
}
function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
function containsPath(parent: number[], child: number[]) {
  return parent.length <= child.length && parent.every((n, i) => n === child[i]);
}
function moveLabel(node: { fen: string; san: string | null }, parentFen: string) {
  const parts = parentFen.split(" ");
  return `${parts[5] || "1"}${parts[1] === "b" ? "..." : "."}${node.san ?? ""}`;
}

export default function MoveTree<T extends NodeLike<T>>(props: Props<T>) {
  const host = useRef<HTMLDivElement>(null);
  const selectedKey = props.path.join(".");
  useEffect(() => {
    const selected = host.current?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!selected) return;
    for (let parent = host.current?.parentElement; parent; parent = parent.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue;
      const bounds = parent.getBoundingClientRect();
      const target = selected.getBoundingClientRect();
      const headingHeight =
        host.current?.querySelector(".move-tree-location")?.getBoundingClientRect().height ?? 0;
      const visibleTop = bounds.top + headingHeight;
      if (target.top < visibleTop) parent.scrollTop += target.top - visibleTop - 8;
      else if (target.bottom > bounds.bottom) parent.scrollTop += target.bottom - bounds.bottom + 8;
      break;
    }
  }, [selectedKey, props.root, props.showVariations]);
  let current = props.root;
  const crumbs = ["Principal"];
  for (const index of props.path) {
    const child = current.children[index];
    if (!child) break;
    if (index > 0) crumbs.push(moveLabel(child, current.fen));
    current = child;
  }
  return (
    <div ref={host} className={`move-tree ${props.className ?? ""}`}>
      <nav className="move-tree-location" aria-label="Current variation">
        {crumbs.join(" › ")}
      </nav>
      <button
        className={`move-tree-start ${!props.path.length ? "selected" : ""}`}
        data-selected={!props.path.length || undefined}
        disabled={props.disabled}
        onClick={() => props.onSelect([])}
      >
        Starting position
      </button>
      {props.showComments !== false && <Comments {...props} node={props.root} />}
      <div className="move-tree-heading" aria-hidden="true">
        <span>#</span>
        <span>White</span>
        <span>Black</span>
      </div>
      {props.root.children[0] && (
        <Line
          {...props}
          first={props.root.children[0]}
          firstPath={[0]}
          parentFen={props.root.fen}
          alternatives={props.root.children.slice(1)}
          depth={0}
        />
      )}
    </div>
  );
}
function Comments<T extends NodeLike<T>>(props: Props<T> & { node: T }) {
  const text = props.comments(props.node).join("\n");
  if (!text.trim()) return null;
  const content = props.renderComment ? props.renderComment(text) : text;
  return text.length > 180 || text.split("\n").length > 3 ? (
    <details className="move-tree-comment">
      <summary>{text.slice(0, 100)}…</summary>
      <div>{content}</div>
    </details>
  ) : (
    <div className="move-tree-comment">{content}</div>
  );
}
function Branch<T extends NodeLike<T>>(
  props: Props<T> & { first: T; firstPath: number[]; parentFen: string; main: T; depth: number },
) {
  const active = containsPath(props.firstPath, props.path);
  const [expanded, setExpanded] = useState(props.depth <= 1);
  // An explicit collapse lasts until navigation enters this branch again.
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const selectedKey = props.path.join(".");
  const open = expanded || (active && closedAt !== selectedKey);
  const label = `Alternative to ${moveLabel(props.main, props.parentFen)}: ${moveLabel(props.first, props.parentFen)}`;
  return (
    <section className="move-tree-branch" data-active-branch={active || undefined}>
      <button
        className="move-tree-branch-toggle"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setExpanded(!open);
          setClosedAt(open ? selectedKey : null);
        }}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span> {label}
      </button>
      {open && <Line {...props} alternatives={[]} />}
    </section>
  );
}
function Line<T extends NodeLike<T>>(
  props: Props<T> & {
    first: T;
    firstPath: number[];
    parentFen: string;
    alternatives: T[];
    depth: number;
  },
) {
  const rows: ReactNode[] = [];
  let node: T | undefined = props.first;
  let path = props.firstPath;
  let parentFen = props.parentFen;
  let alternatives = props.alternatives;
  while (node) {
    const current: T = node;
    const currentPath = path;
    const fields = parentFen.split(" ");
    const white = fields[1] !== "b";
    const number = fields[5] || "1";
    const extras: boolean =
      (props.showComments !== false && props.comments(current).some(Boolean)) ||
      (props.showVariations !== false && alternatives.length > 0);
    const black: T | undefined = white && !extras ? current.children[0] : undefined;
    const blackPath = [...currentPath, 0];
    const cell = (value: T | undefined, movePath: number[]) =>
      value ? (
        <div className="move-tree-cell" data-selected={samePath(movePath, props.path) || undefined}>
          {props.renderMove ? (
            props.renderMove(value, movePath)
          ) : (
            <button
              disabled={props.disabled}
              aria-current={samePath(movePath, props.path) ? "step" : undefined}
              className={samePath(movePath, props.path) ? "selected" : ""}
              onClick={() => props.onSelect(movePath)}
            >
              {value.san}
            </button>
          )}
        </div>
      ) : (
        <div className="move-tree-cell move-tree-empty">{white ? "" : "…"}</div>
      );
    rows.push(
      <div
        className="move-tree-row"
        role="group"
        aria-label={`Move ${number}`}
        key={`row-${path.join(".")}`}
      >
        <span className="move-tree-number">
          {number}
          {white ? "." : "..."}
        </span>
        {cell(white ? current : undefined, currentPath)}
        {cell(white ? black : current, white ? blackPath : currentPath)}
      </div>,
    );
    const appendExtras = (value: T, valuePath: number[], previousFen: string, branches: T[]) => {
      rows.push(
        <Fragment key={`extras-${valuePath.join(".")}`}>
          {props.showComments !== false && <Comments {...props} node={value} />}
          {props.showVariations !== false &&
            branches.map((branch, index) => (
              <Branch
                {...props}
                key={[...valuePath.slice(0, -1), index + 1].join(".")}
                first={branch}
                firstPath={[...valuePath.slice(0, -1), index + 1]}
                parentFen={previousFen}
                main={value}
                depth={props.depth + 1}
              />
            ))}
        </Fragment>,
      );
    };
    appendExtras(current, currentPath, parentFen, alternatives);
    if (black) appendExtras(black, blackPath, current.fen, current.children.slice(1));
    const last: T = black ?? current;
    parentFen = last.fen;
    path = [...(black ? blackPath : currentPath), 0];
    alternatives = last.children.slice(1);
    node = last.children[0];
  }
  return <div className="move-tree-line">{rows}</div>;
}
