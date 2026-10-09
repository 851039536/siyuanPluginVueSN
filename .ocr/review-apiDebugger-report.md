# apiDebugger 代码审查报告

审查范围：`src/features/apiDebugger/`（6 个源文件 + 2 个 i18n 分片）
方法：open-code-review（commit f17af82d，20 文件全量完成，0 跳过）+ 逐项源码复核与实证验证

## 结论摘要

| 严重度 | 数量 | 说明 |
| --- | --- | --- |
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | 卸载后异步回写；`Input type="textarea"` 违规 |
| Low | 2 | `i18n` prop 弱类型；原生 `<button>` 标签页 |

**OCR 在本模块报出 0 条问题**（6 个 apiDebugger 文件均已完成分析、无 failed）。
其 3 条 findings 全落在同一 commit 内的 `diskBrowser` 模块，与本模块无关。
以下结论来自人工复核 + 可执行验证。

## Medium

### M1. 卸载后仍会写状态与持久化（`sendRequest` 缺 disposed 守卫）

`composables/useApiDebugger.ts`：

- L74 声明 `let disposed = false`，L82-84 在 `onUnmounted` 置位
- 但该标志**只在 L78 的 onMounted 加载处被消费**（`if (disposed) return`）

`sendRequest`（L134-200）全程无守卫：请求在途时面板被卸载，响应返回后仍会执行
L170-188 / L190-196 的 `statusCode.value = ...`、`responseBody.value = ...`、
`history.value = await storage.addRecord(...)`、`activeTab.value = ...`。

后果：卸载后写入已失效的响应式状态，并向插件存储**追加一条历史记录**（用户已关闭面板却多出一条）。
`storage.addRecord` 走 `settings.loadOrDefault()` + `save()`，即使实例已卸载仍会落盘。

对照同仓库既有约定（`aiContentGenerator/composables/useGeneration.ts`）：
该模块对同样的场景**同时**用了 `disposed` 守卫（L213、L223，在流式回调入口拦截）
与 `AbortController`（L64、L128、L275 `signal`），并有 `if (options.signal?.aborted)` 检查（L313）。
apiDebugger 只声明了 `disposed`，未在异步主路径使用。

建议：`sendRequest` 的每个 await 之后加 `if (disposed) return`；更彻底的做法是引入
`AbortController` 并在 `onUnmounted` 中 abort（`fetch` 支持 `signal`，
可同时省掉一次无谓的网络往返）。

### M2. `Input type="textarea"` 违反项目的共享组件强制规则

`index.vue:89-96` 的请求体输入用了：

```vue
<Input v-model="requestBody" type="textarea" :rows="6" size="xsmall" resize="vertical" />
```

而 `AGENTS.md` L199 明确要求：**「多行输入用 `Textarea`，不用 `Input` 的 `type="textarea"` 旧入口」**，
L212 补充「新代码一律用本组件」。`type="textarea"` 仅为兼容保留。

建议：改用 `src/components/Textarea.vue`（对应 props：`v-model` / `size` / `rows` / `resize`）。

## Low

### L1. `i18n` prop 类型退化为 `Record<string, any>`

`index.vue:262`：`i18n: Record<string, any>`。

- 同模块内 `props.i18n.categories[options[0].category]`（L308）依赖嵌套结构，
  弱类型下该访问路径无法被 TS 校验，拼错键名不会有任何提示
- 同类模块已收敛：`aiContentGenerator/index.vue:106` 用 `Record<string, string>`，
  `diskBrowser/index.vue:69` 用专门的 `DiskBrowserI18n` 接口

建议：为 apiDebugger 定义 `ApiDebuggerI18n` 接口（含 `categories` 映射），与 diskBrowser 对齐。

### L2. 标签页用原生 `<button>` 自建

`index.vue:122-136` 的响应/历史切换用原生 `<button>` + BEM 类名 + `--active` 修饰类自行实现。

AGENTS.md L199 要求「一组互斥选项的分段切换仍用 `Button` 分组 + `:aria-pressed`」。
当前实现缺少 `aria-pressed` / `role="tab"` 等语义，键盘与读屏体验弱于共享组件方案。

注：模块 README 对该场景无豁免说明（对比 aiContentGenerator README 对 `CollapsibleSection`
保留了明确的「合规例外」说明），故按违规记录。

## 已验证无问题的项（含一次自我纠错）

- **XSS（v-html 渲染路径）— 安全**。`syntaxHighlight` 对「匹配之间的原文」与「命中的 token」
  都调用 `escapeHtml`（转义 `& < > " '`），无遗漏分支。构造 8 个载荷实测：
  `<script>`、`<img onerror>`、闭合标签逃逸 `</span><script>`、Unicode 转义
  `\u003cscript\u003e`、`<svg onload>`、HTML 注释绕过、属性闭合注入 —— **全部被正确转义，无标签泄漏**。
- **响应区三分支渲染 — 无误**。我最初怀疑「网络异常时 `statusCode = 0`（非 null）会导致
  错误文本不显示」，写脚本验证后**推翻**：该场景 `responseBody` 为空，
  `v-if="errorMessage && !responseBody"` 先命中，错误文本正常显示。
- **`success` 字段 — 非死代码**。虽在 `sendRequest` 中计算后不直接渲染，但被
  `index.vue:220` 的历史条目状态色消费，链路完整。
- **`maxHistory` — 非冗余**。`storage.addRecord` L31 用它做 `slice` 截断，
  且来自持久化数据（非常量直用），符合 50 条上限设计。
- **`isValidHttpMethod` 防御 — 有效**。`onMounted` 加载历史时过滤非法 method，
  防止持久化数据被外部篡改后污染 `HttpMethod` 联合类型。

## 未纳入

OCR 在同一 commit 范围内报出的 3 条 `diskBrowser` 事项（`useDiskBrowser.ts` 的
`toggleFavorite` 返回类型契约不符、乐观更新回滚的并发竞态、`utils/index.ts` 的
i18n 兜底清理不彻底）属于另一模块，不在本次范围内，未做处理。
