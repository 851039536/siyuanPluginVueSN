# 全局主题色

应用暖橙色全局主题色，将思源笔记的主题色（`--b3-theme-primary`）覆盖为 `#d97757`（暖橙色）。

## 使用方式

1. 在超级面板中启用「主题色」开关
2. 主题色会立即应用到全局

## 实现原理

通过 `document.documentElement.style.setProperty` 覆盖思源笔记的 CSS 变量：
- `--b3-theme-primary: #d97757`
- `--b3-theme-primary-rgb: 217, 119, 87`

禁用时会移除这些 CSS 变量覆盖，恢复思源默认主题色。
