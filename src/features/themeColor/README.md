# 全局主题色

覆盖思源笔记 CSS 变量实现全局主题色切换，采用多主题方案架构。

## 已支持主题

| 方案 ID | 名称 | 主色 | 预览 |
|---------|------|------|------|
| `orange` | 暖橙色 | `#d97757` | 温暖橙色系 |
| `github` | GitHub 蓝 | `#0969da` | GitHub 经典蓝 |

## 扩展新主题

在 `index.ts` 的 `THEMES` 对象中添加条目即可：

```ts
export const THEMES: Record<string, ThemeColorScheme> = {
  // ... 已有主题
  newTheme: {
    id: "newTheme",
    name: "新主题",
    primary: "#xxxxxx",
    primaryRgb: "R, G, B",
  },
}
```

无需修改任何其他文件，`PluginSettings.themeColorScheme` 自动关联。

## 配置项

- `enableThemeColor` — 启用/禁用主题色覆盖（超级面板开关）
- `themeColorScheme` — 主题方案 ID（`"orange"` / `"github"`）
