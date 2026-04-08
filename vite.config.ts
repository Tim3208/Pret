import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * React와 Tailwind CSS 플러그인을 연결한 Vite 설정이다.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
