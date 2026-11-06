import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // ExcelJS (~930 kB) is only downloaded when the teacher asks for a template, never on first load.
    chunkSizeWarningLimit: 1000,
  },
})
