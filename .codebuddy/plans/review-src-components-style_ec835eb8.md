---
name: review-src-components-style
overview: 按照 CLAUDE_RULES.md 样式规范审查 src/components 目录下 14 个 Vue 组件的样式合规性，输出详细审查报告。
todos:
  - id: create-styles-dir
    content: 创建 src/components/styles/ 目录结构，新建 _mixins.scss 和 index.scss 共享基座文件
    status: completed
  - id: extract-avatar-badge-tag
    content: 提取 Avatar、Badge、Tag 三个组件的内联 SCSS 至独立文件，替换硬编码为全局 Token，消除 box-shadow
    status: completed
    dependencies:
      - create-styles-dir
  - id: extract-button-card
    content: 提取 Button、Card 内联 SCSS 至独立文件，替换硬编码为全局 Token，搬迁 button local mixin 至 _mixins.scss，消除 Card 的 box-shadow
    status: completed
    dependencies:
      - create-styles-dir
  - id: extract-input-select
    content: 提取 Input、Select 内联 SCSS 至独立文件，替换硬编码为全局 Token，消除 focus box-shadow 违规
    status: completed
    dependencies:
      - create-styles-dir
  - id: extract-formfield-label-switch
    content: 提取 FormField、Label、Switch 内联 SCSS 至独立文件，替换硬编码为全局 Token
    status: completed
    dependencies:
      - create-styles-dir
  - id: extract-chart-slider
    content: 提取 Chart、Slider 内联 SCSS 至独立文件，替换硬编码为全局 Token，Slider thumb box-shadow 评估保留加注释
    status: completed
    dependencies:
      - create-styles-dir
  - id: fix-loader-iconwrapper
    content: 修复 Loader、IconWrapper：CSS 转 SCSS，添加 @use 导入，提取至独立文件
    status: completed
    dependencies:
      - create-styles-dir
  - id: verify-build
    content: 执行 pnpm build 和 pnpm lint 构建验证，确保所有改动通过编译和代码检查
    status: completed
    dependencies:
      - extract-avatar-badge-tag
      - extract-button-card
      - extract-input-select
      - extract-formfield-label-switch
      - extract-chart-slider
      - fix-loader-iconwrapper
---

## 审查范围

对 `src/components/` 目录下 14 个共享 Vue 组件进行全面样式合规审查，确保所有组件符合 CLAUDE_RULES.md 定义的 Codex 风格规范。

## 发现问题汇总

### P0 致命违规（影响全部 14 个组件）

- **SCSS 内联**：14 个组件 100% 将 SCSS 写在 Vue SFC `<style>` 块中，违反「SCSS 必须分离到独立 styles/ 目录」强制规则。Vue 文件中仅允许 `@use` 导入语句。

### P1 硬编码泛滥（涉及 13 个组件，IconWrapper 除外）

- **font-size 硬编码**：`10px`/`11px`/`13px`/`15px` 等无对应 Token 的小字号大量出现，应先评估是否需要新增 Token 或改用 `$font-size-xs`(12px)/`$font-size-sm`(14px)
- **font-weight 硬编码**：`500`/`600`/`700` 广泛出现，应改用 `$font-weight-medium`/`$font-weight-semibold`/`$font-weight-bold`
- **line-height 硬编码**：`1`/`1.4`/`1.5`/`1.6` 多处出现，应改用 `$line-height-tight`(1.25)/`$line-height-normal`(1.5)
- **padding/gap/dimension 硬编码**：`6px`/`10px`/`14px`/`18px`/`2px` 等大量出现，应改用 `$spacing-*` 系列 Token
- **opacity 硬编码**：`0.5`/`0.6`/`0.7`/`0.8`/`0.9` 散布各处，应考虑定义语义化变量
- **z-index 硬编码**：`10`/`1000` 魔法数字

### P2 box-shadow 违规（涉及 7 个组件）

- Avatar 的 `&--active` 使用 `box-shadow: 0 0 0 2px`
- Badge 的 `&__content` 使用 `box-shadow: 0 0 0 1px`
- Card 的 `&--active` 使用 `box-shadow: 0 0 0 1px`
- Input 的 `&__wrapper:focus-within` 使用 `box-shadow: 0 0 0 3px`
- Select 的 `&__trigger:focus-visible` 使用 `box-shadow: 0 0 0 3px`
- Slider thumb 使用 `box-shadow: 0 2px 4px` 等
- Switch track 使用 `box-shadow: inset 0 1px 2px`

### P3 缺失 @use 导入（涉及 2 个组件）

- **Loader.vue**：纯 CSS（非 SCSS），无 `@use` 语句，无设计 Token 引用
- **IconWrapper.vue**：仅 `scoped` 属性普通 CSS，无 `@use '@/variables.scss'`

## 目标输出

- 新建 `src/components/styles/` 目录，含 14 个组件专属 SCSS 文件 + 1 个共享 `index.scss`
- 每个原 Vue 文件的 `<style>` 块替换为单行或双行 `@use` 导入
- 所有硬编码值替换为 `src/_variables.scss` 中的全局设计 Token
- 消除所有 box-shadow 违规，改为 border-color 变色策略
- 构建验证通过（`pnpm build` 无报错）

## 技术方案

### 目录结构变更

```
src/components/
├── Avatar.vue                    # [MODIFY] <style> 块改为 @use './styles/Avatar.scss';
├── Badge.vue                     # [MODIFY] <style> 块改为 @use './styles/Badge.scss';
├── Button.vue                    # [MODIFY] <style> 块改为 @use './styles/Button.scss';
├── Card.vue                      # [MODIFY] <style> 块改为 @use './styles/Card.scss';
├── Chart.vue                     # [MODIFY] <style> 块改为 @use './styles/Chart.scss';
├── FormField.vue                 # [MODIFY] <style> 块改为 @use './styles/FormField.scss';
├── IconWrapper.vue               # [MODIFY] <style> 块改为 @use './styles/IconWrapper.scss';
├── Input.vue                     # [MODIFY] <style> 块改为双行导入
├── Label.vue                     # [MODIFY] <style> 块改为 @use './styles/Label.scss';
├── Loader.vue                    # [MODIFY] <style> 块改为 @use './styles/Loader.scss';
├── Select.vue                    # [MODIFY] <style> 块改为双行导入
├── Slider.vue                    # [MODIFY] <style> 块改为 @use './styles/Slider.scss';
├── Switch.vue                    # [MODIFY] <style> 块改为 @use './styles/Switch.scss';
├── Tag.vue                       # [MODIFY] <style> 块改为 @use './styles/Tag.scss';
└── styles/                       # [NEW] 目录
    ├── _mixins.scss              # [NEW] 共享 mixins（opacity 阶梯、组件通用交互等）
    ├── index.scss                # [NEW] 共享基座样式（如全局 box-shadow 替换模式、公共动画 keyframes）
    ├── Avatar.scss               # [NEW] 提取 Avatar.vue 内联 SCSS + Token 替换
    ├── Badge.scss                # [NEW] 提取 Badge.vue 内联 SCSS + Token 替换
    ├── Button.scss               # [NEW] 提取 Button.vue 内联 SCSS + Token 替换 + 搬迁 local mixin
    ├── Card.scss                 # [NEW] 提取 Card.vue 内联 SCSS + Token 替换
    ├── Chart.scss                # [NEW] 提取 Chart.vue 内联 SCSS + Token 替换
    ├── FormField.scss            # [NEW] 提取 FormField.vue 内联 SCSS + Token 替换
    ├── IconWrapper.scss          # [NEW] 提取 IconWrapper.vue 内联 CSS → SCSS + Token 替换
    ├── Input.scss                # [NEW] 提取 Input.vue 内联 SCSS + Token 替换
    ├── Label.scss                # [NEW] 提取 Label.vue 内联 SCSS + Token 替换
    ├── Loader.scss               # [NEW] 提取 Loader.vue 内联 CSS → SCSS + Token 替换
    ├── Select.scss               # [NEW] 提取 Select.vue 内联 SCSS + Token 替换
    ├── Slider.scss               # [NEW] 提取 Slider.vue 内联 SCSS + Token 替换
    ├── Switch.scss               # [NEW] 提取 Switch.vue 内联 SCSS + Token 替换
    └── Tag.scss                  # [NEW] 提取 Tag.vue 内联 SCSS + Token 替换
```

### 硬编码替换策略

| 类别 | 原始值 | 替换为 | 影响组件 |
| --- | --- | --- | --- |
| font-size | `10px` | `$font-size-xs`（12px，最接近的小字号；10px 仅在 uppercase label 场景可保留，但需注释说明） | Badge, Tag, Label |
| font-size | `11px` | `$font-size-xs`（12px，评估后统一为最接近规范值） | Badge |
| font-size | `13px` | 在 `_variables.scss` 全局层暂不新增，评估是否使用 `$font-size-sm`(14px) 或 `$font-size-xs`(12px) 替代 | Input, Select |
| font-size | `15px` | `$font-size-base`（16px，统一标号层级） | Button, Input, Select, Slider |
| font-weight | `500` | `$font-weight-medium` | Avatar, Badge, Button, FormField, Label, Tag, Switch |
| font-weight | `600` | `$font-weight-semibold` | Card, Select |
| font-weight | `700` | `$font-weight-bold` | — |
| line-height | `1` | `$line-height-tight`（1.25，评估后选用最接近值） | Avatar, Badge |
| line-height | `1.4` | `$line-height-tight`（1.25，评估布局影响后选用） | Card, Button |
| line-height | `1.5` | `$line-height-normal` | Label, Switch, Tag |
| line-height | `1.6` | `$line-height-relaxed`（1.75，评估最接近值） | Input |
| gap | `6px` | 在 `_mixins.scss` 定义本地 `$gap-xs: 6px`（gap 无 6px Token，$spacing-2=8px 偏大） | Label, Tag, Badge |
| padding | `10px` | `$spacing-2`（8px）+ `$spacing-1`（4px）组合 或 新增 `$spacing-2\.5: 10px` 本地 Token | Card, Label, Tag |
| padding | `14px` | `$spacing-3`（12px）评估误差 + `$spacing-1`（4px）组合 | Card |
| padding | `18px` | `$spacing-4`（16px）+ `$spacing-1`（4px）组合 | Card |
| opacity | `0.5/0.6/0.7/0.8/0.9` | 在 `_mixins.scss` 定义 `$opacity-disabled: 0.5`、`$opacity-muted: 0.6` 等语义变量 | Button, Card, Input, Switch, Tag |
| z-index | `10` | 定义 `$z-dropdown: 10` 在 `_mixins.scss` | Avatar, Chart, Badge |
| z-index | `1000` | 定义 `$z-select-dropdown: 1000` 在 `_mixins.scss` | Select |


### box-shadow 消除策略

| 组件 | 原 box-shadow | 替换方案 |
| --- | --- | --- |
| Avatar `--active` | `0 0 0 2px var(--b3-theme-primary)` | `outline: 2px solid var(--b3-theme-primary); outline-offset: 0;` |
| Badge `__content`（非 dot） | `0 0 0 1px var(--b3-theme-background)` | `border: 1px solid var(--b3-theme-background)` |
| Card `--active` | `0 0 0 1px var(--b3-theme-primary)` | 改为 `border-color: var(--b3-theme-primary)` + 增加 `border-width: 2px`（Codex 焦点反馈模式） |
| Input `__wrapper:focus-within` | `0 0 0 3px rgba(...)` | 改为 `border-color: var(--b3-theme-primary)` — 边框优先策略 |
| Select `__trigger:focus-visible` | `0 0 0 3px rgba(...)` | 同上 → `border-color: var(--b3-theme-primary)` |
| Slider thumb | `0 2px 4px / 0 4px 8px`（thumb 拖拽手柄，可保留为设计需要，加注释说明例外原因） | 评估保留并加注释，因为 range input thumb 需要视觉层级 |
| Switch track | `inset 0 1px 2px rgba(0,0,0,0.1)`（内凹效果，可保留） | 同上 |
| Slider/Button components 局部 box-shadow | 同上原则评估 | — |


### 导入模式

按照 CLAUDE_RULES.md 规定：

- **单行导入**（无子组件的独立组件）：`@use './styles/ComponentName.scss';`
- **双行导入**（使用 FormField 的复合组件如 Input/Select）：第一行组件专属 + 第二行共享 `index.scss`
- **共享基座** `styles/index.scss`：集中放置 Extract 到多个组件的公共 keyframes（如 `spin`），以及 `box-shadow` 替换为 `border-color` 的策略性 mixin

### 构建验证

完成后执行：

```
pnpm build     # 生产构建，确保 SCSS 编译无报错
pnpm lint      # ESLint 检查代码规范
```