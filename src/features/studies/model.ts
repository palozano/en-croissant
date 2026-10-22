import { readPgn, writePgn } from "./pgn";
import { getStudyPositionError } from "@/utils/positionEditor";
import { Chess, type Move } from "chessops";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { ChildNode, Node, startingPosition, type PgnNodeData } from "chessops/pgn";
import { makeSan, parseSan } from "chessops/san";
import { z } from "zod";

export interface StudyNode {
    fen: string;
    san: string;
    comments: string[];
    startingComments?: string[];
    nags?: number[];
    children: StudyNode[];
}
const studySourceSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("manual") }),
    z.object({ type: z.literal("lichess"), url: z.string().url() }),
    z.object({ type: z.literal("local_pgn"), filename: z.string() }),
    z.object({ type: z.literal("remote_pgn"), url: z.string().url() }),
]);
export type StudySource = z.infer<typeof studySourceSchema>;
export interface StudyMetadata {
    createdAt: number;
    source: StudySource;
}
export const studySourceLabels: Record<StudySource["type"], string> = {
    manual: "Manual",
    lichess: "Lichess",
    local_pgn: "Local PGN",
    remote_pgn: "Remote PGN",
};
export type StudySort = "newest" | "oldest" | "source" | "title";
export function sortStudies(studies: Study[], sort: StudySort): Study[] {
    return [...studies].sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "source") {
            const aType = a.metadata ? studySourceLabels[a.metadata.source.type] : "Unknown";
            const bType = b.metadata ? studySourceLabels[b.metadata.source.type] : "Unknown";
            const byType = aType.localeCompare(bType);
            if (byType) return byType;
        }
        const aDate = a.metadata?.createdAt;
        const bDate = b.metadata?.createdAt;
        if (aDate === undefined && bDate !== undefined) return 1;
        if (bDate === undefined && aDate !== undefined) return -1;
        return (
            (aDate !== undefined && bDate !== undefined
                ? sort === "oldest"
                    ? aDate - bDate
                    : bDate - aDate
                : 0) ||
            a.title.localeCompare(b.title) ||
            a.id.localeCompare(b.id)
        );
    });
}
export interface Study {
    id: string;
    title: string;
    updatedAt: number;
    metadata?: StudyMetadata;
    headers: [string, string][];
    root: StudyNode;
}
const nodeSchema: z.ZodType<StudyNode> = z.lazy(() =>
    z.object({
        fen: z.string().max(200),
        san: z.string().max(30),
        comments: z.array(z.string()),
        startingComments: z.array(z.string()).optional(),
        nags: z.array(z.number()).optional(),
        children: z.array(nodeSchema),
    }),
);
export const studySchema: z.ZodType<Study> = z.object({
    id: z.string().min(1),
    title: z.string().max(300),
    updatedAt: z.number(),
    metadata: z
        .object({
            createdAt: z.number().int().nonnegative().max(8640000000000000),
            source: studySourceSchema,
        })
        .optional(),
    headers: z.array(z.tuple([z.string(), z.string()])),
    root: nodeSchema,
});
export function nextStudyTitle(studies: Pick<Study, "title">[]): string {
    let maximum = 0;
    for (const { title } of studies) {
        const match = /^Study (\d+)$/.exec(title);
        if (match && Number.isSafeInteger(Number(match[1])))
            maximum = Math.max(maximum, Number(match[1]));
    }
    return `Study ${maximum + 1}`;
}

export function createStudy(title = "Study 1", fen = INITIAL_FEN): Study {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        title,
        updatedAt: now,
        metadata: { createdAt: now, source: { type: "manual" } },
        headers: [
            ["Event", title],
            ["Result", "*"],
        ],
        root: { fen, san: "", comments: [], children: [] },
    };
}
export function replaceStudyPosition(study: Study, fen: string): Study {
    const error = getStudyPositionError(fen);
    if (error) throw new Error(`Invalid study position: ${error}`);
    const normalized = makeFen(Chess.fromSetup(parseFen(fen).unwrap()).unwrap().toSetup());
    const updated = structuredClone(study);
    if (normalized !== study.root.fen) {
        updated.root = { ...createStudy("", normalized).root, comments: [...study.root.comments] };
        updated.headers = updated.headers.filter(
            ([key]) => !["FEN", "SetUp", "PlyCount", "Result"].includes(key),
        );
        updated.headers.push(["Result", "*"]);
    }
    updated.updatedAt = Math.max(Date.now(), study.updatedAt + 1);
    return updated;
}

export function nodeAt(study: Study, path: number[]): StudyNode {
    let node = study.root;
    for (const index of path) {
        const child = node.children[index];
        if (!child) throw new Error("This variation no longer exists.");
        node = child;
    }
    return node;
}
export function positionAt(study: Study, path: number[]) {
    return Chess.fromSetup(parseFen(nodeAt(study, path).fen).unwrap()).unwrap();
}
export function addStudyMove(
    study: Study,
    path: number[],
    move: Move,
): { study: Study; path: number[] } {
    if (path.length >= 512) throw new Error("The game exceeds 512 half-moves.");
    const position = positionAt(study, path);
    if (!position.isLegal(move)) throw new Error("Illegal move.");
    const san = makeSan(position, move);
    position.play(move);
    const fen = makeFen(position.toSetup());
    const updated = structuredClone(study);
    const node = nodeAt(updated, path);
    let index = node.children.findIndex((child) => child.fen === fen);
    if (index < 0) {
        index = node.children.length;
        node.children.push({ fen, san, comments: [], children: [] });
    }
    updated.updatedAt = Date.now();
    return { study: updated, path: [...path, index] };
}
export function importStudies(text: string, source?: StudySource): Study[] {
    const importedAt = Date.now();
    const games = readPgn(text, 16 * 1024 * 1024);
    return games.map((game, index) => {
        const position = startingPosition(game.headers).unwrap();
        if (position.rules !== "chess") throw new Error("Only standard chess is supported.");
        const study = createStudy(
            game.headers.get("Event") || `Study ${index + 1}`,
            makeFen(position.toSetup()),
        );
        const invalidPosition = getStudyPositionError(study.root.fen);
        if (invalidPosition) throw new Error(`Invalid starting position: ${invalidPosition}`);
        study.metadata = { createdAt: importedAt, source: source ?? { type: "manual" } };
        study.headers = [...game.headers];
        study.root.comments = game.comments ?? [];
        const pending = [{ source: game.moves, target: study.root, position, depth: 0 }];
        while (pending.length) {
            const item = pending.pop()!;
            if (item.depth > 512) throw new Error("The game exceeds 512 half-moves.");
            for (const child of item.source.children) {
                const pos = item.position.clone();
                const move = parseSan(pos, child.data.san);
                if (!move) throw new Error(`Illegal PGN move: ${child.data.san}`);
                const san = makeSan(pos, move);
                pos.play(move);
                const node: StudyNode = {
                    ...child.data,
                    san,
                    fen: makeFen(pos.toSetup()),
                    comments: child.data.comments ?? [],
                    children: [],
                };
                item.target.children.push(node);
                pending.push({ source: child, target: node, position: pos, depth: item.depth + 1 });
            }
        }
        return study;
    });
}
export function exportStudy(study: Study): string {
    const headers = new Map(study.headers);
    headers.set("Event", study.title);
    if (study.root.fen !== INITIAL_FEN) {
        headers.set("FEN", study.root.fen);
        headers.set("SetUp", "1");
    } else {
        headers.delete("FEN");
        headers.delete("SetUp");
    }
    const moves = new Node<PgnNodeData>();
    const pending: { source: StudyNode; target: Node<PgnNodeData> }[] = [
        { source: study.root, target: moves },
    ];
    while (pending.length) {
        const { source, target } = pending.pop()!;
        for (const child of source.children) {
            const node = new ChildNode<PgnNodeData>({
                san: child.san,
                comments: child.comments,
                startingComments: child.startingComments,
                nags: child.nags,
            });
            target.children.push(node);
            pending.push({ source: child, target: node });
        }
    }
    return writePgn({ headers, comments: study.root.comments, moves });
}
