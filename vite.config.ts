import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
const sh = (cmd: string) => {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}
const commit = (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7) || sh('git rev-parse --short HEAD') || 'neznámy'
const commitMessage = sh('git log -1 --format=%s')
const builtAt = new Date().toISOString()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // version.json: stránka Info podľa neho zistí, či je nasadená novšia verzia
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, commit, builtAt }) })
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_COMMIT_MSG__: JSON.stringify(commitMessage),
    __APP_BUILT_AT__: JSON.stringify(builtAt),
  },
})
