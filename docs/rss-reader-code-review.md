# RSS 订阅（rssReader）代码审查报告

> 审查范围：`src/features/rssReader/` 全部 35 个文件（index.ts / index.vue / types / utils ×6 / composables ×6 / components ×7 / styles ×10），关联核对 `pluginStorage`、`typedStorage`、`vueAppHelper`、`mdRenderer`、`AGENTS_STYLE.md` 规范。
> 结论：整体架构清晰（composable 拆分、统一入口、事件逐层转发均符合项目规范），但存在 **2 个 P0 级问题（XSS + 抓取 fallback 失效）**，以及若干逻辑缺陷、死代码与写放大隐患。内存管理整体健康，未发现实质性泄漏。

---

## P0 高危（建议立即修复）

### 1. 文章详情 `v-html` 未消毒 —— XSS 漏洞

`ArticleDetail.vue:78-82` 直接 `v-html="processedDetailContent"` 渲染 RSS `content`，而 RSS 正文是**第三方不受信内容**。恶意 feed 可注入 `<img onerror=...>`、`<svg onload=...>` 等事件属性载荷。

项目已有明确规范与能力：`mdRenderer.ts` 注释声明"本模块是 `v-html` 的唯一数据来源，渲染结果默认经 DOMPurify 消毒"，且 `sanitizeHtml`（DOMPurify）已在依赖中。本功能打破了该规范。

```ts
// 修复（ArticleDetail.vue）
import { sanitizeHtml } from "@/utils/mdRenderer"
const processedDetailContent = computed(() =>
  sanitizeHtml((props.item.content || props.item.description || "").replace(/<img\s+/gi, '<img loading="lazy" ')))
```

附带建议：`openInBrowser` 的 `window.open(item.link)` 前校验 `link` 以 `http(s)://` 开头（Atom 的 link 取自 `href` 属性，理论上可携带 `javascript:` scheme）。

### 2. `fetchRss` 的 XML 校验失效，代理 fallback 链提前中断

`fetchRss.ts:57-59` 的 `looksLikeXml` 只检查 `/^\s*</`——**HTML 错误页同样以 `<` 开头**（`<!DOCTYPE html>`），所谓"防止代理返回 HTML 错误页"的防护完全无效。实际后果：第一个代理返回 HTML 错误页时直接"成功"返回，后续代理不再尝试，最终在 parse 阶段报"无法识别的Feed格式"，用户看到误导性错误且 fallback 链形同虚设。

```ts
// 修复：真正的 XML 特征检测
function looksLikeXml(text: string): boolean {
  return /^\s*(<\?xml|<rss|<feed|<rdf:RDF)/i.test(text)
}
```

附带问题：
- `response.text()` 读取阶段无超时保护（仅连接阶段有），慢代理可能长时间挂起；
- `User-Agent` 是 fetch 的受限头，浏览器/Electron 下会被忽略或覆盖，该字段无效但无害；
- 公共代理（allorigins/corsproxy/codetabs）会看到订阅 URL（可能含 token），隐私上应知晓此权衡。

---

## P1 逻辑缺陷

| # | 位置 | 问题 | 修复建议 |
|---|------|------|----------|
| 1 | `parser.ts:113` | Atom 作者提取失效：`getAttributeValue(entry, "author name", "")` 对找到的 `<name>` 元素调 `getAttribute("")`，恒返回 null → **author 永远 undefined** | 改用 `getTextContent(entry, "author name")` |
| 2 | `useRssReader.ts:333-347` | `refreshAllFeeds` 串行 await，而每源 `fetchRss` 最坏耗时 75s（直连 15s + 3 代理各 20s），10 个源最坏 **12.5 分钟** | `Promise.allSettled` + 并发上限（如 3）|
| 3 | `SettingsPanel.vue:70` + `useSettingsOps.ts:60-72` | `sortOrder` 可被设为 `''`（`v === null ? '' : String(v)`），不在 `"newest"\|"oldest"` 联合内；`updateSettings` 也未校验枚举 | 传 `String(v)` 即可（Select 正常不给 null），`updateSettings` 中加白名单校验 |
| 4 | `SettingsPanel.vue:53` + `useSettingsOps.ts:64-66` | 数字输入非法值时 `Number("abc")=NaN`，`Math.max(10, Math.min(500, NaN))` **仍为 NaN**，直接 assign 并存盘 | clamp 后 `Number.isNaN` 回退当前值或默认值 |
| 5 | `useArticleOps.ts:42-49` | `toggleStar` 按 `link` 单键查找，跨源转载同 link 文章时**改错条目**（`filteredItems` 去重同样只按 link） | 主键改 `feedId + link` 联合（或存条目引用） |
| 6 | `useRssReader.ts:238-241` | `addFeed` 后不执行 `trimItemsPerFeed`，首次导入超过 `maxItemsPerFeed` 的源不裁剪，直到下次刷新 | `items.value.push` 后补一次 trim |
| 7 | `useOpmlTransfer.ts:35-61` | OPML 导入逐源 `addFeed`：N 源 = N 次网络请求（每源最坏 75s）+ N 次全量 `saveData` 写盘 | 解析校验先行，成功条目合并后一次性 saveData；导入中禁用重复触发 |
| 8 | `index.vue:61-63` + `useRssReader.ts:216/244` | `addFeed` 也把 `loadingStatus` 置为 loading/success/error，导致**添加订阅时工具栏"刷新全部"按钮误转圈** | addFeed 用独立的 `addingFeed` 状态（UI 已有），不再复用 loadingStatus |
| 9 | `useRssReader.ts:278-307` | `refreshFeed` 内 `feed` 与 `currentFeed` 重复 find 同一条目，中段 `if (!currentFeed) return` 为死防御 | 复用首个引用，删除重复查找 |

---

## P2 死代码 / 冗余 / 重复类型

| # | 位置 | 问题 |
|---|------|------|
| 1 | `types/index.ts:75` | `RssLoadingStatus` 的 `"success"`/`"error"` 无任何消费者（模板只判断 `'loading'`）→ 可退化为 boolean |
| 2 | `types/index.ts:26` | `RssFeed.enabled` 只被 `refreshAllFeeds` 读取，全工程无置 false 的路径、无 UI 开关 → 半死字段（要么补 UI，要么删） |
| 3 | `parser.ts:61/109` + `items.ts:16` | parser 内 `title \|\| "无标题"` 硬编码兜底使 `untitledLabel`（i18n 传入）成为**死参数**，`addFeed` 的 `feedInfo.title \|\| url` 同理死分支；且"无标题"/"未知订阅源"/全部报错文案硬编码中文，英文用户会看到中文错误 |
| 4 | `SettingsPanel.vue:202-215` | `handleFile` 的 try/catch **永不触发**——`props.importOpml`（父级 `handleImportOpml`）吞掉一切异常；与父级形成双份错误文案逻辑，二留一 |
| 5 | `useRssReader.ts:80` | `groupedFeeds` 内联 `Array<{group,label,feeds}>` 与已导出的 `RssGroupItem` 重复定义，应引用类型 |
| 6 | `ArticleList.vue:29-45` | 手写 `.rss-empty-state` 结构而未复用 `EmptyState` 组件，样式还依赖 `EmptyState.scss` 经全局 CSS 间接生效——脆弱耦合 + 结构重复 |
| 7 | `parser.ts:213` | `getPubDateTimestamp` 是日期工具却放在 parser.ts（`date.ts` 才是日期工具家），itemTrim/useRssReader 跨文件引用混乱 |
| 8 | `useOpmlTransfer.ts:56` | `${success} succeeded, ${failed} failed` 硬编码英文，i18n 违规 |
| 9 | `index.ts:18/27` | dock 标题与 command `langText` 硬编码中文 fallback "RSS订阅" |
| 10 | 样式组织 | `index.scss` 被 7 个组件各自 `@use`——Sass 每个 `.vue` style 块是独立编译单元不去重，`.rss-reader-panel` 主规则 + `@keyframes spin` + `.loading-icon` 在产物中**输出 7 份**。AGENTS_STYLE.md 要求子组件引入 index.scss 作"共享基座"，但该模式仅对纯 mixin/变量文件安全，含实际选择器的文件必然重复。建议：`spin`/`loading-icon` 拆为纯 partial 只在 index.vue 引入一次；子组件仅引各自 ComponentName.scss（CSS 本就全局生效，无需重复引入） |

---

## P3 性能与内存

**内存泄漏结论：无实质性泄漏。** 逐项核对：document click 监听配对移除 ✓、autoRefresh 定时器 stop 清理 ✓、TTS 卸载时 cancel ✓、dock 卸载经 `createVueDockApp` 的 destroy 链触发组件 unmount ✓。仅两处轻微：

1. **卸载时进行中的 fetch 不中止**：刷新中关闭 dock，请求继续跑完后仍写响应式状态——无害但浪费，可在 `onBeforeUnmount` 中对进行中请求 abort（低优先级）。
2. **`collapsedGroups` 残留**：分组最后一个源被删后，Set 中组名不清（字节级影响，顺手清理即可）。

**性能隐患（随订阅量增长）**：

| 问题 | 影响 | 建议 |
|------|------|------|
| `toggleStar`/标记已读 → `saveData()` 全量序列化 items+feeds 写盘（思源 saveData 写 JSON 文件） | 50 源 × 100 条含全文 HTML 可达数 MB，**每次收藏点击都全量重写** | content 截断存储（如 20KB）；或写操作 debounce 合并 |
| 搜索每键击全量 filter + sort，sort 比较器内重复 `new Date(pubDate)` 解析（O(n log n) 次） | 大列表输入卡顿 | `searchKeyword` 加 300ms 防抖；`getPubDateTimestamp` 结果缓存到 Map 或条目上预存时间戳 |
| 列表无虚拟滚动 | 数千条 DOM 全渲染 | 文章量 >500 时考虑虚拟列表（现有项目如有共享虚拟滚动组件优先复用） |
| `items.value.push(...newItems)` spread | 数万条时可能栈溢出（现实概率低） | 改 `items.value = items.value.concat(newItems)` |

---

## P4 UI 优化

| # | 现状 | 建议 |
|---|------|------|
| 1 | `removeFeed` 一键直接删除，无确认，误触即丢全部已存文章 | 加确认（思源 `confirm`）或二次点击确认模式 |
| 2 | 已激活的分组过滤标签无法点击取消（`setGroupFilter` 只设值），必须找到"全部"标签 | 点击已激活标签时重置为 all（toggle 语义） |
| 3 | 搜索框无清空按钮，清空需全选删除 | 有输入时显示 × 清空按钮 |
| 4 | 未读 badge 无上限（9999+ 会撑破 16px 徽章） | `> 99` 显示 `99+` |
| 5 | `feed-item` 是 `div @click`，无 `role="button"`/`tabindex`，键盘不可达 | 补键盘可达性；详情页支持 Esc 关闭 |
| 6 | `init()` 失败仅 `console.error`，用户面对空白面板无提示 | 空态/错误态提示 + 重试入口 |
| 7 | 详情视图与添加对话框用 `v-else-if` 全屏互斥切换，阅读中途点 + 会"跳走" | 可改为 Modal 叠加（`createModalVueApp`），阅读上下文不丢失 |
| 8 | AddFeedDialog 仅 URL 输入框响应 Enter，分组框回车无动作 | 分组框 Enter 同样触发提交 |

---

## 修复优先级建议

1. **立即**：P0-1 sanitize（一行修复，安全收益最大）、P0-2 looksLikeXml。
2. **本轮**：P1 的 1/3/4（数据正确性，均为小 diff）、P2-3/P2-8 的 i18n 违规项、P2-10 样式去重。
3. **择机**：P1-2 并发刷新、P1-7 OPML 导入、P3 写放大与防抖、P4-1 删除确认。
4. **明确取舍项**：`enabled` 字段（补 UI 或删除）、`loadingStatus` 状态机简化、FeedList 纯转发层（11 个事件逐一转发是分层设计选择，若想瘦身可让 index.vue 直接渲染 FeedGroup）。

---

## 修复实施 OCR 委派审查（commit 1b02ac40）

> `ocr delegate` commit 模式，23/23 可审查文件全覆盖（2 个 md 排除为 unsupported_ext）；机器验证：`i18n:verify` 通过、`pnpm test` 921 用例全过。**结论：无 Critical/High；1 Medium + 4 Low。**

| # | 严重度 | 位置 | 发现 |
|---|--------|------|------|
| 1 | Medium (bug) | `useRssReader.ts:366-397` | **并发刷新引入 saveData 写盘乱序竞态**（本次修复新引入）：refreshAllFeeds 并发 3，各 refreshFeed 完成后各自全量 `saveData()`。若 A 发起的写落盘晚于 B 的写（I/O 乱序），磁盘终态缺 B 的新文章而内存齐全——重启后丢失。建议 saveData 加 promise 链互斥，或 refreshFeed 改 deferPersist、refreshAllFeeds 结束统一落盘一次 |
| 2 | Low (i18n) | `utils/opml.ts:52` | `"OPML 解析失败"` 硬编码中文前缀漏改——parser.ts 同类文案已 i18n 化，此处属同一违规（原报告 P2-3 范畴）。建议 parseOpml 加可选 errorPrefix 参数 |
| 3 | Low (performance) | `useOpmlTransfer.ts:48-56` | OPML 导入的写盘已合并，但**逐源抓取仍串行**（N 源 = N 次串行 fetch，每源最坏 75s）。可与 #1 一并改受控并发 |
| 4 | Low (a11y) | `FeedGroup.vue:45` | `role="button"` 内嵌套刷新/移动/删除原生 button——嵌套交互元素是 a11y 反模式（原结构已如此，本次 role 声明使其显式化）。可改仅标题区可点、操作区独立 |
| 5 | Low (test) | — | clampNumber / looksLikeXml / getPubDateTimestamp 均为纯函数，宜按项目惯例补 `src/**/*.spec.ts` 行为断言（含 NaN/HTML 错误页/无效日期边界） |

**commit message 备注**：scope 拼写 `rss-eader` 应为 `rss-reader`（与历史 super-anel/s3-ackup 同类笔误，commit 未推送可 amend）。

**正确性核对通过项**：sanitizeHtml 接入点正确（懒加载 replace 先于消毒，不影响结果）；looksLikeXml 正则覆盖 RSS/Atom/RDF + XML 声明；worker-pool 队列消费逻辑正确（refreshingFeedIds 防同源重入仍有效）；clampNumber 的 NaN 回退路径正确；sortOrder 白名单 + SettingsPanel `String(v)` 双层防御成立；toggleStar 联合主键两处调用点同步；deferPersist 失败路径不落盘仅 console（与既有 saveData 错误策略一致）；7 个子组件样式去重后全局基座仍由 index.vue 单点引入，无选择器丢失；i18n 合并产物与分片一致、占位符 `{success}/{failed}/{name}` 键拼写无误。

### OCR 发现项修复实施（同日）

| # | 处置 |
|---|------|
| 1 Medium 并发写盘乱序 | **已修**：refreshFeed 增加 `deferPersist` 选项，refreshAllFeeds 并发抓取后统一 `saveData()` 一次（单次全量快照天然无乱序）；`saveData` 同时加 promise 链互斥兜底（覆盖删除/编辑等任意交错场景，串行化后每次写盘读取轮到时的最新快照） |
| 2 Low opml 硬编码 | **已修**：parseOpml 增加可选 `errorPrefix` 参数，useOpmlTransfer 传 i18n `opmlParseFailed`（zh/en 新键 + merge/verify 通过） |
| 3 Low OPML 串行抓取 | **已修**：importOpml 改 worker-pool 并发 3（addFeed 状态变更段为同步原子段，并发安全）；配套 addFeed 在 fetch 落定后复查 URL 去重，堵并发导入的前置查重竞态窗口 |
| 4 Low 嵌套交互元素 | **已修**：移除 `role="button"`（消除嵌套交互声明），保留 tabindex + Enter 选择与行内操作按钮可达，注释说明权衡 |
| 5 Low 测试缺口 | **已修**：`looksLikeXml` 导出、`clampNumber` 提取至 `utils/settings.ts`；新增 `utils/rssUtils.spec.ts` 17 用例（HTML 错误页拒绝、NaN 回退、无效日期、trim 收藏优先、toggleStar 跨源同 link） |

验证：`pnpm i18n:verify` 4743 叶键对齐；`pnpm test` 938 用例全过（58 文件；首轮 1 例失败为 gitPush 真实 git 类 flaky，连续两轮重跑均全量通过）。
