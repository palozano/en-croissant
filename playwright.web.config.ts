import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "tests/web",
    fullyParallel: false,
    use: { baseURL: "http://127.0.0.1:4173", headless: true, trace: "retain-on-failure" },
    webServer: {
        command: "pnpm preview:web",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
    },
});
