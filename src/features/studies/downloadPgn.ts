export async function downloadPgn(url: string, request = fetch): Promise<string> {
    const target = new URL(url);
    if (!["https:", "http:"].includes(target.protocol))
        throw new Error("Use an HTTP or HTTPS address.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const maximum = 16 * 1024 * 1024;
    try {
        const response = await request(target, { signal: controller.signal });
        if (!response.ok) throw new Error(`Download failed (${response.status}).`);
        if (Number(response.headers.get("Content-Length") ?? 0) > maximum)
            throw new Error("The file exceeds 16 MB.");
        if (!response.body) throw new Error("The download is empty.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let size = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maximum) {
                await reader.cancel();
                throw new Error("The file exceeds 16 MB.");
            }
            text += decoder.decode(value, { stream: true });
        }
        return text + decoder.decode();
    } finally {
        clearTimeout(timeout);
        controller.abort();
    }
}
