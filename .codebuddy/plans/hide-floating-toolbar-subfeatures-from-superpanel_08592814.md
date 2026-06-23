---
name: hide-floating-toolbar-subfeatures-from-superpanel
overview: 从超级面板功能列表中移除 translate（英译中替换）和 pronunciation（谐音翻译），它们只作为浮动工具栏的内部子功能存在，不再作为独立开关项显示。
todos:
  - id: remove-from-config
    content: 从 src/features/config.ts 的 FEATURE_CONFIG 数组中删除 pronunciation（第100-105行）和 translate（第189-194行）条目
    status: completed
  - id: update-configonly
    content: 从 src/features/index.ts 的 _ConfigOnly 白名单中移除 "pronunciation" 和 "translate"
    status: completed
  - id: remove-from-icons
    content: 从 src/config/icons.ts 的 FEATURE_ICONS 中删除 pronunciation（第127-131行）和 translate（第221-225行）条目
    status: completed
  - id: verify-build
    content: 运行 pnpm build 验证编译通过，确认超级面板中不再显示这两个子功能
    status: completed
    dependencies:
      - remove-from-config
      - update-configonly
      - remove-from-icons
---

## 用户需求

将 translate（英译中替换）和 pronunciation（谐音翻译）从超级面板功能列表中移除，因为它们本质上是浮动工具栏（floatingToolbar）的子功能，不应作为独立开关在超级面板中显示。

## 核心功能

- 超级面板的功能列表中不再出现"英译中替换"和"谐音翻译"两个独立条目
- 两个子功能的开关（enableTranslate / enablePronunciation）保留在 PluginSettings 中，浮动工具栏继续通过它们控制子功能的启用/禁用
- 浮动工具栏注册不受影响，仍按 settings 条件注册 translate 和 pronunciation 操作

## 技术方案

### 实现方法

从三个文件中移除 translate 和 pronunciation 的元数据注册，使超级面板不再渲染这两个子功能为独立功能卡片。

### 关键决策

- **保留 settings 不变**：`enableTranslate` 和 `enablePronunciation` 在 `src/config/settings.ts` 中保留，浮动工具栏 `registerFloatingToolbar()` 依赖它们控制子操作是否注册
- **保留 i18n 不变**：`pronunciationHelp` 键仍被 `PronunciationDialog.vue` 使用，独立 i18n 文件无需清理
- **保留浮动工具栏核心逻辑不变**：`src/features/floatingToolbar/index.ts` 和 `core/actions/` 完全不动

### 修改文件（3 个）

```
src/
├── features/
│   ├── config.ts          # [MODIFY] 删除 pronunciation 和 translate 两个 FEATURE_CONFIG 条目
│   └── index.ts           # [MODIFY] 从 _ConfigOnly 白名单中移除 "pronunciation" 和 "translate"
└── config/
    └── icons.ts           # [MODIFY] 删除 pronunciation 和 translate 的 FEATURE_ICONS 条目
```

### 编译时断言影响分析

`src/features/index.ts` 中的 `_ConfigOnly` 类型参与两重编译时校验：

1. `_AssertRegisteredInConfig`：从 FEATURE_CONFIG 和 `_ConfigOnly` 同步移除后，此断言不受影响
2. `_AssertAllCovered`：`Exclude<FeatureId, _ConfigOnly>` 范围缩小也不会引入新错误

同步从 FEATURE_CONFIG 和 `_ConfigOnly` 移除即可保持编译通过。