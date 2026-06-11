# 全局主题色

覆盖思源笔记 CSS 变量实现全局主题色切换，采用多主题方案架构。

## 已支持主题

| 方案 ID | 名称 | 主色 | 说明 |
|---------|------|------|------|
| `orange` | 暖橙色 | `#d97757` | 温暖橙色系 |
| `github` | GitHub 蓝 | `#0969da` | GitHub 经典蓝 |
| `sakura` | 樱花动漫 | `#ff91a4` | 樱花粉色调 |
| `codex` | Codex | `#8B5CF6` | Codex 品牌紫 |

## 扩展新主题

在 `index.ts` 的 `THEMES` 对象中添加条目即可（键名即为方案 ID）：

```ts
export const THEMES: Record<string, ThemeColorScheme> = {
  // ... 已有主题
  newTheme: {
    name: "新主题",
    primary: "#xxxxxx",
  },
}
```

`primary` 的 hex 值会自动推导为 `"R, G, B"` 格式，无需手动维护 RGB 值。

> 无需修改任何其他文件，`PluginSettings.themeColorScheme` 自动关联。

## 配置项

- `enableThemeColor` — 启用/禁用主题色覆盖（超级面板开关）
- `themeColorScheme` — 主题方案 ID（`"orange"` / `"github"` / `"sakura"` / `"codex"`）

## 扩展建议

以下方向可供未来迭代参考：

1. **用户自定义主题**：在 superPanel 中增加色值输入框，允许用户覆盖或新增自定义主题色
2. **主题过渡动画**：切换主题时为 `--b3-theme-primary` 添加 CSS `transition`，实现平滑过渡
3. **更多 CSS 变量覆盖**：除主色外，可扩展覆盖 `--b3-theme-primary-light` / `--b3-theme-primary-lightest`（基于主色按透明度叠加生成），增强整体一致性
4. **主题色预览增强**：superPanel 下拉选项中增加内联色块，直观展示每个主题的实际效果
