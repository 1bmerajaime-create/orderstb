import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    // Empaqueta imágenes y fuentes como data URIs para que dist/index.html
    // funcione al abrirlo con doble clic (protocolo file://).
    assetsInlineLimit: 100 * 1024 * 1024,
  },
})
