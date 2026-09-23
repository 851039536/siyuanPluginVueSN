// Vitest 配置：仅用于纯函数单元测试（src/**/*.spec.ts）
//
// ⚠️ 刻意与 vite.config.ts 解耦，只复刻其 resolve.alias 一个字段：
//    vite.config.ts 的 buildStart 里有 execSync("node scripts/merge-i18n.mjs") 副作用，
//    并加载 viteStaticCopy / livereload / zipPack 插件；被 Vitest 加载会触发无谓的
//    i18n 合并与插件初始化。此处独立配置是最小且安全的耦合方式。
//
// 测试目标全部为无副作用纯函数（解析 / 换算 / 聚合 / 签名），故 environment 用 node，
// 不引入 jsdom / happy-dom，也不加载 @vitejs/plugin-vue（无组件渲染测试）。
//
// ⚠️ 新增 feature 别名时需三处同步：vite.config.ts / tsconfig.json / 本文件。
//    当前被测目标仅使用 "@/" 与相对导入，故此处只配置 "@"；新增测试若需
//    "@featureName" 别名，请同步补到 alias 下（细节见 AGENTS_BUILD.md § 单元测试）。
import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // 测试文件与被测源文件同目录（AGENTS_ARCH.md § 纯函数测试约定）
    include: ["src/**/*.spec.ts"],
    globals: false,
  },
})
