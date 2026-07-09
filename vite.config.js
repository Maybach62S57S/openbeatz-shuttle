import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { target: "es2020" }, // bewusst konservativ, damit Kompatibilitätsprobleme lokal auffallen statt erst beim Deploy
});
