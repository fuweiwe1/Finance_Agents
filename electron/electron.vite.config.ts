import { defineConfig } from 'electron-vite';

// electron-vite：默认约定 src/main/index.ts + src/preload/index.ts 自动作为入口。
// 渲染层不在这里构建——dev 走 web dev server(http://localhost:5173)，生产加载 web/dist。
export default defineConfig({
  main: {},
  preload: {},
});