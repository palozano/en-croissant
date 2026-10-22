import { downloadPgn } from "./downloadPgn";

export type LichessImportScope = "all" | "chapter";
export function lichessStudyPgnUrl(input: string, scope: LichessImportScope = "all"): string {
    const text = input.trim();
    let url: URL;
    try {
        url = new URL(/^(www\.)?lichess\.org\//i.test(text) ? `https://${text}` : text);
    } catch {
        throw new Error("Paste a Lichess study link, such as https://lichess.org/study/abcdefgh.");
    }
    if (
        !["http:", "https:"].includes(url.protocol) ||
        !["lichess.org", "www.lichess.org"].includes(url.hostname) ||
        url.port ||
        url.username ||
        url.password
    )
        throw new Error("Use a study link from lichess.org.");
    const match = /^\/(?:api\/)?study\/([a-zA-Z0-9]{8})(?:\/([a-zA-Z0-9]{8}))?(?:\.pgn)?\/?$/.exec(
        url.pathname,
    );
    if (!match) throw new Error("This is not a Lichess study or chapter link.");
    if (scope === "chapter" && !match[2])
        throw new Error("For a single chapter, paste its chapter link (including the chapter ID).");
    const target = new URL(
        `https://lichess.org/api/study/${match[1]}${scope === "chapter" ? `/${match[2]}` : ""}.pgn`,
    );
    for (const parameter of ["clocks", "comments", "variations", "orientation"])
        target.searchParams.set(parameter, "true");
    return target.href;
}
export async function downloadLichessStudy(
    input: string,
    scope: LichessImportScope = "all",
    download = downloadPgn,
): Promise<string> {
    try {
        const text = await download(lichessStudyPgnUrl(input, scope));
        if (!/^\s*\[\w+\s+"/.test(text))
            throw new Error(
                "Lichess did not return a study PGN. Check that the study is public and permits downloads.",
            );
        return text;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Download failed \((401|403|404)\)/.test(message))
            throw new Error(
                "The study was not found or cannot be exported. Use a public study with downloads enabled, or export its PGN from Lichess and upload it here.",
            );
        if (/Download failed \(429\)/.test(message))
            throw new Error(
                "Lichess is limiting requests. Wait at least a minute before trying again.",
            );
        throw error;
    }
}
