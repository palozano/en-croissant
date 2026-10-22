/// <reference types="vitest/config" />
import { resolve } from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import * as os from "node:os";

const isDebug = !!process.env.TAURI_ENV_DEBUG;
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        tanstackRouter({
            target: "react",
        }),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
    ],
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
    build: {
        outDir: mode === "web" ? "dist-web" : "dist",
        rolldownOptions: {
            output: {
                // Preserve initialization order when shared dependencies move between chunks.
                strictExecutionOrder: true,
                codeSplitting: {
                    groups: [
                        {
                            name: "translations",
                            test: /[/\\]src[/\\]translation[/\\]/,
                            maxSize: 350_000,
                            priority: 20,
                        },
                        {
                            name: "vendor",
                            test: /[/\\]node_modules[/\\]/,
                            maxSize: 350_000,
                            priority: 10,
                        },
                        {
                            name: "app",
                            test: /[/\\]src[/\\]/,
                            maxSize: 350_000,
                            priority: 5,
                        },
                    ],
                },
            },
        },
        minify: isDebug ? false : "esbuild",
        sourcemap: isDebug ? "inline" : false,
        target: process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    },
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "./src"),
        },
    },
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        // JSDOM owns browser storage; Node 22+ also exposes incompatible globals.
        execArgv:
            Number(process.versions.node.split(".")[0]) >= 22
                ? ["--no-experimental-webstorage"]
                : [],
        environment: "jsdom",
    },
    define: {
        "import.meta.env.VITE_PLATFORM": JSON.stringify(os.platform()),
    },
}));
