import { describe, expect, it } from "vitest";
import { downloadPgn } from "./downloads";

describe("browser PGN downloads", () => {
    it("downloads UTF-8 PGN with a bounded request", async () => {
        const result = await downloadPgn(
            "https://example.org/game.pgn",
            async () => new Response('[Event "Español"]\n\n1. e4 *'),
        );
        expect(result).toContain("Español");
    });
    it("rejects non-web URLs, failed responses and oversized downloads", async () => {
        await expect(downloadPgn("file:///etc/passwd")).rejects.toThrow("HTTP");
        await expect(
            downloadPgn("https://example.org", async () => new Response("", { status: 404 })),
        ).rejects.toThrow("404");
        await expect(
            downloadPgn(
                "https://example.org",
                async () =>
                    new Response("", { headers: { "Content-Length": String(20 * 1024 * 1024) } }),
            ),
        ).rejects.toThrow("16 MB");
        await expect(
            downloadPgn(
                "https://example.org",
                async () => new Response(new Uint8Array(16 * 1024 * 1024 + 1)),
            ),
        ).rejects.toThrow("16 MB");
    });
});
