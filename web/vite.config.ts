import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// ANALYZE=1 npm run build → genera dist/stats.html (treemap del bundle) y lo abre.
const analyze = !!process.env.ANALYZE;

// Aether-Web (post-Tauri):
//   - El backend Go corre en localhost:8080 (configurable via VITE_API_PROXY).
//   - Vite dev server proxea /api/v1/* y mantiene la cookie de sesión.
//   - En producción, el binario Go sirve dist/ embebido (go:embed) y todas las
//     llamadas son a la misma origen, sin proxy.
const apiTarget = process.env.VITE_API_PROXY || "http://localhost:8080";

export default defineConfig({
    plugins: [
        react({
            babel: { plugins: ["babel-plugin-react-compiler"] },
        }),
        tailwindcss(),
        analyze &&
            visualizer({
                filename: "dist/stats.html",
                open: true,
                gzipSize: true,
                brotliSize: true,
            }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        target: "es2022",
        minify: "esbuild",
        outDir: "dist",
        emptyOutDir: true,
    },
    esbuild: { target: "es2022" },
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": {
                target: apiTarget,
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
