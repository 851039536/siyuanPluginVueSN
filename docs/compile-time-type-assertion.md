# TypeScript 编译时类型断言：配置与注册表双向校验

## 解决的问题

在中大型项目中，常有一个**配置中心**（如功能列表、路由表、菜单配置）和多个**消费者**（如注册函数、渲染函数）。两者需要保持同步，但开发者很容易：

- 新增配置后忘记添加对应的注册/导出
- 删除配置后忘记移除对应的注册/导出
- 拼写错误导致 ID 不匹配

本方案利用 TypeScript 的**类型系统**在编译期自动检测这些不一致，实现零运行时开销的安全校验。

---

## 核心原理

```typescript
// 唯一的断言工具：约束 T 必须为 true
interface _AssertTrue<T extends true> {}
```

利用 TypeScript 条件类型：

| 表达式 | 含义 |
|---|---|
| `A extends B ? true : false` | A 的每个成员都在 B 中 → `true`，否则 → `false` |
| `A extends never ? true : false` | A 为空类型 → `true`，A 有成员 → `false` |

当约束 `T extends true` 接收到 `false` 时，TypeScript 会产生编译错误，**但不产生任何运行时代码**。

---

## 完整模板

### 1. 配置中心 `config.ts`

```typescript
// 功能配置表 - 单一数据源
export const FEATURE_CONFIG = [
  {
    id: "pageLock",
    defaultTitle: "页面锁定",
    defaultDesc: "锁定页面防止误编辑",
  },
  {
    id: "imageCompressor",
    defaultTitle: "图片压缩",
    defaultDesc: "批量压缩文档中的图片",
  },
  {
    id: "statistics",
    defaultTitle: "数据统计",
    defaultDesc: "显示笔记数据统计和分析",
  },
  {
    id: "qrCode",
    defaultTitle: "二维码生成",
    defaultDesc: "生成文本或链接的二维码",
  },
  // ... 更多功能
] as const

// 自动推导联合类型: "pageLock" | "imageCompressor" | "statistics" | "qrCode"
export type FeatureId = (typeof FEATURE_CONFIG)[number]["id"]
```

> 关键：使用 `as const` 让 TypeScript 将数组元素推导为字面量类型，从而自动生成精确的联合类型。

### 2. 注册表 `index.ts`

```typescript
import type { FeatureId } from "./config"

export { registerImageCompressor } from "./imageCompressor"
// ========== 导出注册函数 ==========
export { registerPageLock } from "./pageLock"
export { registerStatistics } from "./statistics"
// qrCode 仅用于 UI 展示，不需要 register

// ========== 编译时校验 ==========

// 白名单：在 FEATURE_CONFIG 中存在、但不需要 register 的功能
type _ConfigOnly = "qrCode"

// 所有需要 register 的功能 ID（必须与上方 export 一一对应）
type _Registered = "pageLock" | "imageCompressor" | "statistics"

// 断言工具
interface _AssertTrue<T extends true> {}

// ① 正向校验：_Registered 中的每个 ID 都必须是有效的 FeatureId
//    触发条件：config.ts 删除了某功能，但 index.ts 未同步移除
type _AssertRegisteredInConfig = _AssertTrue<
  _Registered extends FeatureId ? true : false
>

// ② 反向校验：每个需要 register 的 FeatureId 都在 _Registered 中
//    触发条件：config.ts 新增了功能，但 index.ts 未同步添加
type _AssertAllCovered = _AssertTrue<
  Exclude<FeatureId, _ConfigOnly> extends _Registered ? true : false
>
```

---

## 错误场景示例

### 场景 1：config.ts 新增了功能，忘记在 index.ts 添加

```typescript
// config.ts 中新增:
{
  id: "encryption",
  defaultTitle: "内容加密",
  defaultDesc: "对选中文本进行加密和解密",
}

// index.ts 的 _Registered 中忘记添加 "encryption"
```

**报错**：`类型 "false" 不满足约束 "true"`，定位到 `_AssertAllCovered` 行。

**修复**：在 `_Registered` 中添加 `"encryption"`，并在文件顶部添加 `export { registerEncryption } from "./encryption"`。

### 场景 2：config.ts 删除了功能，忘记在 index.ts 移除

```typescript
// config.ts 中删除了 "statistics"
// index.ts 的 _Registered 中仍有 "statistics"
```

**报错**：`类型 "false" 不满足约束 "true"`，定位到 `_AssertRegisteredInConfig` 行。

**修复**：从 `_Registered` 中移除 `"statistics"`，并删除对应的 `export` 行。

### 场景 3：新增了仅展示功能，忘记加入白名单

```typescript
// config.ts 中新增:
{
  id: "heatmapMarker",
  defaultTitle: "热力图标记",
  defaultDesc: "标记文档中的英文词汇",
}
// heatmapMarker 是子功能，不需要独立 register
// 但 _ConfigOnly 中忘记添加 "heatmapMarker"
```

**报错**：`类型 "false" 不满足约束 "true"`，定位到 `_AssertAllCovered` 行。

**修复**：在 `_ConfigOnly` 中添加 `"heatmapMarker"`。

### 场景 4：拼写错误

```typescript
// config.ts 中是 "superPanel"
// _Registered 中写成了 "superpannel"（多了 n）
```

**报错**：两行断言都会报错。

---

## 工作流程速查

```
┌──────────────────────────────────────────────────────────┐
│                    FEATURE_CONFIG (config.ts)             │
│  as const → 自动推导 FeatureId 联合类型                    │
└──────────────┬──────────────────────────┬────────────────┘
               │                          │
               ▼                          ▼
     _Registered extends         Exclude<FeatureId, _ConfigOnly>
     FeatureId ? true            extends _Registered ? true
               │                          │
               ▼                          ▼
        ① 正向校验                  ② 反向校验
     (Registered ⊆ Config)       (Config - Only ⊆ Registered)
               │                          │
               ▼                          ▼
     ┌─────────────────────────────────────────────┐
     │        任何一个为 false → 编译报错            │
     │  类型 "false" 不满足约束 "true"              │
     └─────────────────────────────────────────────┘
```

| 操作 | ① 正向校验 | ② 反向校验 |
|---|---|---|
| config 新增功能 + index 同步添加 | ✅ | ✅ |
| config 新增功能 + index 忘记添加 | ✅ | ❌ 报错 |
| config 删除功能 + index 同步移除 | ✅ | ✅ |
| config 删除功能 + index 忘记移除 | ❌ 报错 | ✅ |
| config 新增仅展示功能 + 白名单同步 | ✅ | ✅ |
| config 新增仅展示功能 + 白名单未加 | ✅ | ❌ 报错 |

---

## 通用化版本

此模式可推广到任何需要**配置表与消费者保持同步**的场景：

### 适用于

- **路由表** — `ROUTES` 配置与路由守卫/权限校验
- **菜单配置** — `MENU_CONFIG` 与菜单渲染/权限映射
- **API 端点** — `ENDPOINTS` 与请求封装/错误处理
- **组件注册** — `COMPONENT_REGISTRY` 与组件映射表
- **状态机** — `STATES` 与状态转换/处理函数

### 最小模板

```typescript
// ===== config.ts =====
// "a" | "b" | "c"

// ===== handler.ts =====
import type { ItemId } from "./config"  export const ITEMS = [
  { id: "a", label: "功能A" },
  { id: "b", label: "功能B" },
  { id: "c", label: "功能C" },
] as const

export type ItemId = (typeof ITEMS)[number]["id"]

// 不需要处理函数的 ID（如纯展示项）
type ConfigOnly = "c"

// 已实现处理的 ID
type Implemented = "a" | "b"

interface _AssertTrue<T extends true> {}

// 已实现的 ID 必须存在于配置中
type _1 = _AssertTrue<Implemented extends ItemId ? true : false>
// 除白名单外，所有配置项都必须有实现
type _2 = _AssertTrue<Exclude<ItemId, ConfigOnly> extends Implemented ? true : false>
```

---

## 常见问题

### Q: 为什么不用 `eslint` 规则？

ESLint 无法做这种跨文件的类型集合比对。它能检测未使用的变量、未使用的导入等，但无法保证"两个类型集合相等"。

### Q: 为什么不用运行时检查？

运行时检查（如 `console.error`）只能在执行时发现问题，且需要额外的测试覆盖。编译时断言在 `tsc` / `vue-tsc` 阶段就能拦截，不需要运行任何代码。

### Q: `_AssertTrue` 会不会产生运行时代码？

不会。`interface` 是纯类型声明，不生成任何 JavaScript 代码。

### Q: `as const` 忘记写了会怎样？

如果不写 `as const`，TypeScript 会将数组推导为 `string[]`，`FeatureId` 变为 `string`，断言永远为 `true`，失去校验作用。
