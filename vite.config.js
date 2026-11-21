import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import process from 'node:process'

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.GITHUB_SHA?.slice(0, 12) ||
  new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildId),
  },
})
