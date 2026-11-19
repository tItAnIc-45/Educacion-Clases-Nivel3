import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('.', import.meta.url))

// El sitio es multipágina y usa scripts clásicos (sin type="module").
// Vite solo empaqueta index.html, así que copiamos tal cual el resto de
// recursos para que lleguen al despliegue con las mismas rutas.
const ESTATICOS = ['assets', 'css', 'js', 'pages', '404.html']

function copiarEstaticos() {
  return {
    name: 'tp-copiar-estaticos',
    apply: 'build',
    closeBundle() {
      for (const nombre of ESTATICOS) {
        const origen = resolve(RAIZ, nombre)
        if (!existsSync(origen)) continue
        cpSync(origen, resolve(RAIZ, 'dist', nombre), { recursive: true })
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    copiarEstaticos(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
