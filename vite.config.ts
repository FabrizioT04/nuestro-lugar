import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// El plugin de Cloudflare ejecuta el Worker dentro de workerd (el mismo runtime de producción)
// durante `npm run dev`, con D1 local. React y la API comparten el mismo origen.
//
// Workers AI y Vectorize no existen en local. Por defecto, `npm run dev` no los usa y la búsqueda de
// recuerdos funciona por palabras. Con REMOTE_BINDINGS=1 usa los de tu cuenta (requiere `wrangler login`
// y gasta del cupo diario).
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: process.env.REMOTE_BINDINGS === "1" })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
