---
name: doc-count-settings-refactor
overview: 重构 DocCountSettings.vue 及其联动：为字体/颜色/透明度等连续输入加防抖、统一 change 事件语义消除死代码链路、简化 gsStorage 冗余封装。
todos:
  - id: refactor-doccount-settings
    content: 重构 DocCountSettings.vue：加 150ms 防抖与 onUnmounted 清理、persistAndApply 改 emit 驱动、移除 getGeneralSettings、gsStorage 改 const 统一判空
    status: completed
  - id: wire-doccount-branch
    content: 在 GeneralSettings.ts 的 handleSettingsChange 新增 docCount 分支调用 updateDocCount，接通事件消费链
    status: completed
    dependencies:
      - refactor-doccount-settings
---

## 用户需求

针对 `src/features/generalSettings/components/DocCountSettings.vue` 上一轮审查发现的问题实施修复，具体包括：

1. **连续输入无防抖（逻辑漏洞，最高优先级）**：透明度滑块 `SettingSlider` 与颜色输入 `ColorField` 的 `@input` 连续触发 `handleFontStyleChange`，每次拖动/逐字符键入都会执行 `docCount.save()` 写存储 + `updateDocCount()` 全量重绘 + `showMessage()` 刷屏。
2. **change 事件链路死代码**：仅 `handleToggleChange` 单独 `emit("change")`，其余 handler 不 emit；且 `GeneralSettings.handleSettingsChange` 无 docCount 分支，事件最终无人消费。docCount 实际生效靠 `getGeneralSettings()?.updateDocCount()` 直调。
3. **冗余**：`getGeneralSettings` 逻辑与 `HighlightSettings.vue` 重复；`gsStorage` 用 `computed` 包装非响应式服务对象、判空风格两套并存。

修复目标：字体样式连续输入加防抖；docCount 改为与兄弟子面板一致的「emit 事件驱动」模式，补全消费分支，消除死代码与冗余，行为保持一致。

## 不做的事

`updateInterval: string → number` 类型修正暂不处理（涉及旧持久化数据兼容，另行评估）。

## 技术栈

- Vue 3 + TypeScript（沿用既有项目技术栈，无新增依赖）
- 修改范围仅限 `generalSettings` 功能模块内部，不改动公共架构

## 实现方案

### 总体策略

采用「emit 事件驱动」统一 docCount 的变更链路：`DocCountSettings` 持久化后统一 `emit("change", settings)`，由父面板 `index.vue` → `GeneralSettings.handleSettingsChange` 新增 docCount 分支调用 `updateDocCount()`，替代原先的 `getGeneralSettings()?.updateDocCount()` 直调。该链路为同步调用（Vue emit 同步、父 handler 同步、`onSettingsChange` 同步），与兄弟子面板 codeblock/heading 等模式完全一致，行为等价且消除了死代码。

### 关键改动点

#### 1. DocCountSettings.vue

- **防抖**：新增模块级 `fontStyleTimer` 与 `onUnmounted` 清理。`handleFontStyleChange` 改为「清旧定时器 → 设 150ms 定时器 → 到点执行持久化」。字号/粗细下拉虽为离散 change，但统一走该防抖无感延迟；颜色输入与透明度滑块因此不再每 tick 写存储/刷提示。参考代码块设置的 100ms 防抖实践。
- **emit 统一**：`persistAndApply` 移除 `getGeneralSettings()?.updateDocCount(settings)` 直调，改为 `emit("change", settings)`；`handleToggleChange` 中删除重复的 `emit`，4 个 handler 均经 `persistAndApply` 统一 emit。
- **删除冗余**：移除 `getGeneralSettings` 函数及 `import type { GeneralSettings } from "../GeneralSettings"`。
- **gsStorage 简化**：`computed(() => ...)` 改为普通 `const gsStorage = props.plugin ? new GeneralSettingsStorage(props.plugin) : null`；`loadSettings` 与 `ensureStorage` 统一用 `if (!gsStorage)` 判空（去掉 `.value` 噪音，消除两套判空并存）。
- **import 调整**：`vue` 导入新增 `onUnmounted`；`computed` 保留（仍被 `t`、`previewFormatted` 使用）。

#### 2. GeneralSettings.ts

- `handleSettingsChange`（110-130 行）新增分支：`else if (settings.moduleId === "docCount") { this.updateDocCount(settings.settings as unknown as DocCountSettings) }`，位于 tabPin 分支之后、`emitCustomEvent` 之前。`DocCountSettings` 类型已在文件头部导入，无需新增。

## 实现要点与风险控制

- **防抖性能**：连续输入期间 save/apply/showMessage 从 O(n) 次降为 1 次；`updateCountStyles()` 全量重绘也随之收敛到拖拽结束后一次。
- **内存安全**：`fontStyleTimer` 在 `onUnmounted` 中 `clearTimeout`，防止组件销毁后定时器回调访问已卸载状态。
- **行为一致性**：emit 链同步等价于原直调，docCount 生效时机不变；`updateDocCount` 内部（开关管理 DocCountManager 生命周期 + 应用配置）零改动。
- **无持久化兼容风险**：不改动存储键、不改动 `DocCountSettings` 类型结构，仅改调用路径与防抖时序。
- **blast radius**：仅 2 个文件；`HighlightSettings.vue`、`DocCountManager.ts`、`index.vue` 均保持不动。

## 目录结构

```
src/features/generalSettings/
├── components/
│   └── DocCountSettings.vue   # [MODIFY] 防抖 + emit 驱动 + 移除 getGeneralSettings + gsStorage 改 const
└── GeneralSettings.ts         # [MODIFY] handleSettingsChange 补 docCount 分支
```

## 验证

用户自行执行（AI 不运行）：

- `npx tsc --noEmit`：确认类型通过（重点：emit 链、移除 GeneralSettings 导入后无残留引用）
- `pnpm lint`：ESLint 检查
- `pnpm dev` 手动验证：拖动透明度滑块/输入颜色仅一次保存与提示；开关/间隔/字体/格式变更后文档数实时刷新；关闭开关后统计消失且无残留定时器。