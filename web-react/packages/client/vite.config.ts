import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // Regra do projeto: React Compiler ativo desde o dia 1. Uma das duas
    // perguntas do spike é se ele convive com o TanStack Virtual — desligar
    // aqui esvazia o spike.
    react({ compiler: true }),
    tailwindcss(),
  ],
});
