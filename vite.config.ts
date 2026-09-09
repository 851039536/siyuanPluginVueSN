/* eslint-disable node/prefer-global/process */
import { execSync } from "node:child_process"
import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import fg from "fast-glob"
import minimist from "minimist"
import livereload from "rollup-plugin-livereload"
import {
  defineConfig,
  loadEnv,
  type Plugin,
} from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack"

import pluginInfo from "./plugin.json" with { type: "json" }

export default defineConfig(({
  mode,
}) => {

  console.log('mode=>', mode)
  const env = loadEnv(mode, process.cwd())
  const {
    VITE_SIYUAN_WORKSPACE_PATH,
  } = env
  console.log('env=>', env)


  const siyuanWorkspacePath = VITE_SIYUAN_WORKSPACE_PATH
  let devDistDir = './dev'
  if (!siyuanWorkspacePath) {
    console.log("\nSiyuan workspace path is not set.")
  } else {
    console.log(`\nSiyuan workspace path is set:\n${siyuanWorkspacePath}`)
    devDistDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`
  }
  console.log(`\nPlugin will build to:\n${devDistDir}`)

  const args = minimist(process.argv.slice(2))
  const isWatch = args.watch || args.w || false
  const distDir = isWatch ? devDistDir : "./dist"

  console.log()
  console.log("isWatch=>", isWatch)
  console.log("distDir=>", distDir)

  // watch 模式监听外部静态资源（i18n 合并产物 / README / plugin.json），变化即触发重建。
  // vite 8（Rolldown）下 hook 的 this 需借助 vite 的 Plugin 类型标注才能获得 addWatchFile 上下文。
  const watchExternalPlugin: Plugin = {
    name: "watch-external",
    async buildStart() {
      const files = await fg([
        "src/i18n/*.json",
        "src/i18n/**/*.json",
        "./README*.md",
        "./plugin.json",
      ])
      for (const file of files) {
        this.addWatchFile(file)
      }
    },
  }

  return {
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "src"),
        // ===== 功能模块别名：@<featureName> → src/features/<featureName> =====
        // 新增功能模块时，务必同时更新 vite.config.ts / tsconfig.json / AGENTS.md / AGENTS_API.md
        "@aiContentGenerator": resolve(import.meta.dirname, "src/features/aiContentGenerator"),
        "@apiDebugger": resolve(import.meta.dirname, "src/features/apiDebugger"),
        "@bookmarkMarker": resolve(import.meta.dirname, "src/features/bookmarkMarker"),
        "@compactMode": resolve(import.meta.dirname, "src/features/compactMode"),
        "@dataSnapshot": resolve(import.meta.dirname, "src/features/dataSnapshot"),
        "@diskBrowser": resolve(import.meta.dirname, "src/features/diskBrowser"),
        "@docAnalysis": resolve(import.meta.dirname, "src/features/docAnalysis"),
        "@docNavigation": resolve(import.meta.dirname, "src/features/docNavigation"),
        "@encryption": resolve(import.meta.dirname, "src/features/encryption"),
        "@everythingSearch": resolve(import.meta.dirname, "src/features/everythingSearch"),
        "@flashcardReading": resolve(import.meta.dirname, "src/features/flashcardReading"),
        "@floatingBox": resolve(import.meta.dirname, "src/features/floatingBox"),
        "@floatingToolbar": resolve(import.meta.dirname, "src/features/floatingToolbar"),
        "@formatAssistant": resolve(import.meta.dirname, "src/features/formatAssistant"),
        "@generalSettings": resolve(import.meta.dirname, "src/features/generalSettings"),
        "@gitPush": resolve(import.meta.dirname, "src/features/gitPush"),
        "@htmlViewer": resolve(import.meta.dirname, "src/features/htmlViewer"),
        "@imageCompressor": resolve(import.meta.dirname, "src/features/imageCompressor"),
        "@imageCreation": resolve(import.meta.dirname, "src/features/imageCreation"),
        "@pageLock": resolve(import.meta.dirname, "src/features/pageLock"),
        "@passwordVault": resolve(import.meta.dirname, "src/features/passwordVault"),
        "@prompts": resolve(import.meta.dirname, "src/features/prompts"),
        "@quickNote": resolve(import.meta.dirname, "src/features/quickNote"),
        "@resourceManager": resolve(import.meta.dirname, "src/features/resourceManager"),
        "@rssReader": resolve(import.meta.dirname, "src/features/rssReader"),
        "@s3Backup": resolve(import.meta.dirname, "src/features/s3Backup"),
        "@s3FileManager": resolve(import.meta.dirname, "src/features/s3FileManager"),
        "@scriptLauncher": resolve(import.meta.dirname, "src/features/scriptLauncher"),
        "@shortcut": resolve(import.meta.dirname, "src/features/shortcut"),
        "@skillLearning": resolve(import.meta.dirname, "src/features/skillLearning"),
        "@skillsViewer": resolve(import.meta.dirname, "src/features/skillsViewer"),
        "@statistics": resolve(import.meta.dirname, "src/features/statistics"),
        "@statusBar": resolve(import.meta.dirname, "src/features/statusBar"),
        "@superPanel": resolve(import.meta.dirname, "src/features/superPanel"),
        "@tableOfContents": resolve(import.meta.dirname, "src/features/tableOfContents"),
        "@textDiff": resolve(import.meta.dirname, "src/features/textDiff"),
        "@themeColor": resolve(import.meta.dirname, "src/features/themeColor"),
        "@toolCollection": resolve(import.meta.dirname, "src/features/toolCollection"),
        "@video": resolve(import.meta.dirname, "src/features/video"),
        "@websiteNavigation": resolve(import.meta.dirname, "src/features/websiteNavigation"),
        // jszip 默认按 browser 字段解析到浏览器版 dist/jszip.min.js（nodestream 能力被裁剪），
        // 会导致 s3Backup 的流式打包（zip.file 挂载 Node 流 + generateNodeStream）
        // 抛出 "nodestream is not supported by this platform"。
        // 思源桌面端是 Electron 渲染进程，具备完整 Node 能力，这里强制打包 Node 源码版，
        // 并把 readable-stream 指向运行时内置的原生 stream 模块（下方 external 列表中外部化）。
        "jszip": resolve(import.meta.dirname, "node_modules/jszip/lib/index.js"),
        "readable-stream": "stream",
      },
    },

    plugins: [
      vue(),
      // 构建前自动合并 i18n 分片文件
      {
        name: "merge-i18n",
        buildStart() {
          try {
            execSync("node scripts/merge-i18n.mjs", { stdio: "inherit" })
          } catch (e) {
            console.error("❌ Failed to merge i18n files:", e)
          }
        },
      },
      viteStaticCopy({
        targets: [
          {
            src: "./README*.md",
            dest: "./",
          },
          {
            src: "./icon.png",
            dest: "./",
          },
          {
            src: "./preview.png",
            dest: "./",
          },
          {
            src: "./plugin.json",
            dest: "./",
          },
          {
            // 仅复制合并产物 zh_CN.json / en_US.json（分片子目录无需部署）
            // v4 起插件默认保留完整目录结构，需 stripBase 去掉 src/i18n/ 前缀
            src: "./src/i18n/*.json",
            dest: "./i18n/",
            rename: { stripBase: true },
          },
          {
            // 文档字体设置内置字体：霞鹜文楷（SIL OFL 1.1，可自由嵌入/再分发）
            // 运行时经 plugin.assetsPath 拼接 /assets/fonts/<file> 供 @font-face 加载
            // stripBase 去掉 src/features/generalSettings/assets/fonts/ 前缀，
            // 使 dest 目标下直接是字体文件名，而非嵌套完整源路径
            src: "./src/features/generalSettings/assets/fonts/LXGWWenKai-Regular.ttf",
            dest: "./assets/fonts/",
            rename: { stripBase: true },
          },
          {
            // 内置字体：新晰黑 Code / NeoXiHei Code（IPA Font License v1.0）
            src: "./src/features/generalSettings/assets/fonts/NeoXiHeiCode-Regular.ttf",
            dest: "./assets/fonts/",
            rename: { stripBase: true },
          },
          {
            // 同步携带霞鹜文楷 OFL 许可证，遵守分发协议
            src: "./src/features/generalSettings/assets/fonts/OFL.txt",
            dest: "./assets/fonts/",
            rename: { stripBase: true },
          },
          {
            // 同步携带新晰黑 IPA 许可证，遵守分发协议
            src: "./src/features/generalSettings/assets/fonts/License.txt",
            dest: "./assets/fonts/",
            rename: { stripBase: true },
          },
        ],
      }),
    ],

    // https://github.com/vitejs/vite/issues/1930
    // https://vitejs.dev/guide/env-and-mode.html#env-files
    // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
    // 在这里自定义变量
    define: {
      "process.env.DEV_MODE": `"${isWatch}"`,
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },

    build: {
      // 输出路径
      outDir: distDir,
      emptyOutDir: !isWatch,

      // 注：vite 8（Rolldown）已废弃 build.commonjsOptions（no-op），jszip 的
      // nodestream 探测依赖 Rolldown 保留 require + 上方 alias → 原生 stream 的机制。

      // 构建后是否生成 source map 文件
      sourcemap: false,

      // 设置为 false 可以禁用最小化混淆
      // 或是用来指定是应用哪种混淆器
      // boolean | 'terser' | 'esbuild'
      // 不压缩，用于调试
      minify: !isWatch,

      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: resolve(import.meta.dirname, "src/index.ts"),
        // the proper extensions will be added
        fileName: "index",
        formats: ["cjs"],
      },
      rollupOptions: {
        plugins: [
          ...(isWatch
            ? [
                livereload(devDistDir),
                watchExternalPlugin,
              ]
            : [
                zipPack({
                  inDir: "./dist",
                  outDir: "./",
                  outFileName: "package.zip",
                }),
              ]),
        ],

        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: ["siyuan", "process", "stream", "node:fs", "node:path", "node:child_process", "node:os", "node:util", "node:stream", "node:http", "node:https", "node:crypto"],

        output: {
          entryFileNames: "[name].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === "style.css") {
              return "index.css"
            }
            // Rolldown 下 PreRenderedAsset.name 可能为空，回退到 names[0] 保证返回 string
            return assetInfo.name || assetInfo.names?.[0] || "asset"
          },
        },
      },
    },
  }
})
