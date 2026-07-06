---
name: add-xsmall-size-to-components
overview: 为所有公共组件的 Size 类型新增 "xsmall"（特小号）选项，包括 TypeScript 类型定义和 SCSS 样式。
todos:
  - id: add-xsmall-core-components
    content: 为 Button/Input/Select/Switch 4 个核心表单组件添加 xsmall 尺寸（类型 + SCSS）
    status: completed
  - id: add-xsmall-display-components
    content: 为 FormField/Badge/Label/Tag/Slider/Chart/Card 7 个展示组件添加 xsmall 尺寸（类型 + SCSS）
    status: completed
  - id: clean-s3backup-hacks
    content: 删除 s3Backup 的 :deep() hack 覆盖样式，将紧凑组件改用 size="xsmall"
    status: completed
    dependencies:
      - add-xsmall-core-components
      - add-xsmall-display-components
  - id: verify-lint
    content: 验证 ESLint + tsc 无错误
    status: completed
    dependencies:
      - clean-s3backup-hacks
---

## 产品概述

为 `src/components/` 公共组件库增加"xsmall"（特小号）尺寸选项，使其能够原生支持更紧凑的 UI 场景（如 s3Backup 面板中的内联按钮和短输入框），替代当前使用的 `:deep()` + `!important` CSS 覆盖 hack。

## 核心功能

- 11 个公共组件新增 "xsmall" 尺寸（Button、Input、Select、Switch、FormField、Badge、Label、Tag、Slider、Chart、Card），Avatar 已有 xsmall 跳过
- xsmall 目标值比当前 small 更紧凑：Button padding 2px 6px / min-height 22px，Input field padding 2px 6px / min-height 22px，Select trigger padding 2px 6px / min-height 22px，Switch track 28x14px / thumb 10x10px
- 删除 s3Backup 中为补偿尺寸不足而添加的 `:deep()` `!important` 覆盖样式
- s3Backup 中原本依赖覆盖的组件改用 `size="xsmall"`

## 实现方案

### 改动范围

**11 个公共组件** — 每个修改两处：`.vue` 文件的 Size 类型定义 + `.scss` 文件的尺寸样式：

| 组件 | .vue 类型改动 | .scss 文件 | xsmall 样式内容 |
| --- | --- | --- | --- |
| Button | `"xsmall" \ | "small" \ | "medium" \ | "large"` | `styles/Button.scss` | padding 2px 6px, font-size $font-size-xs, min-height 22px |
| Input | 同上 | `styles/Input.scss` | field padding 2px 6px, font-size $font-size-xs, min-height 22px |
| Select | 同上 | `styles/Select.scss` | trigger padding 2px 6px, font-size $font-size-xs, min-height 22px |
| Switch | 同上 | `styles/Switch.scss` | track 28x14px, thumb 10x10px, loading 10x10px, checked translate 12px |
| FormField | 同上 | `styles/FormField.scss` | label font-size $font-size-xxs 或 10px |
| Badge | 同上 | `styles/Badge.scss` | content height 12px, font-size 10px, padding 0 3px |
| Label | 同上 | `styles/Label.scss` | font-size $font-size-xxs 或 10px |
| Tag | 同上 | `styles/Tag.scss` | font-size $font-size-xxs, padding 1px 4px |
| Slider | 同上 | `styles/Slider.scss` | field height 3px, thumb 10x10px, value font-size $font-size-xxs |
| Chart | `"xsmall" \ | "small" \ | "medium" \ | "large" \ | "full"` | `styles/Chart.scss` | width 120px, height 90px |
| Card | 同上 | `styles/Card.scss` | header padding $spacing-1 $spacing-2, title $font-size-xs, body padding $spacing-2 |


### xsmall 设计值

所有数值比 small 再缩小一档（约 60-75%），参考 s3Backup hack 覆盖的实际效果：

- Button: padding `2px 6px`, min-height `22px`
- Input field: padding `2px 6px`, min-height `22px`
- Select trigger: padding `2px 6px`, min-height `22px`
- Switch track: `28px x 14px`，thumb: `10px x 10px`，loading: `10px x 10px`，checked translateX `12px`
- Badge: height `12px`, padding `0 3px`, font-size `$font-size-xxs`
- Label: font-size `$font-size-xxs`
- Tag: font-size `$font-size-xxs`, padding `1px 4px`
- FormField label: font-size `$font-size-xxs`
- Slider: field height `3px`, thumb `10px x 10px`, value font-size `$font-size-xxs`, min-width `24px`
- Chart: `120px x 90px`
- Card: header padding `$spacing-1 $spacing-2`, title font-size `$font-size-xs`, body padding `$spacing-2`

### 清理 s3Backup hack

- 删除 `styles/index.scss` 中 189-208 行的 `:deep()` 覆盖块
- s3Backup 中的紧凑组件（如"选择路径"、"打开"按钮、刷新按钮等）改为 `size="xsmall"`

### 注意事项

- Button 的 `--icon-only` 中已有 `--button-size` 自定义属性，xsmall 需额外补充 `&.si-button--xsmall { --button-size: 22px; }`
- Switch 需要同时定义 xsmall 对应的 `track`、`thumb`、`loading`、`checked` 四组样式
- 确认 `$font-size-xxs` 是否存在，如不存在则使用 `10px` 硬编码加注释