---
name: video-feature-compliance-fix
overview: 修复 video 功能模块的 AGENTS.md 违规项：硬编码中文 showMessage、动态 import("siyuan")、SCSS 硬编码字体/box-shadow、index.vue 文件过大
todos:
  - id: i18n-keys
    content: 在 zh_CN/video.json 和 en_US/video.json 中新增约 30 个 showMessage 翻译键
    status: completed
  - id: fix-dynamic-import
    content: 修复 types/index.ts 中 2 处动态 import("siyuan") 为静态导入
    status: completed
  - id: fix-scss
    content: 修复 styles/index.scss 中硬编码 font-size/font-weight/line-height 和 box-shadow
    status: completed
  - id: fix-index-showMessage
    content: 替换 index.vue 中 22 处硬编码 showMessage 为 i18n 调用
    status: completed
    dependencies:
      - i18n-keys
  - id: fix-dialog-showMessage
    content: 替换 VideoDownloadDialog.vue 中 23 处硬编码 showMessage 为 i18n 调用
    status: completed
    dependencies:
      - i18n-keys
  - id: split-index-vue
    content: 拆分 index.vue 中的对话框为独立组件，提取 composables
    status: completed
    dependencies:
      - fix-index-showMessage
      - fix-dialog-showMessage
---

## 需求概述

根据 AGENTS.md 规则，修复 video 功能模块中的代码规范违规项。

## 核心问题

1. **硬编码中文 showMessage** — `index.vue` 中 22 处、`VideoDownloadDialog.vue` 中 23 处 `showMessage("中文", ...)` 未通过 i18n 翻译
2. **动态 import("siyuan")** — `types/index.ts` 中 2 处 `import("siyuan").then(...)` 应改为标准静态导入
3. **SCSS 硬编码 font-size/font-weight/line-height** — `styles/index.scss` 中约 27 处 font-size、6 处 font-weight、1 处 line-height 硬编码
4. **SCSS 使用 box-shadow** — `styles/index.scss` 中 2 处 `box-shadow` 违反 Codex 规范（应改用 border）
5. **index.vue 文件过大** — 1687 行，远超 500 行硬阈值

## 修复目标

- 所有 showMessage 调用使用 i18n 翻译键
- 动态导入改为静态导入
- SCSS 中使用设计 Token 替代硬编码值
- box-shadow 改为 border 或其他合规方式
- 拆分 index.vue 至合理大小

## 技术栈

- Vue 3 + TypeScript + SCSS
- 设计 Token：`src/_variables.scss`（`$font-size-*` / `$font-weight-*` / `$line-height-*` / `$radius-*` / `$spacing-*`）
- i18n 系统：`src/i18n/{zh_CN,en_US}/video.json`

## 实现方案

### 1. i18n 修复策略

- 在 `zh_CN/video.json` 和 `en_US/video.json` 中新增约 30 个 showMessage 相关翻译键
- `index.vue` 中通过 `usePlugin()` 获取 `plugin.i18n.video` 访问翻译
- `VideoDownloadDialog.vue` 中通过 props 接收 i18n 对象（遵循 websiteNavigation 模式）
- 模板中的硬编码中文也需替换为 i18n 绑定

### 2. 动态导入修复

- `types/index.ts` 中将 `import("siyuan").then(({ showMessage }) => ...)` 改为顶层 `import { showMessage } from "siyuan"`

### 3. SCSS 修复策略

- 在 `styles/index.scss` 顶部添加 `@use "@/variables.scss" as *;`
- 所有 `font-size: 12px` → `$font-size-xs`，`13px` → `$font-size-sm`，`14px` → `$font-size-sm`，`15px` → `$font-size-base`，`16px` → `$font-size-base`
- `font-weight: 500` → `$font-weight-medium`，`600` → `$font-weight-semibold`
- `line-height: 1.5` → `$line-height-normal`
- `box-shadow: var(--b3-dialog-shadow)` → `border: 1px solid var(--b3-border-color)` + `outline` 或其他合规方式

### 4. 文件拆分策略

- 将 `index.vue` 中的对话框模板提取为独立组件（EncryptDialog、DecryptDialog、MergeDialog、CompressDialog、FFmpegPathDialog）
- 将 FFmpeg 相关方法提取到 `composables/useFFmpeg.ts`
- 将加密/解密方法提取到 `composables/useVideoCrypto.ts`

## 目录结构

```
src/features/video/
├── index.vue              # [MODIFY] 主组件，拆分后保留核心逻辑
├── index.ts               # [KEEP] 注册入口
├── types/
│   └── index.ts           # [MODIFY] 修复动态导入
├── styles/
│   └── index.scss         # [MODIFY] 修复硬编码 + box-shadow
├── composables/
│   ├── useFFmpeg.ts       # [NEW] FFmpeg 相关方法
│   └── useVideoCrypto.ts  # [NEW] 加密/解密方法
├── components/
│   ├── VideoDownloadDialog.vue  # [MODIFY] 修复 showMessage i18n
│   ├── EncryptDialog.vue        # [NEW] 批量加密对话框
│   ├── DecryptDialog.vue        # [NEW] 批量解密对话框
│   ├── MergeDialog.vue          # [NEW] 视频合并对话框
│   ├── CompressDialog.vue       # [NEW] 视频压缩对话框
│   └── FFmpegPathDialog.vue     # [NEW] FFmpeg 路径设置对话框
└── utils/                 # [KEEP] 工具函数不变

src/i18n/
├── zh_CN/video.json       # [MODIFY] 新增翻译键
└── en_US/video.json       # [MODIFY] 新增翻译键
```

## 关键实现细节

- i18n 键命名规范：`video.xxxMessage`（如 `video.loadFailed`、`video.mergeSuccess`）
- 模板中硬编码中文使用 `{{ plugin.i18n.video.xxx }}` 绑定
- SCSS 中 `border-radius: 4px` → `$radius-sm`，`border-radius: var(--b3-border-radius)` 保持不变
- 对话框组件遵循子组件自包含模式（接收最小 props，内部自行处理）

## Agent Extensions

无适用的扩展技能。