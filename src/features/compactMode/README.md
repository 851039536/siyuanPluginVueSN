# 紧凑模式

全局紧凑样式功能，通过 CSS 类体系控制思源笔记界面的间距密度、字号缩放和生效区域。

## 工作原理

在 `<html>` 元素上动态添加/移除 CSS 类，配合 SCSS 编译期乘法计算样式值，无运行时 `calc()`/`var()` 依赖。

### CSS 类体系

| 类名 | 说明 |
|------|------|
| `siyuan-compact-mode` | 主开关类 |
| `compact-density-moderate` / `compact` / `extreme` | 密度级别（3 档，互斥） |
| `compact-font-100` / `98` / `96` / `94` / `92` / `90` | 字号缩放（6 档，互斥） |
| `compact-area-sidebar` / `editor` / `tabs` / `dialogs` / `controls` | 生效区域（5 区域，可多选） |

档位与区域清单以 `index.ts` 导出的 `ALL_DENSITIES` / `ALL_FONT_SCALES` / `ALL_AREAS` 为单一来源，设置面板的选项表与初始值均由这些常量派生，新增档位只需改一处常量加对应 SCSS 规则。

## 目录结构

```
compactMode/
├── index.ts                      # 档位常量 + applyCompactMode（切换 html 类名）
├── components/
│   └── CompactModeSettings.vue   # 「常用设置 → 紧凑模式」设置面板
├── styles/
│   ├── index.scss                # 全局 CSS 类体系（由 index.ts 内 import 引入，随插件加载全局生效）
│   └── CompactModeSettings.scss  # 设置面板专属样式
└── README.md
```

`styles/index.scss` 不走全局入口 `src/index.scss` 的 `@use`，而是由 `index.ts` 顶部的 `import "./styles/index.scss"` 引入；`applyCompactMode()` 由插件启动链路（`main.ts` 挂载前、`src/index.ts` 配置加载后）调用。

## 配置项

- `compactMode` — 启用/禁用紧凑模式
- `compactModeDensity` — 密度级别（`moderate` | `compact` | `extreme`）
- `compactModeFontScale` — 字号缩放（`100` | `98` | `96` | `94` | `92` | `90`）
- `compactModeAreas` — 生效区域开关映射（`sidebar` / `editor` / `tabs` / `dialogs` / `controls`）

## 扩展建议

1. **更多密度档位**：在 `ALL_DENSITIES` 中添加档位，并在 `styles/index.scss` 的 `$density-spacings` 中补充对应缩放系数
2. **更多生效区域**：在 `ALL_AREAS` 中添加区域，需同步 `styles/index.scss` 的区域选择器，并在 `src/i18n/{zh_CN,en_US}/common.json` 补充 `compactArea*` 文案
3. **字号更细粒度**：在 `ALL_FONT_SCALES` 中扩展档位，需同步 `$font-scales`、`src/config/settings.ts` 的默认值与设置面板
