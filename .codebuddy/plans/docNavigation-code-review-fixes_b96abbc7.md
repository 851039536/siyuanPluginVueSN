---
name: docNavigation-code-review-fixes
overview: docNavigation 功能代码审查：发现 12 个问题（4 内存泄露、2 死代码、2 冗余、1 重复类型、2 逻辑漏洞、1 样式违规），逐一修复。
todos:
  - id: fix-memory-leaks
    content: 修复全部 4 个内存泄露：重构 index.ts 为 destroy() 自挂载模式（observer.disconnect + eventBus.off + 全量 nav app 清理），storage.ts 缓存过期条目驱逐，src/index.ts DESTROYABLE_KEYS 新增 __docNavigation
    status: completed
  - id: clean-dead-redundant
    content: 清理死代码与冗余：删除 disposeCache()、ChildDocDropdown 不可达 v-else、removeExistingNav() 重复调用；修正 storage.ts 中 setCachedBreadcrumb 的 as 断言；删除 DocPathInfo 重复类型
    status: completed
  - id: fix-logic-scss
    content: 修复逻辑漏洞与样式违规：filteredChildDocs 去掉多余 stripHtml，visibilityMap 加语义注释；styles/index.scss 补 @use + 12 处硬编码替换为设计 Token
    status: completed
  - id: update-memory
    content: 更新今日记忆文件，记录全部修复内容与验证状态
    status: completed
    dependencies:
      - fix-memory-leaks
      - clean-dead-redundant
      - fix-logic-scss
---

## 用户需求

审查 docNavigation 功能的代码质量，修复发现的逻辑漏洞、冗余、内存泄露、死代码、重复类型等全部问题。

## 审查发现（12个问题）

### 内存泄露（4个）

1. **IntersectionObserver 未释放**：模块级 observer 创建后永不 `disconnect()`，插件卸载后仍持有 element 引用
2. **eventBus 事件未解绑**：注册了 3 个事件（switch-protyle / loaded-protyle-dynamic / loaded-protyle-static）永不 `off`，插件重载时监听器会累积
3. **DOM 容器 + Vue app 无全局生命周期清理**：`__docNavContainer` 和 `__docNavApp` 挂在 protyle 对象上，跨文档切换或插件卸载时只在新导航时清理旧实例，最终残留
4. **缓存过期条目不删除**：`DocNavigationCache.get()` 中过期条目只返回 null 但不从 Map 中删除，永久占用内存

### 死代码（2个）

5. `disposeCache()` 导出函数全局无任何调用者
6. `ChildDocDropdown.vue` 的 `v-else` 空状态分支不可达（父组件 `v-if="childCount>0"` 已确保 childDocs 非空）

### 冗余与类型问题（3个）

7. `removeExistingNav()` DOM 删除与后续 `app.unmount()` 重复清理
8. `setCachedBreadcrumb` 用 `as BreadcrumbCacheItem` 绕过类型检查，缺少 `timestamp` 字段
9. `DocPathInfo` 接口与 `api.getPathByID` 返回类型完全重复

### 逻辑漏洞（2个）

10. `visibilityMap.get(protyle.element) === false` 首次渲染隐式依赖 `undefined !== false`，语义不清晰
11. `filteredChildDocs` 中 `stripHtml(doc.content)` 多余——doc.content 来自文件名（`stripSySuffix(file.name)`），不含 HTML

### 样式违规（1个）

12. `styles/index.scss` 缺少 `@use "@/variables"`，含 12 处硬编码值违反 Codex 规范

## 技术方案

### 修复策略

所有修复在 `src/features/docNavigation/` 目录下进行，涉及 6 个文件。核心改动：

#### 一、内存泄露修复（index.ts 重构 + storage.ts 缓存驱逐）

参照 `pageLock/index.ts` 的 `DESTROYABLE_KEYS` + `destroy()` 模式：

- `index.ts`：将 `registerDocNavigation` 改为返回带 `destroy()` 的 instance 对象，自挂载到 `plugin.__docNavigation`
- `destroy()` 内部：(1) `observer.disconnect()` 释放 IntersectionObserver，(2) `plugin.eventBus.off()` 解绑 3 个事件，(3) 遍历全部已创建的 nav app 执行 `unmount()` + 移除 DOM，(4) `cache.clearAll()` 清空缓存，(5) 清空 `timerMap`
- 使用模块级 `Set` 跟踪所有挂载了 nav 的 protyle 对象
- 在 `src/index.ts` 的 `DESTROYABLE_KEYS` 中加入 `"__docNavigation"`

- `storage.ts`：在 `get()` 方法的过期分支中，删除过期条目后再返回 null

#### 二、死代码与冗余清理

- `useDocNavigation.ts`：删除 `disposeCache()` 函数
- `ChildDocDropdown.vue`：删除 `v-else` 空状态分支（保留注释说明不可达原因）
- `index.ts`：删除 `removeExistingNav()` 调用，删除对应导入
- `storage.ts`：重写 `setCachedBreadcrumb`，显式传入 `timestamp: Date.now()` 替代 `as` 断言

#### 三、类型与逻辑修缮

- `storage.ts`：删除 `DocPathInfo` 导出接口，函数参数改为内联 `{ notebook: string; path: string }`，消除与 `api.getPathByID` 返回类型的重复
- `useDocNavigation.ts`：`filteredChildDocs` 中将 `stripHtml(doc.content).includes("参考")` 改为 `doc.content.includes("参考")`（纯文件名，无需 HTML 清洗）
- `index.ts`：在 `visibilityMap` 检查处增加注释说明 `=== false` 的语义

#### 四、样式规范修复

- `styles/index.scss`：顶部添加 `@use "@/variables" as *;`，12 处硬编码替换为对应设计 Token

| 硬编码值 | 替换 Token |
| --- | --- |
| `font-size: 12px` (×3) | `$font-size-xs` |
| `font-size: 11px` | `$font-size-2xs` |
| `font-weight: 600` | `$font-weight-semibold` |
| `line-height: 1.4` | `$line-height-normal` |
| `padding: 1px 4px` | 改为 `padding: 2px $spacing-1` |
| `border-radius: 3px` (×2) | `$radius-sm` |
| `border-radius: 4px` | `$radius-sm` |
| `margin: 2px 0 6px` | `margin: $spacing-2px 0 $spacing-2` |
| `gap: 2px` | `gap: $spacing-2px` |
| `gap: 4px` (×2) | `gap: $spacing-1` |
| `gap: 8px` | `gap: $spacing-2` |


### 目录结构

```
src/
├── index.ts                              # [MODIFY] DESTROYABLE_KEYS 新增 "__docNavigation"
├── features/docNavigation/
│   ├── index.ts                          # [MODIFY] 重构为 destroy() 模式，修复全部内存泄露
│   ├── composables/
│   │   └── useDocNavigation.ts           # [MODIFY] 删除 disposeCache()，修复 filteredChildDocs 多余 stripHtml
│   ├── types/
│   │   ├── index.ts                      # [MODIFY] 无改动（此前已清理 TitleCacheItem）
│   │   └── storage.ts                    # [MODIFY] 缓存过期驱逐 + 删除 DocPathInfo + 修正 setCachedBreadcrumb
│   ├── components/
│   │   └── ChildDocDropdown.vue         # [MODIFY] 删除不可达的 v-else 分支
│   └── styles/
│       └── index.scss                    # [MODIFY] 补 @use + 12 处硬编码替换 Token
```

### 向后兼容

- `registerDocNavigation` 函数签名不变，仅内部重构为自挂载 destroy 模式
- `DocPathInfo` 删除后，`useDocNavigation.ts` 中的局部使用改为内联类型，不对外暴露
- 所有 UI 视觉效果保持不变（Token 值与硬编码值数值相近）