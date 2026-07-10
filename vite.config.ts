import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // 잘 바뀌지 않는 firebase 를 별도 청크로 분리해 캐시 히트율을 높인다.
        // (페이지 본문은 routes/adminRoutes.tsx 의 React.lazy 로 이미 분리된다.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          return undefined
        },
      },
    },
  },
})
