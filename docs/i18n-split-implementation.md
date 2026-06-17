# i18n 分片拆分实现文档

## 1. 背景与问题

### 1.1 原始状态

项目的国际化内容存储在两个巨型 JSON 文件中：

```
src/i18n/
├── zh_CN.json    # 1615 行 / 68.75 KB / 约 700+ 叶子键
└── en_US.json    # 1616 行 / 67.66 KB / 约 700+ 叶子键
```

### 1.2 核心痛点

| 痛点 | 具体表现 |
|------|----------|
| **巨石文件** | 1600+ 行单个文件，新增文本难以定位 |
| **命名混乱** | 3 种命名风格混用：camelCase 平铺键、嵌套模块对象、`base64Image_xxx` 下划线前缀 |
| **结构割裂** | 既有顶层平铺键（`enablePageLock`），又有同名嵌套对象（`pageLock.passwordHint`），归属不清 |
| **无类型安全** | 大量 `(plugin.i18n as any).xxx` 绕过类型检查 |
| **无同步校验** | 中英文键是否对齐靠人工肉眼比对 |
| **重复键** | `polish`、`expand`、`condense`、`analyze`、`aiEditTools` 等在 JSON 中出现 2 次 |
| **合并冲突** | 两人同时新增不同功能的 i18n 文本注定冲突 |
| **编辑门槛高** | 新手不知道某个键属于哪个模块，怕改错 |

### 1.3 约束条件

思源笔记 Plugin 框架读取 i18n 的规则是固定的：

```
viteStaticCopy: src/i18n/** → dist/i18n/
思源框架自动加载 dist/i18n/zh_CN.json → plugin.i18n
```

即**必须产出单一 JSON 文件**，框架不支持从目录分片加载。

## 2. 设计目标

1. **源文件分片**：按功能模块拆分，每个 feature 独立一个文件
2. **构建时合并**：Vite 构建前自动将分片合并为思源框架需要的单一 JSON
3. **零破坏性**：合并产物与原文件逐字节一致，不改变运行时行为
4. **可校验**：提供脚本检测中英文键对齐 + 重复键
5. **低心智负担**：日常开发只需编辑对应 feature 的分片文件

## 3. 架构设计

### 3.1 目录结构

```
src/i18n/
├── zh_CN/                          # 中文源文件（分片）
│   ├── common.json                  # 通用键（save/cancel/confirm/...）
│   ├── pageLock.json               # 页面锁定
│   ├── tableOfContents.json        # 目录索引
│   ├── imageCompressor.json        # 图片压缩
│   ├── wordQuery.json              # 单词查询
│   ├── floatingToolbar.json        # 浮动工具栏
│   ├── aiContentGenerator.json     # AI 内容生成
│   ├── ...（共 40 个模块文件）
│   └── gitPush.json
├── en_US/                          # 英文源文件（分片，结构镜像）
│   ├── common.json
│   ├── ...（共 38 个模块文件）
│   └── gitPush.json
├── zh_CN.json                      # 构建产物（脚本自动生成）
└── en_US.json                      # 构建产物（脚本自动生成）
```

### 3.2 数据流

```
开发者编辑
  │
  ├─→ src/i18n/zh_CN/wordQuery.json  （新增键）
  └─→ src/i18n/en_US/wordQuery.json  （新增英文翻译）
         │
         ▼  vite buildStart 钩子触发
  ┌──────────────────────────────────────────┐
  │  scripts/merge-i18n.mjs                  │
  │                                          │
  │  1. 读取 src/i18n/zh_CN/*.json           │
  │  2. common.json 优先合并（作为基础）       │
  │  3. 其余按字母序覆盖（同名键后写者胜）      │
  │  4. 写入 src/i18n/zh_CN.json             │
  │                                          │
  │  5. 对 en_US 重复同样流程                 │
  │  6. 输出合并统计（模块名 + 键数）          │
  └──────────────────────────────────────────┘
         │
         ▼
  viteStaticCopy: src/i18n/*.json → dist/i18n/
         │
         ▼
  思源框架: plugin.i18n = JSON.parse(zh_CN.json)
```

### 3.3 合并规则

`merge-i18n.mjs` 的合并策略：

```
publicKey = zh_CN/common.json
Object.keys(alphabet.sorted)
  .forEach(file => Object.assign(result, file.content))
```

- **`common.json` 永远最先**：作为基础，提供 `save`、`cancel`、`confirm` 等全局通用键
- **其余按字母序合并**：`Object.assign` 保证同名键后写者覆盖先写者
- **去重自动处理**：原 JSON 中的重复键（如 `polish` 出现 2 次），在 `Object.assign` 过程中最后一个值自然胜出

## 4. 核心脚本详解

### 4.1 `scripts/split-i18n.mjs` — 自动拆分

**职责**：将单体 JSON 拆分为 per-feature 分片文件。

**分类策略**：

```javascript
const MODULE_RULES = [
  // 规则类型 1：嵌套对象直接用 key 名作为模块名
  { pattern: 'imageCompressor', module: 'imageCompressor' },

  // 规则类型 2：平铺键按前缀/关键词归类到对应模块
  { pattern: /^(lock|unlock|setPassword|password|pageLock|...)/, module: 'pageLock' },
  { pattern: /^(font|heading|codeBlock|tableStyle|...)/, module: 'generalSettings' },
  // ... 共 35 条规则
]
```

**分类流程**：

```
function splitI18n(data) {
  for (key, value of data) {
    if (typeof value === 'object') {
      // 嵌套对象 → 用 key 名作为模块名
      modules[key] = { [key]: value }
    } else {
      // 平铺键 → 按 MODULE_RULES 匹配归类
      moduleName = classifyKey(key)   // 匹配规则 → 模块名，无匹配 → 'common'
      modules[moduleName][key] = value
    }
  }
}
```

**规则覆盖**：35 条 `MODULE_RULES` 涵盖所有 38-40 个模块，无法匹配的键归入 `common.json`。

### 4.2 `scripts/merge-i18n.mjs` — 构建合并

**职责**：Vite 构建前将分片合并为单一 JSON。

**执行时机**：在 `vite.config.ts` 的 `buildStart` 钩子中自动调用。

```typescript
// vite.config.ts
{
  name: "merge-i18n",
  buildStart() {
    execSync("node scripts/merge-i18n.mjs", { stdio: "inherit" })
  },
}
```

**输出示例**：

```
📦 Merging i18n files...

  common.json → 102 keys
  aiContentGenerator.json → 88 keys
  ...
  wordQuery.json → 1 keys
✅ zh_CN: 664 top-level keys (664 total including nested)
```

### 4.3 `scripts/verify-i18n.mjs` — 键同步校验

**职责**：确保中英文键完全对齐 + 检测重复键。

**检测内容**：

| 检测项 | 说明 |
|--------|------|
| **重复顶层键** | `Object.keys()` 出现同名则报告（JSON 解析时后面的覆盖前面的） |
| **叶子键缺失** | 递归提取所有 `a.b.c` 路径，交叉对比 `zh_CN` vs `en_US` |
| **拆分文件完整性** | `--split` 模式：检查 `en_US/` 是否包含 `zh_CN/` 的所有同名文件 |

**用法**：

```bash
npm run i18n:verify          # 校验合并后的 JSON
node scripts/verify-i18n.mjs --split  # 校验拆分文件完整性
```

## 5. 运行时验证

### 5.1 验证方法

```javascript
// scripts/compare-i18n.mjs
const original = JSON.parse(
  execSync('git show HEAD:src/i18n/zh_CN.json', { encoding: 'utf-8' })
)
const merged = JSON.parse(
  readFileSync(join(i18nDir, 'zh_CN.json'), 'utf-8')
)

// 逐键对比
for (const key of Object.keys(original)) {
  if (JSON.stringify(original[key]) !== JSON.stringify(merged[key])) {
    diffs.push(key)
  }
}
```

### 5.2 验证结果

```
=== zh_CN ===
Original: 664 keys
Merged:   664 keys
✅ Merged is identical to original!

=== en_US ===
Original: 652 keys
Merged:   652 keys
✅ Merged is identical to original!
```

合并产物与原文件**键数相同、值完全相同**，零破坏性。

### 5.3 构建测试

`npx vite build` 完整构建通过，`merge-i18n` 插件在 `buildStart` 阶段正常执行，合并后的 JSON 被正确复制到 `dist/i18n/`。

## 6. 发现并处理的预存问题

### 6.1 en_US 键缺失（60 个）

```
❌ 60 key(s) in zh_CN but missing in en_US:
   - video.title ~ video.ffmpegNotAvailable  （整个 video 模块 30 个键）
   - heatmapMarker.title / heatmapMarker.description
   - superPanel.refresh / superPanel.refreshing / superPanel.refreshSuccess
   - pronunciation / blocks / assets  （顶层平铺键）
   - unitConverterTitle / lengthInputValue ~ lengthQuickResults  （6 个键）
   - scriptLauncher.importScript
```

### 6.2 zh_CN 键缺失（1 个）

```
❌ 1 key(s) in en_US but missing in zh_CN:
   - qrcodeFeature
```

这些是拆分前就存在的问题，拆分过程保持了原始数据不变，未做修复。

### 6.3 重复键（zh_CN 6 个）

在 `zh_CN.json` 中以下键定义了两次（JSON 解析时后者覆盖前者）：

- `polish`（第 814 行 "润色" → 第 826 行 "润色"）
- `expand`（第 815 行 "扩写" → 第 827 行 "扩写"）
- `condense`（第 816 行 "精简" → 第 828 行 "精简"）
- `analyze`（第 819 行 "智能分析" → 第 830 行 "智能分析"）
- `aiEditTools`（第 806 行 → 第 825 行）
- `superPanel` 内部 `statusStable/statusNeedsFix/statusCritical/statusMinor` 各出现两次

`Object.assign` 合并时自然保留了最后的值，与运行时行为一致。

## 7. 分片文件清单

### zh_CN（40 个文件）

| 文件名 | 键数 | 对应功能 |
|--------|------|----------|
| `common.json` | 102 | 全局通用键 |
| `generalSettings.json` | 136 | 字体/标题/代码块/表格/列表样式 |
| `aiContentGenerator.json` | 88 | AI 内容生成 + AI 智能编辑 |
| `base64Image.json` | 71 | Base64 图片转换 |
| `dataBackup.json` | 49 | 数据备份 |
| `encryption.json` | 30 | 内容加密 |
| `tableOfContents.json` | 28 | 目录索引 |
| `pageLock.json` | 27 | 页面锁定 |
| `shortcuts.json` | 27 | 快捷键面板 |
| `skillsViewer.json` | 23 | Skills 查看器 |
| `qrcode.json` | 19 | 二维码生成 |
| `compactMode.json` | 8 | 紧凑模式 |
| `unitConverter.json` | 8 | 单位转换 |
| `pronunciation.json` | 7 | 谐音翻译 |
| 其余 24 个 | 1-3 | 嵌套对象模块 |

### en_US（38 个文件）

比 zh_CN 少 `heatmapMarker.json` 和 `video.json`（原 en_US.json 中缺失这两个模块）。

## 8. npm 脚本

```json
{
  "i18n:merge": "node scripts/merge-i18n.mjs",
  "i18n:verify": "node scripts/verify-i18n.mjs",
  "i18n:split": "node scripts/split-i18n.mjs"
}
```

| 命令 | 何时使用 | 频率 |
|------|----------|------|
| `i18n:merge` | 手动合并（构建时自动执行，通常无需手动） | 极少 |
| `i18n:verify` | 提交前检查键对齐 | 每次修改 i18n 后 |
| `i18n:split` | 从单体 JSON 重新拆分分片 | 几乎不用 |

## 9. 局限性

| 局限 | 说明 | 后续改进方向 |
|------|------|-------------|
| **分类规则硬编码** | `split-i18n.mjs` 中 35 条正则规则需要手动维护 | 可改为读取 `FEATURE_CONFIG` 自动生成规则 |
| **无类型生成** | 代码中 `plugin.i18n` 仍为 `any` 类型 | 可增加 `scripts/generate-i18n-types.mjs` 从 JSON 生成 TS 类型 |
| **en_US 不完整** | 原 en_US.json 比 zh_CN.json 少 60 个键 | 需补齐英文翻译（可借助 AI 批量翻译） |
| **base64Image 命名遗留** | 使用 `base64Image_xxx` 下划线前缀，而非嵌套对象 | 待后续统一重构为 `base64Image.xxx` 嵌套结构 |
| **重复键未清理** | 6 个重复键未删除冗余定义 | 可合并为一条 |

## 10. 扩展指南

### 新增模块时

1. 在 `src/i18n/zh_CN/` 下新建 `yourFeature.json`
2. 在 `src/i18n/en_US/` 下新建同名文件
3. `split-i18n.mjs` 的 `MODULE_RULES` 无需更新（未匹配的键归入 `common.json`）
4. 若要精确归类，可在 `MODULE_RULES` 中添加新的正则规则

### 重构 base64Image 命名

当前 `base64Image_encode` 等平铺键可重构为嵌套结构：

```json
// 重构前（下划线前缀）
{ "base64Image_encode": "图片转Base64" }

// 重构后（嵌套对象，统一风格）
{ "base64Image": { "encode": "图片转Base64" } }
```

需要同步更新所有 `plugin.i18n.base64Image_encode` 引用为 `plugin.i18n.base64Image.encode`。
