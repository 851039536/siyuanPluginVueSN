# AGENTS_STYLE.md

 UI 风格 Codex、设计 Token、字号层级、SCSS 分离与内置字体规范。

## UI 风格：Codex

**强制规则**：所有新增 feature 的 UI 必须遵循 Codex 风格，使用设计 Token，禁止硬编码。

### 全局设计 Token（`src/_variables.scss`）

所有 feature 的 `styles/*.scss` 文件首先 `@use '@/variables.scss' as *;`，以下 Token 全局可用：

```scss
// 颜色（$color-*）— 禁止硬编码色值
// 语义色作为思源 CSS 变量（--b3-theme-*）的 fallback，运行时思源必提供主题变量，fallback 仅防御性兜底
$color-fg: hsl(24 10% 5%);            // 深前景/正文文本
$color-bg: hsl(55 9% 97%);            // 浅背景
$color-muted: hsl(30 5% 65%);         // 中灰（次要文本）
$color-surface: hsl(45 5% 96%);       // 浅灰表面（卡片/面板背景）
$color-border: hsl(30 6% 88%);        // 边框/分割线
$color-primary: hsl(24 9% 10%);       // 主色（暖黑）
$color-secondary: hsl(45 5% 96%);     // 次色（暖灰）
$color-accent: hsl(35 85% 55%);       // 强调（琥珀金）
$color-danger: hsl(0 72% 51%);        // 危险/错误（红）
$color-danger-bright: hsl(0 84.2% 60.2%); // 亮红（错误提示文字/高亮背景）
$color-success: hsl(142 76% 36%);     // 成功（绿）
$color-warning: hsl(35 90% 50%);      // 警告（琥珀黄）
$color-info: hsl(217 91% 60%);        // 信息（蓝）

// 圆角 — 禁止硬编码 border-radius
$radius-sm: 0.25rem;    // 4px  标签/徽章
$radius-base: 0.375rem; // 6px  卡片/控件/字段标准圆角（≈ Codex $vp-radius）
$radius-md: 0.5rem;     // 8px  section/面板
$radius-lg: 0.75rem;    // 12px 弹窗/对话框
$radius-full: 9999px;   // 胶囊/药丸形状

// 间距 — 禁止硬编码 padding/gap/margin（注意：使用数字后缀，非 xs/sm/md/lg）
$spacing-2px: 2px; // 超微间距（极窄分隔线间距、图标紧贴）
$spacing-px: 3px; // 微间距（密集 grid gap、极窄 tab padding，小于 $spacing-1 时使用）
$spacing-1: 4px;   // 紧密间距（icon 间距、微型间隙）
$spacing-2: 8px;   // 元素内间距（按钮 padding、小 gap）
$spacing-3: 12px;  // 中等间距（卡片 padding、列表 gap）
$spacing-4: 16px;  // 标准 section 内边距（面板/弹窗 padding）
$spacing-5: 20px;  // 大间距
$spacing-6: 24px;  // 特大间距（header 水平 padding 上限）
// ... $spacing-8 ~ $spacing-16 通常用于布局级间距，UI 组件少用

// 外内原则 — 严格区分 padding（内）与 margin/gap（外）
//   内间距 padding：元素自身内部的留白（按钮内边距、卡片内边距、弹窗 header/body/footer padding）
//   外间距 margin/gap：同级元素之间、框与框之间的分隔间距（section 之间 margin-bottom、grid 列表 gap、header 与内容之间 margin-bottom）
//   禁止混用：不要在元素之间用 padding 撑开间距，也不要在容器内部用 margin 替代 padding

// 字体 — 禁止硬编码 font-size
$font-size-2xs: 0.625rem;  // 10px  仅用于大写标签
$font-size-xs: 0.75rem;   // 12px  小号文字（meta、hint、label）
$font-size-sm: 0.875rem;  // 14px  次要文字
$font-size-base: 1rem;    // 16px  正文、标题（标准字号）
$font-size-lg: 1.125rem;  // 18px  大标题（少用）

// 字重 — 禁止硬编码 font-weight
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// 行高 — 禁止硬编码 line-height
$line-height-tight: 1.25;
$line-height-normal: 1.5;
$line-height-relaxed: 1.75;
```

> **重要**：上述变量名是 `$spacing-1`~`$spacing-4`（数字后缀），**不是** `$spacing-xs`~`$spacing-lg`。`$spacing-xs/sm/md/lg` 是 superPanel 模块的本地别名，**不存在于全局 `_variables.scss` 中**。错误使用会导致 `Undefined variable` 编译错误。

### Codex 增强 Token（`src/_variables.scss` 已全局定义）

以下 Token 自 2026-06-18 起已收归全局 `_variables.scss`，各模块 **直接可用**，无需本地声明：

```scss
$vp-radius: $radius-base; // 6px — Codex 标准圆角
$vp-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace; // 等宽字体栈
```

> 历史：`$vp-radius`/`$vp-mono` 曾由 `superPanel/styles/variables.scss` 独占，其他模块需本地声明。现已全局化。

### 核心规范速查表

| 规则 | 模式 | 关键 CSS |
|------|------|---------|
| **卡片** | 边框优先，禁用阴影 | `border: 1px solid var(--b3-border-color); border-radius: $vp-radius; background: var(--b3-theme-surface);` |
| **卡片 hover** | 边框变色 | `&:hover { border-color: var(--b3-theme-primary); }` |
| **大写标签** | 元信息 key / form label | `font-size: $font-size-2xs; font-weight: $font-weight-bold; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.45;` |
| **等宽字段** | 路径/版本号/日期/密码 | `font-family: $vp-mono; font-size: $font-size-xs;` |
| **focus 发光** | 输入框/控件聚焦 | `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);` |
| **分割线** | section 间 | `border-bottom: 1px solid var(--b3-border-color);` 或 `1px dashed` |
| **空状态** | 居中斜体灰字 | `text-align: center; padding: 32px $spacing-4; font-style: italic; opacity: 0.35;` |
| **按钮** | 主按钮实底 / 次按钮描边 | `&--primary { background: var(--b3-theme-primary); color: #fff; }` / `&--ghost { border: 1px solid; background: transparent; }` |
| **图标按钮** | 固定尺寸，无 padding | `width: 26px; height: 26px; padding: 0; @include flex-center;` icon: `16px`（关闭按钮等） |
| **动画** | 统一 0.12s 过渡 | `transition: all 0.12s;` 或 `transition: border-color 0.12s;` |

### `.vp-*` 组件模式库

参考 `src/features/superPanel/styles/index.scss` 中 Codex 标准实现：

#### 弹窗结构

```scss
// 遮罩
.xxx-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 99999; }
// 对话框（边框 + 圆角，禁用 box-shadow）
.xxx-dialog { width: 700px; max-width: 90vw; max-height: 85vh; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: $radius-lg; display: flex; flex-direction: column; overflow: hidden; }
// 头部（12px/16px padding，标题 ~15px）
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: $spacing-3 $spacing-4; border-bottom: 1px solid var(--b3-border-color); background: var(--b3-theme-surface); }
// 内容
.dialog-body { flex: 1; overflow-y: auto; padding: $spacing-4; }
// 底部
.dialog-footer { padding: $spacing-3 $spacing-4; border-top: 1px solid var(--b3-border-color); background: var(--b3-theme-surface); }
```

#### 输入框（`.vp-input`）

```scss
.vp-input {
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color); border-radius: $vp-radius;
  background: var(--b3-theme-background); color: var(--b3-theme-on-background);
  font-size: 13px; outline: none; transition: border-color 0.12s, box-shadow 0.12s;

  &:focus { border-color: var(--b3-theme-primary); box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest); }
  &--mono { font-family: $vp-mono; }
}
```

#### Input / Select 组件 size 强制规范

> **强制规则**：所有 `<Input>` 和 `<Select>` 共享组件在弹窗/表单场景中**必须显式指定 `size="small"`**。默认 `size="medium"` 的输入框高度（36px）与 Codex 紧凑风格不匹配，会显得过大。
>
> ```html
> <!-- 正确 -->
> <Input v-model="name" size="small" placeholder="名称" />
> <Select v-model="category" size="small" :options="opts" />
>
> <!-- 错误 — 默认 medium，过大 -->
> <Input v-model="name" placeholder="名称" />
> ```
>
> **唯一例外**：全宽搜索栏等刻意需要更大视觉权重的场景可以使用 `medium`。

#### 标签/徽章

```scss
.tag {
  padding: 1px 6px; border-radius: $radius-sm;
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
// 图片计数类 badge（如 "12 张"）用更宽松尺寸：
.image-count {
  padding: 2px 8px; border-radius: $radius-lg;
  font-size: $font-size-xs; font-weight: 500;
}
```

##### Badge 变体（状态胶囊）

```scss
.badge { display: inline-flex; align-items: center; padding: $spacing-1 $spacing-2; border-radius: $radius-full; font-size: $font-size-xs; font-weight: $font-weight-medium; }
.badge--primary { background: var(--b3-theme-primary); color: var(--b3-theme-on-primary); }
.badge--secondary { background: var(--b3-theme-surface); color: var(--b3-theme-on-surface); border: 1px solid var(--b3-border-color); }
.badge--success { background: rgba(22, 163, 74, 0.12); color: var(--b3-theme-success); }
.badge--warning { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.badge--danger { background: rgba(220, 38, 38, 0.12); color: var(--b3-theme-error); }
```

### 禁止事项

| 禁止 | 必须 |
|----------|--------|
| `box-shadow` 作为卡片/弹窗主要样式 | `border: 1px solid var(--b3-border-color)` + hover `border-color` 变色 |
| `border-radius: 6px` / `12px` 等硬编码 | `$vp-radius` / `$radius-base` / `$radius-lg` 等全局 Token |
| `padding: 8px` / `16px` 等硬编码 | `$spacing-2` / `$spacing-4` 等全局 Token（数字后缀！） |
| `font-size: 14px` / `16px` 等硬编码 | `$font-size-sm` / `$font-size-base` 等全局 Token |
| `font-weight: 500` / `600` / `700` 等硬编码 | `$font-weight-medium` / `$font-weight-semibold` / `$font-weight-bold` |
| `line-height: 1.25` / `1.5` 等硬编码 | `$line-height-tight` / `$line-height-normal` / `$line-height-relaxed` |
| `font-family: monospace` / `"Consolas"` | `font-family: $vp-mono`（全局可用） |
| `$spacing-xs` / `$spacing-sm` / `$spacing-md` / `$spacing-lg` | `$spacing-1` / `$spacing-2` / `$spacing-3` / `$spacing-4`（数字后缀是全局标准） |
| emoji 表情作为图标 | `<IconWrapper name="iconName">` |
| 图标按钮用 `padding` 控制尺寸 | 固定 `width: 26px; height: 26px; padding: 0;`，icon `16px` |
| 标题 font-size > 16px | 统一 `$font-size-base`（16px），极少数场景可用 15px（如 superPanel-title） |
| 各模块重复声明 `$vp-radius` / `$vp-mono` | 直接从 `@/variables.scss` 继承（已全局定义） |
| 根容器缺基准字号 / JS 硬编码 `font-size: 12px` | 根容器显式声明 `font-size: $font-size-xs`；自建挂载容器补 `vp-dock-root` / `vp-modal-mask` 类 |

## 强制规则：字号层级与全局基准字号

所有 feature 的 UI 一律采用**两级字号制**，并依赖全局基准字号规则兜底（2026-08 起）。

### 两级字号制

| 字号 | Token | 用途 |
|------|-------|------|
| 10px | `$font-size-2xs` | 辅助文字：标签、提示、描述、状态、命令输出、路径、徽章 |
| 12px | `$font-size-xs` | 标题与正文内容（面板/弹窗统一基准字号） |
| 14px+ | `$font-size-sm` 及以上 | 仅限阅读区正文（如 Markdown 预览）与数据突出展示（如统计数值），必须加注释说明用途 |

### 全局基准字号机制

全局样式入口 `src/index.scss` 已定义（经 `src/index.ts:81` 全局加载）：

```scss
:root {
  --vp-font-size-xs: #{$font-size-xs}; // CSS 变量桥接：供 TS 内联样式引用
}

.vp-dock-root,
.vp-modal-mask {
  font-size: $font-size-xs; // 12px 基准
}
```

- **`vp-dock-root`**：`createVueDockApp` 创建的 Dock 容器、`main.ts` 全局宿主、`floatingBox`、`toolCollection` 等自建挂载容器已自动获得该类
- **`vp-modal-mask`**：`createModalVueApp` 创建的 Modal 遮罩自动获得该类，遮罩内联样式用 `var(--vp-font-size-xs, 12px)` 兜底
- **兜底语义**：全局规则仅对「未显式声明字号」的元素生效（CSS 继承）；已显式声明的元素（即使是硬编码错误值）不会被全局覆盖——因此根容器必须主动声明正确字号

### 审查检查点（新增/修改 SCSS 时逐条核对）

1. **根容器显式声明 `font-size: $font-size-xs`**（gitPush 模式：`.git-push-panel { font-size: $font-size-xs; }`）——即使已挂 `vp-dock-root`，显式声明保证语义清晰、不依赖全局类
2. **禁止硬编码字号**：`font-size: 13px / 14px / 10px` 等一律替换为 Token（`$font-size-xs` / `$font-size-2xs` / `$font-size-sm`）
3. **禁止硬编码字重/行高/字体族**：`font-weight: 600` → `$font-weight-semibold`；`line-height: 1.5` → `$line-height-normal`；`font-family: monospace` → `$vp-mono`
4. **自建挂载点必须补类**：任何 `document.createElement("div")` + `createApp().mount()` 的容器，必须加 `vp-dock-root` 类（遮罩加 `vp-modal-mask`），禁止 JS 内联硬编码 `font-size: 12px`
5. **优先复用挂载工具**：新增弹窗/面板优先使用 `createVueDockApp` / `createModalVueApp`（自动获得全局类），禁止自建容器裸挂

### 参考实现

- `src/features/gitPush/styles/`（两级字号制源头实现）
- `src/index.scss`（全局基准规则 + `--vp-font-size-xs` 变量）
- `src/utils/vueAppHelper.ts`（`vp-dock-root` / `vp-modal-mask` 类的自动挂载点）

## 强制规则：背景与过渡对齐 gitPush 范式（2026-09-02）

**所有功能的背景层级与过渡动效必须对齐 `src/features/gitPush/styles/` 范式**，禁止各功能自创背景方案（如 surface 弹窗内嵌 background 内容的反向层级、backdrop-filter 毛玻璃、回弹缓动等）。

### 规则

1. **背景层级「底—卡」关系**：弹窗/面板根容器底色用 `var(--b3-theme-background)`，卡片用 `var(--b3-theme-surface)` 凸出（gitPush：`.git-push-panel` background + `.gp-card` surface）；卡片内嵌内容区/路径条再回落 `background` 形成三级层次
2. **遮罩统一**：`background: rgba(0, 0, 0, 0.5)`；**禁止 `backdrop-filter`**（blur/saturate 在 Electron 下有滚动性能开销，且偏离全局观感）
3. **过渡统一 0.12s ease**：fade（遮罩/弹窗 opacity）+ 内层 scale 0.98；禁止自定义缓动曲线（ease-out-back/expo）、`translateY` 位移、超时长（0.18s/0.25s 等）
4. **禁止装饰性排版属性**：`letter-spacing` 负值/自定义字距等非 Token 声明
5. **z-index 对齐**：全屏遮罩统一 `z-index: 10000`（子级弹窗可叠加，同 gitPush 先例）
6. **等宽数字场景用 `$vp-mono` + `font-variant-numeric: tabular-nums`**：计数徽章、进度 n/m、文件大小等数值文本（gitPush `.gp-count-badge` 先例）

### 审查检查点（新增/修改弹窗、卡片样式时逐条核对）

1. 弹窗/面板底色是否为 `background`？卡片是否为 `surface`？禁止反向（surface 底 + background 内嵌）
2. 遮罩是否为 `rgba(0, 0, 0, 0.5)`？grep `backdrop-filter` 应零命中
3. 过渡是否为 0.12s？grep `0.18s|0.2s|0.25s|cubic-bezier` 应零命中（旋转动画 spin 1s linear 除外）
4. 图标尺寸是否由 `IconWrapper :size` 控制？SCSS 内不得出现针对图标容器的无效 `font-size`
5. z-index 基准是否为 10000？

### 参考实现

- `src/features/gitPush/styles/index.scss`（`.git-push-panel` 底色 + `.gp-card` 卡片范式）
- `src/features/gitPush/styles/Dialog.scss`（遮罩 + `.gp-dialog` + 0.12s fade/scale 过渡）
- `src/features/gitPush/styles/PanelHeader.scss`（`.gp-count-badge` 等宽计数徽章）

## 强制规则：Dock 面板侧边栏间距（2026-08-07）

**Dock 面板/弹窗内的滚动内容不得紧贴侧边栏或滚动条**，必须在容器根节点预留右侧间距，否则内容视觉上"贴合"侧边栏，观感拥挤。

### 规则

1. **面板根容器（`overflow-y: auto` 的滚动容器）必须设置 `padding-right`**，至少 `$spacing-2`（8px），为滚动条与侧边栏留出呼吸空间
2. **禁止用 `padding: xxx 0` 省略左右**：左右为 0 时内容会直接贴到侧边栏
3. **使用间距 Token，禁止硬编码 px**：`$spacing-2`(8px) / `$spacing-3`(12px)，按面板宽度与观感选择
4. **一处容器覆盖多 Tab 子页面**：若多个 Tab/子页面共用同一根容器（如 `CodeReportPanel` → `.gpr-panel`），在共用容器上统一加右侧间距即可一次覆盖所有页面

### 审查检查点

1. 新增/修改 Dock 面板、弹窗、报告类滚动容器时，检查根容器是否声明 `padding-right`
2. `padding` 简写省略右值时（如 `$spacing-1 0` 等价于右 0），视为可疑点，需显式补右值
3. 滚动条重叠时右侧间距可适当加大（`$spacing-3`），确保内容不被滚动条遮挡

### 参考实现

- `src/features/gitPush/styles/CodeReportPanel.scss`（`.gpr-panel` 基座：`padding: $spacing-1 $spacing-2 $spacing-1 0`）

## 强制规则：SCSS 必须分离到 styles/ 目录

**所有 Vue 文件的 SCSS 样式必须提取到独立的 `.scss` 文件**，放置在对应 feature 的 `styles/` 目录下，使用 `@use` 导入。

### 模式要求

```
src/features/myFeature/
├── components/
│   └── MyComponent.vue       # <style lang="scss" scoped>
│                             #   @use "../styles/MyComponent.scss";   ← 组件专属
│                             #   @use "../styles/index.scss";         ← 共享模态基座
│                             # </style>
├── styles/
│   ├── _mixins.scss          # 共享变量/mixins（_ 前缀 = partial，仅此用途）
│   ├── MyComponent.scss      # 组件专属样式（PascalCase，无 _ 前缀）
│   ├── index.scss            # 主入口 index.vue 的样式 + 共享基座样式
│   └── ...                   # 其他组件对应 OtherComponent.scss
└── index.vue                 # <style lang="scss" scoped>
                              #   @use "./styles/index.scss";
                              # </style>
```

### 规则

1. **禁止在 `.vue` 文件中编写 SCSS 样式代码**。仅允许 `@use` 导入语句。
2. 每个组件对应一个 `styles/<ComponentName>.scss` 文件（PascalCase，无 `_` 前缀）。
3. **`_` 下划线前缀仅限纯 mixins/变量**（如 `_mixins.scss`、`_variables.scss`）。包含实际 CSS 选择器的样式文件**禁止**使用 `_` 前缀。
4. Feature 主入口 `index.vue` 的样式放在 `styles/index.scss`。此文件同时作为**共享基座**（如 `.vp-overlay`、`.vp-modal-header` 等），子组件通过第二行 `@use "../styles/index.scss"` 导入。
5. **子组件导入模式：双行导入**——第一行导入自身专属 SCSS，第二行导入共享的 `index.scss`：
   ```scss
   @use '../styles/MyComponent.scss';   // 组件专属样式
   @use '../styles/index.scss';         // 共享模态基座 + 公共样式
   ```
6. 导入路径使用相对路径（`../styles/` 或 `./styles/`）。
7. `@use` 导入的 SCSS 文件会自动参与 Vue 的 scoped 样式编译。
8. **响应式就近原则**：`@media` 查询放在对应基类所在文件末尾。组件专属选择器的响应式规则放入组件 SCSS，模态基座等公共类的响应式保留在 `index.scss`。

### 示例

**错误（内联 SCSS）**:
```vue
<style lang="scss" scoped>
.my-component {
  color: red;
  .nested { font-size: 12px; }
}
</style>
```

**正确（分离到外部文件）**:
```vue
<style lang="scss" scoped>
@use "../styles/MyComponent.scss";
</style>
```

```scss
// styles/MyComponent.scss
.my-component {
  color: red;
  .nested { font-size: 12px; }
}
```

## 强制规则：内置字体（@font-face）模式

需要"开箱即用"字体（用户系统未安装也能用）时采用此模式：

1. **资源**：字体文件放 `src/features/<feature>/assets/fonts/`，同目录携带许可证（如 SIL OFL 1.1）
2. **构建**：`viteStaticCopy` 复制到 `assets/fonts/`，**必须加 `stripBase`**（见 AGENTS_BUILD.md）
3. **注入**：`init()` 时用 `plugin.assetsPath`（运行时注入属性，siyuan.d.ts 未声明需类型断言）拼接字体 URL 注入 `@font-face`；`assetsPath` 缺失时兜底 `/plugins/${plugin.name}/assets/`
4. **面板**：预设字体条目标记 `builtin: true`；选中时用 `document.fonts.load()` 预加载，避免首次切换延迟
5. **i18n**：提示"已随插件内置"文案走 i18n

参考实现：`src/features/generalSettings/`（`utils/styles.ts` 的 `BUILTIN_FONT` + `injectBuiltinFont()`，`GeneralSettings.ts` 的 `injectBuiltinFonts()`）。
