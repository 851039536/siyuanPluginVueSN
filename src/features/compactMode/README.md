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

## 配置项

- `compactMode` — 启用/禁用紧凑模式
- `compactModeDensity` — 密度级别（`moderate` | `compact` | `extreme`）
- `compactModeFontScale` — 字号缩放（`100` | `98` | `96` | `94` | `92` | `90`）
- `compactModeAreas` — 生效区域开关映射

## 扩展建议

1. **更多密度档位**：在 `ALL_DENSITIES` 中添加新档位并在 SCSS 中定义对应样式
2. **更多生效区域**：在 `ALL_AREAS` 中添加新区域，需同步修改 SCSS 中的区域选择器
3. **字号更细粒度**：在 `ALL_FONT_SCALES` 中扩展更多缩放级别
