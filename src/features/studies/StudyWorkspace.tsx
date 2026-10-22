import MoveTree from "@/features/notation/MoveTree";
import { downloadLichessStudy, type LichessImportScope } from "./lichess";
import { studyVariationPath } from "./navigation";
import { PositionEditor } from "@/features/board/PositionEditor";
import {
  IconPlayerSkipBack,
  IconChevronLeft,
  IconChevronRight,
  IconPlayerSkipForward,
} from "@tabler/icons-react";
import { usePresentation } from "@/features/board/presentation";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { StudyPlatform } from "./platform";
import { AnalysisPanel } from "@/features/analysis/AnalysisPanel";
import { bestMoveArrow } from "@/features/analysis/bestMoveArrow";
import type { EngineClient, EngineState } from "@/features/analysis/engine";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { parseSquare, parseUci, type NormalMove, type Piece } from "chessops";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import {
  getPositionMaterialError,
  getStudyPositionError,
  isPositionRemoval,
} from "@/utils/positionEditor";
import i18n from "i18next";
import {
  addStudyMove,
  createStudy,
  nextStudyTitle,
  replaceStudyPosition,
  exportStudy,
  importStudies,
  nodeAt,
  positionAt,
  type Study,
  type StudySource,
  type StudySort,
  sortStudies,
  studySourceLabels,
} from "./model";
import StudyBoard from "@/features/board/StudyBoard";
import "./workspace.css";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function translatedError(key: string) {
  return String(i18n.t(key, { lng: "en-US" }));
}
export default function StudyWorkspace({ platform }: { platform: StudyPlatform }) {
  const { repository, labels } = platform;
  const saveStudy = repository.save;
  const deleteStudy = repository.delete;
  const downloadFile = (name: string, contents: string) => {
    void Promise.resolve(platform.exportFile(name, contents)).catch((reason) =>
      setError(errorText(reason)),
    );
  };
  const [studies, setStudies] = useState<Study[]>([]);
  const [sort, setSort] = useState<StudySort>("newest");
  const [activeId, setActiveId] = useState("");
  const [path, setPath] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("Loading studies…");
  const [boardSize, setBoardSize] = useState(
    () => platform.boardSize?.load() ?? (platform.fitBoardToViewport ? undefined : 100),
  );
  useEffect(() => {
    if (boardSize !== undefined) platform.boardSize?.save(boardSize);
  }, [boardSize, platform.boardSize]);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [draft, setDraft] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Piece | "erase" | null>(null);
  const [fenInput, setFenInput] = useState("");
  const [offlineReady, setOfflineReady] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showLichess, setShowLichess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showBestMove, setShowBestMove] = useState(false);
  const [engineState, setEngineState] = useState<EngineState & { fen?: string }>({
    status: "ready",
    lines: [],
  });
  const engineFen = useRef("");
  const publishEngineState = useCallback((state: EngineState) => {
    setEngineState({ ...state, fen: engineFen.current });
  }, []);
  const engine = useRef<EngineClient | null>(null);
  const saveVersion = useRef(0);
  const upload = useRef<HTMLInputElement>(null);
  const study = studies.find((item) => item.id === activeId);
  const studyId = study?.id;
  const node = study ? nodeAt(study, path) : undefined;
  const fen = draft ?? node?.fen ?? INITIAL_FEN;
  const [drawings, setDrawings] = useState<{ fen: string; shapes: DrawShape[] }>({
    fen: "",
    shapes: [],
  });
  const suggestedMove =
    analyzing &&
    showBestMove &&
    draft === null &&
    engineState.fen === fen &&
    engineState.status !== "error"
      ? bestMoveArrow(fen, engineState.lines)
      : undefined;
  const openPresentation = usePresentation(
    {
      fen,
      orientation,
      title: study?.title ?? "Study",
      shapes: drawings.fen === fen ? drawings.shapes : [],
    },
    platform.openPresentation,
  );
  const editorError = draft === null ? null : getStudyPositionError(draft);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = "en";
    let cancelled = false;
    void repository
      .load()
      .then(async (values) => {
        if (!values.length) {
          const first = createStudy();
          await saveStudy(first);
          values = [first];
        }
        if (!cancelled) {
          setStudies(values);
          setActiveId(values[0].id);
          setLoaded(true);
          setSaved(labels.saved);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(errorText(reason));
          setSaved("Storage unavailable");
        }
      });
    return () => {
      cancelled = true;
      document.documentElement.lang = previousLanguage;
    };
  }, [repository, saveStudy, labels.saved]);
  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [platform.createEngine],
  );
  useEffect(() => {
    if (!analyzing || draft !== null || !studyId) {
      engine.current?.stop();
      return;
    }
    try {
      engine.current ??= platform.createEngine(publishEngineState);
      engineFen.current = fen;
      engine.current.analyze(fen);
    } catch (reason) {
      queueMicrotask(() => {
        setError(errorText(reason));
        setAnalyzing(false);
      });
    }
  }, [analyzing, fen, draft, studyId, platform, publishEngineState]);
  useEffect(() => {
    if (!platform.prepareOffline) return;
    let cancelled = false;
    void platform
      .prepareOffline()
      .then(() => {
        if (!cancelled) setOfflineReady(true);
      })
      .catch((reason) => console.warn("Offline cache unavailable", reason));
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const persist = useCallback(
    (updated: Study, previousUpdatedAt: number) => {
      updated = { ...updated, updatedAt: Math.max(updated.updatedAt, previousUpdatedAt + 1) };
      setStudies((values) => values.map((value) => (value.id === updated.id ? updated : value)));
      setSaved("Saving…");
      const version = ++saveVersion.current;
      void saveStudy(updated, previousUpdatedAt)
        .then(() => {
          if (saveVersion.current === version) setSaved(labels.saved);
        })
        .catch((reason) => {
          setSaved("Could not save: export a backup");
          setError(errorText(reason));
        });
    },
    [saveStudy, labels.saved],
  );
  const navigate = (next: number[]) => {
    if (draft === null) setPath(next);
  };
  useEffect(() => {
    if (!loaded || !study || draft !== null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(event.key)
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="spinbutton"]',
        )
      )
        return;
      event.preventDefault();
      setPath((current) => {
        if (event.key === "ArrowLeft") return current.length ? current.slice(0, -1) : current;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          return studyVariationPath(study, current, event.key === "ArrowDown" ? "down" : "up");
        }
        return nodeAt(study, current).children.length ? [...current, 0] : current;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loaded, study, draft]);
  const move = (value: NormalMove) => {
    if (!study || draft !== null) return;
    try {
      const result = addStudyMove(study, path, value);
      persist(result.study, study.updatedAt);
      setPath(result.path);
      setError("");
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const editFen = (next: string) => {
    if (draft === null) return false;
    const key = getPositionMaterialError(next);
    if (key && !isPositionRemoval(draft, next)) {
      setError(translatedError(key));
      return false;
    }
    setDraft(next);
    setFenInput(next);
    setError("");
    return true;
  };
  const finishEditing = () => {
    if (!study || draft === null || editorError) return;
    // Editing creates a new study so existing moves and comments are preserved.
    const next = createStudy(
      nextStudyTitle(studies),
      makeFen(positionAt(createStudy("", draft), []).toSetup()),
    );
    void saveStudy(next)
      .then(() => {
        setStudies((values) => [...values, next]);
        setActiveId(next.id);
        setPath([]);
        setDraft(null);
        setError("");
      })
      .catch((reason) => setError(errorText(reason)));
  };
  const saveEditedStudy = async () => {
    if (!study || draft === null || editorError) return;
    const updated = replaceStudyPosition(study, draft);
    if (
      updated.root.fen !== study.root.fen &&
      study.root.children.length &&
      !(await platform.confirm(
        "Replacing the starting position removes the existing moves and variations. Save this position in the current study?",
      ))
    )
      return;
    try {
      await saveStudy(updated, study.updatedAt);
      setStudies((values) => values.map((value) => (value.id === updated.id ? updated : value)));
      setPath([]);
      setDraft(null);
      setSaved(labels.saved);
      setError("");
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const selectSquare = (key: string) => {
    if (draft === null || !selectedPiece) return;
    const square = parseSquare(key);
    if (square === undefined) return;
    const setup = parseFen(draft).unwrap();
    if (selectedPiece === "erase") setup.board.take(square);
    else setup.board.set(square, selectedPiece);
    editFen(makeFen(setup));
  };
  const importText = async (text: string, source: StudySource) => {
    const imported = importStudies(text, source);
    for (const value of imported) await saveStudy(value);
    setStudies((values) => [...values, ...imported]);
    setActiveId(imported[0].id);
    setPath([]);
    setDraft(null);
    setError("");
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error("The file exceeds 16 MB.");
      await importText(await file.text(), { type: "local_pgn", filename: file.name });
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const newStudy = async () => {
    const next = createStudy(nextStudyTitle(studies));
    try {
      await saveStudy(next);
      setStudies((values) => [...values, next]);
      setActiveId(next.id);
      setPath([]);
      setDraft(null);
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const clearLibrary = async () => {
    if (!repository.reset || resetting) return;
    try {
      if (
        !(await platform.confirm(
          "Delete all studies saved in this browser? This cannot be undone. Export a backup first if you want to keep them. A new blank study will be created.",
        ))
      )
        return;
      setResetting(true);
      const empty = createStudy();
      await repository.reset(empty);
      ++saveVersion.current;
      engine.current?.stop();
      setAnalyzing(false);
      setStudies([empty]);
      setActiveId(empty.id);
      setPath([]);
      setDraft(null);
      setSelectedPiece(null);
      setFenInput("");
      setDrawings({ fen: "", shapes: [] });
      setShowStorage(false);
      setError("");
      setSaved(labels.saved);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setResetting(false);
    }
  };
  const removeStudy = async () => {
    if (!study || !(await platform.confirm(`Delete “${study.title}” ${labels.deleteLocation}?`)))
      return;
    try {
      await deleteStudy(study.id);
      const remaining = studies.filter((value) => value.id !== study.id);
      if (!remaining.length) {
        const next = createStudy();
        await saveStudy(next);
        remaining.push(next);
      }
      setStudies(remaining);
      setActiveId(remaining[0].id);
      setPath([]);
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const pvSan = (moves: string[]) => {
    if (!study || draft !== null) return "";
    try {
      const pos = positionAt(study, path);
      return moves
        .slice(0, 12)
        .map((uci) => {
          const m = parseUci(uci);
          if (!m || !pos.isLegal(m)) throw new Error();
          const san = makeSan(pos, m);
          pos.play(m);
          return san;
        })
        .join(" ");
    } catch {
      return "";
    }
  };

  return (
    <div
      className="study-workspace-root web-app"
      inert={resetting || undefined}
      aria-busy={resetting}
    >
      <link rel="stylesheet" href={`${import.meta.env.BASE_URL}pieces/cburnett.css`} />
      <header className="web-header">
        <div className="web-brand">
          <strong>schaak</strong> ·{" "}
          <a
            href="https://github.com/palozano/schaak"
            target="_blank"
            rel="noopener noreferrer"
          >
            code
          </a>
          {platform.engineCredit && (
            <>
              {" · powered by "}
              <a href={platform.engineCredit.url} target="_blank" rel="noopener noreferrer">
                {platform.engineCredit.label}
              </a>
            </>
          )}
        </div>
        <nav>
          <div className="web-storage-control">
            <button
              aria-label={labels.save}
              aria-expanded={showStorage}
              aria-controls="web-storage-details"
              disabled={!study || draft !== null}
              title={saved}
              onClick={() => {
                setShowStorage((value) => !value);
                if (!study) return;
                void (async () => {
                  try {
                    await saveStudy(study, study.updatedAt);
                    const granted = await platform.requestPersistence();
                    setSaved(granted ? "Saved with persistent storage" : labels.saved);
                  } catch (reason) {
                    setError(errorText(reason));
                  }
                })();
              }}
            >
              {labels.save}
              <span className="web-sr-only" role="status">
                {saved}
              </span>
            </button>
            {showStorage && (
              <div id="web-storage-details" className="web-storage-details">
                <p>{saved}</p>
                {offlineReady && <p>Ready for offline use</p>}
                <p>{labels.storageHelp}</p>
              </div>
            )}
          </div>
          <button
            disabled={!studies.length || draft !== null}
            onClick={() => downloadFile("my-studies.pgn", studies.map(exportStudy).join("\n\n"))}
          >
            Backup all my studies
          </button>
          {repository.reset && (
            <button
              className="web-delete-all"
              disabled={!loaded || !studies.length || draft !== null || downloading || resetting}
              onClick={() => void clearLibrary()}
            >
              Delete all studies
            </button>
          )}
        </nav>
      </header>
      {error && (
        <div className="web-error" role="alert">
          {error}
          <button aria-label="Dismiss notification" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {!loaded ? (
        <main className="web-loading">
          <p>{saved}</p>
          {error && <button onClick={() => location.reload()}>Retry</button>}
        </main>
      ) : (
        study &&
        node && (
          <main className="web-workspace">
            <aside className="web-library">
              <h2>My studies</h2>
              <p className="web-muted">{labels.privacy}</p>
              <div className="web-study-actions">
                <button disabled={!loaded || draft !== null} onClick={() => void newStudy()}>
                  New study
                </button>
                <button
                  disabled={!loaded || draft !== null}
                  onClick={() => upload.current?.click()}
                >
                  Upload PGN
                </button>
                <button
                  disabled={!loaded || draft !== null || downloading}
                  aria-expanded={showLichess}
                  aria-controls="lichess-import-form"
                  onClick={() => {
                    setShowLichess((value) => !value);
                    setShowDownload(false);
                  }}
                >
                  Import Lichess
                </button>
                {showLichess && draft === null && (
                  <form
                    id="lichess-import-form"
                    aria-label="Import Lichess study"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void (async () => {
                        setDownloading(true);
                        setError("");
                        try {
                          const text = await downloadLichessStudy(
                            String(form.get("url")),
                            form.get("scope") as LichessImportScope,
                            platform.downloadPgn,
                          );
                          await importText(text, {
                            type: "lichess",
                            url: new URL(
                              String(form.get("url"))
                                .trim()
                                .replace(/^(www\.)?lichess\.org\//i, "https://lichess.org/"),
                            ).href,
                          });
                          setShowLichess(false);
                        } catch (reason) {
                          setError(errorText(reason));
                        } finally {
                          setDownloading(false);
                        }
                      })();
                    }}
                  >
                    <label>
                      Lichess study link
                      <input
                        name="url"
                        type="text"
                        inputMode="url"
                        placeholder="https://lichess.org/study/…"
                        required
                        disabled={downloading}
                      />
                    </label>
                    <label>
                      Import
                      <select
                        name="scope"
                        aria-label="Lichess import scope"
                        defaultValue="all"
                        disabled={downloading}
                      >
                        <option value="all">All chapters</option>
                        <option value="chapter">Linked chapter only</option>
                      </select>
                    </label>
                    <p className="web-muted">
                      Public studies with downloads enabled. Each chapter becomes a separate local
                      study. Comments and variations are preserved.
                    </p>
                    <button type="submit" disabled={downloading}>
                      {downloading ? "Importing…" : "Import study"}
                    </button>
                  </form>
                )}
                <button
                  disabled={!loaded || draft !== null || downloading}
                  aria-expanded={showDownload}
                  aria-controls="web-download-form"
                  onClick={() => {
                    setShowDownload((value) => !value);
                    setShowLichess(false);
                  }}
                >
                  Load PGN
                </button>
                {showDownload && draft === null && (
                  <div id="web-download-form">
                    {" "}
                    <form
                      aria-label="Download PGN"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const url = new FormData(event.currentTarget).get("url");
                        void (async () => {
                          try {
                            setDownloading(true);
                            const text = await platform.downloadPgn(String(url));
                            await importText(text, {
                              type: "remote_pgn",
                              url: new URL(String(url)).href,
                            });
                            setShowDownload(false);
                          } catch (reason) {
                            setError(
                              `Could not import the download. The server must allow access from other websites. ${errorText(reason)}`,
                            );
                          } finally {
                            setDownloading(false);
                          }
                        })();
                      }}
                    >
                      <input
                        name="url"
                        type="url"
                        aria-label="PGN URL"
                        placeholder="https://…/game.pgn"
                        required
                      />
                      <button type="submit" disabled={downloading}>
                        {downloading ? "Downloading…" : "Download and import"}
                      </button>
                    </form>
                  </div>
                )}
                <button
                  disabled={!study || draft !== null}
                  onClick={() => study && downloadFile(`${study.title}.pgn`, exportStudy(study))}
                >
                  Export PGN
                </button>
                <input
                  ref={upload}
                  type="file"
                  accept=".pgn,text/plain,application/x-chess-pgn"
                  hidden
                  onChange={(event) => void importFile(event)}
                />
              </div>
              <label className="web-study-sort">
                Sort studies
                <select
                  aria-label="Sort studies"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as StudySort)}
                >
                  <option value="newest">Date: newest first</option>
                  <option value="oldest">Date: oldest first</option>
                  <option value="source">Import type</option>
                  <option value="title">Name: A–Z</option>
                </select>
              </label>
              <div className="web-study-list">
                {sortStudies(studies, sort).map((value) => (
                  <button
                    key={value.id}
                    disabled={draft !== null}
                    className={value.id === activeId ? "selected" : ""}
                    onClick={() => {
                      setActiveId(value.id);
                      setPath([]);
                    }}
                  >
                    <span>{value.title}</span>
                    <small className="web-study-summary">
                      {value.metadata
                        ? studySourceLabels[value.metadata.source.type]
                        : "Unknown origin"}
                      {" · "}
                      {value.metadata
                        ? new Date(value.metadata.createdAt).toLocaleDateString()
                        : "Unknown date"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="web-study-metadata" aria-label="Study metadata">
                <p>
                  Created / imported:{" "}
                  {study.metadata ? (
                    <time dateTime={new Date(study.metadata.createdAt).toISOString()}>
                      {new Date(study.metadata.createdAt).toLocaleString()}
                    </time>
                  ) : (
                    "Unknown date"
                  )}
                </p>
                <p>
                  Origin:{" "}
                  {study.metadata
                    ? studySourceLabels[study.metadata.source.type]
                    : "Unknown origin"}
                </p>
                {study.metadata?.source.type === "local_pgn" && (
                  <p>{study.metadata.source.filename}</p>
                )}
                {study.metadata && "url" in study.metadata.source && (
                  <a href={study.metadata.source.url} target="_blank" rel="noopener noreferrer">
                    {study.metadata.source.url}
                  </a>
                )}
              </div>
              <button
                className="web-danger"
                disabled={draft !== null}
                onClick={() => void removeStudy()}
              >
                Delete study
              </button>
            </aside>
            <section className="web-board-column">
              <StudyBoard
                suggestedMove={suggestedMove}
                fitViewport={platform.fitBoardToViewport}
                size={boardSize}
                onSizeChange={setBoardSize}
                fen={fen}
                editing={draft !== null}
                orientation={orientation}
                onMove={move}
                onShapes={(shapes) => setDrawings({ fen, shapes })}
                onSquare={selectSquare}
                onFen={(boardFen) => editFen(`${boardFen} ${fen.split(" ").slice(1).join(" ")}`)}
              />
            </section>
            <section className="web-panels">
              <div className="web-board-toolbar">
                <div className="web-board-actions">
                  <button
                    onClick={async () => {
                      try {
                        if (!(await openPresentation()))
                          setError(
                            "Could not open the presentation window. Allow pop-ups and try again.",
                          );
                      } catch (reason) {
                        setError(errorText(reason));
                      }
                    }}
                  >
                    Present
                  </button>
                  <button
                    onClick={() =>
                      setOrientation((value) => (value === "white" ? "black" : "white"))
                    }
                  >
                    Flip
                  </button>
                  <button
                    disabled={draft !== null}
                    onClick={() => {
                      setDraft(fen);
                      setFenInput(fen);
                      setSelectedPiece(null);
                      setError("");
                    }}
                  >
                    Edit
                  </button>
                </div>
                <div className="web-move-controls">
                  <button
                    aria-label="Start"
                    title="Start"
                    disabled={draft !== null || !path.length}
                    onClick={() => navigate([])}
                  >
                    <IconPlayerSkipBack size={18} aria-hidden="true" />
                  </button>
                  <button
                    aria-label="Previous"
                    aria-keyshortcuts="ArrowLeft"
                    title="Previous (←)"
                    disabled={draft !== null || !path.length}
                    onClick={() => navigate(path.slice(0, -1))}
                  >
                    <IconChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    aria-label="Next"
                    aria-keyshortcuts="ArrowRight"
                    title="Next (→)"
                    disabled={draft !== null || !node.children.length}
                    onClick={() => navigate([...path, 0])}
                  >
                    <IconChevronRight size={18} aria-hidden="true" />
                  </button>
                  <button
                    aria-label="End"
                    title="End"
                    disabled={draft !== null || !node.children.length}
                    onClick={() => {
                      const lastPath = [...path];
                      let lastNode = node;
                      while (lastNode.children.length) {
                        lastPath.push(0);
                        lastNode = lastNode.children[0];
                      }
                      navigate(lastPath);
                    }}
                  >
                    <IconPlayerSkipForward size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="web-panel">
                <label className="web-fen">
                  FEN
                  <input
                    readOnly={draft === null}
                    value={draft === null ? fen : fenInput}
                    onChange={(event) => setFenInput(event.target.value)}
                    onFocus={(event) => event.target.select()}
                  />
                </label>
                {draft !== null && (
                  <button
                    onClick={() => {
                      const parsed = parseFen(fenInput);
                      if (parsed.isErr) setError("Invalid FEN.");
                      else editFen(makeFen(parsed.value));
                    }}
                  >
                    Apply FEN
                  </button>
                )}
              </div>
              {draft !== null ? (
                <div className="web-panel">
                  <PositionEditor
                    fen={draft}
                    selection={selectedPiece}
                    onSelect={setSelectedPiece}
                    onChange={(next) => {
                      setDraft(next);
                      setFenInput(next);
                      setError("");
                    }}
                    onError={setError}
                    translate={(key, fallback) =>
                      key.startsWith("Errors.") || key.startsWith("Board.Editor.TooMany")
                        ? String(i18n.t(key, { lng: "en-US", defaultValue: fallback }))
                        : fallback
                    }
                  />
                  <p className="web-muted">
                    Saving in the current study replaces its starting position. Existing moves and
                    variations are removed if the position changes. Create a new study to keep the
                    original.
                  </p>
                  <div className="web-actions">
                    <button
                      className="primary"
                      disabled={!!editorError}
                      onClick={() => void saveEditedStudy()}
                    >
                      Save current study
                    </button>
                    <button disabled={!!editorError} onClick={finishEditing}>
                      Create study from this position
                    </button>
                    <button
                      onClick={() => {
                        setDraft(null);
                        setError("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="web-panel">
                    <label>
                      Study title
                      <input
                        aria-label="Study title"
                        maxLength={300}
                        value={study.title}
                        onChange={(event) =>
                          persist(
                            { ...study, title: event.target.value, updatedAt: Date.now() },
                            study.updatedAt,
                          )
                        }
                      />
                    </label>
                    <div className="web-notation-scroll">
                      <MoveTree
                        key={study.id}
                        root={study.root}
                        path={path}
                        onSelect={navigate}
                        comments={(value) => value.comments}
                        disabled={draft !== null}
                        className="web-notation"
                      />
                    </div>
                    <label>
                      Comments
                      <textarea
                        aria-label="Comments"
                        rows={3}
                        value={node.comments.join("\n")}
                        onChange={(event) => {
                          const next = structuredClone(study);
                          nodeAt(next, path).comments = event.target.value
                            ? event.target.value.split("\n")
                            : [];
                          next.updatedAt = Date.now();
                          persist(next, study.updatedAt);
                        }}
                      />
                    </label>
                  </div>
                  <AnalysisPanel
                    name={platform.engineName}
                    state={engineState}
                    enabled={analyzing}
                    formatPv={pvSan}
                    showBestMove={showBestMove}
                    onShowBestMoveChange={setShowBestMove}
                    onToggle={() => {
                      if (engineState.status === "error") {
                        engine.current?.dispose();
                        engine.current = null;
                      }
                      setAnalyzing((value) => (engineState.status === "error" ? true : !value));
                      if (engineState.status === "error" && analyzing) {
                        try {
                          engine.current = platform.createEngine(publishEngineState);
                          engineFen.current = fen;
                          engine.current.analyze(fen);
                        } catch (reason) {
                          setError(errorText(reason));
                        }
                      }
                    }}
                  />
                </>
              )}
            </section>
          </main>
        )
      )}
    </div>
  );
}
