import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: (() => {
    const repoFull = process.env.GITHUB_REPOSITORY || '' // owner/repo
    const repo = repoFull.split('/')[1] || ''
    // 用户/组织主页仓库（owner.github.io）需要以根路径部署
    if (repo.endsWith('.github.io')) return '/'
    return repo ? `/${repo}/` : '/'
  })(),
  plugins: [react()],
})
