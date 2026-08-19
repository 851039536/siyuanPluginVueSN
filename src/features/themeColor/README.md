# 全局主题色

覆盖思源笔记 CSS 变量实现全局主题色切换，采用多主题方案架构。

## 已支持主题

| 方案 ID | 名称 | 亮色主色 | 暗色主色 | 说明 |
|---------|------|---------|---------|------|
| `orange` | 暖橙色 | `#d97757` | `#c96442` | 温暖橙色系 |
| `github` | GitHub 蓝 | `#0969da` | `#58a6ff` | GitHub 经典蓝 |
| `sakura` | 樱花动漫 | `#ff91a4` | `#ff6f91` | 樱花粉色调 |
| `codex` | Codex | `#8b5cf6` | `#a78bfa` | Codex 品牌紫 |

## 扩展新主题

在 `index.ts` 的 `THEMES` 对象中添加条目即可（键名即为方案 ID）：

```ts
export const THEMES = {
  // ... 已有主题
  newTheme: {
    name: "新主题",
    primary: "#xxxxxx",
    // 可选：暗色模式主色，缺省时复用 primary
    darkPrimary: "#yyyyyy",
  },
} as const satisfies Record<string, ThemeColorScheme>
```

`primary` 的 hex 值会自动推导为 `"R, G, B"` 格式，无需手动维护 RGB 值。
`darkPrimary` 为可选暗色模式主色，未配置时自动复用 `primary`；模块会自动监听思源亮/暗模式切换并重新应用。

> 无需修改任何其他文件，`PluginSettings.themeColorScheme` 自动关联。

## 配置项

- `enableThemeColor` — 启用/禁用主题色覆盖（超级面板开关）
- `themeColorScheme` — 主题方案 ID（`ThemeColorSchemeId`，内置主题 + `"custom"`）
- `customThemeColor` — 自定义主题色（当 `themeColorScheme = "custom"` 时使用）

## 扩展建议

以下方向可供未来迭代参考：

1. **用户自定义主题**：已支持，在超级面板选择 `自定义` 后可通过颜色选择器设置 `customThemeColor`
2. **主题过渡动画**：切换主题时为 `--b3-theme-primary` 添加 CSS `transition`，实现平滑过渡
3. **更多 CSS 变量覆盖**：已内置 `--b3-theme-primary-light` / `--b3-theme-primary-lightest` / `--b3-theme-on-primary` 的自动推导，后续可继续细化为按暗色/亮色主题分别定义
4. **主题色预览增强**：superPanel 下拉选项中增加内联色块，直观展示每个主题的实际效果
