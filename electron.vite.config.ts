import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()], build: { rolldownOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } } },
  renderer: { plugins: [react()] }
})
