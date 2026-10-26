# 超级面板（superPanel）代码审查报告

> 审查范围：`src/features/superPanel/**`（25 个文件）+ 关联链路（`vueAppHelper` / `settings.ts` / `aiApi` / `eventBus` / i18n 合并产物）
> 审查日期：2026-10-26 · 方式：静态走读，未运行构建/lint（遵循 AGENTS 禁令）

## 总览

| 严重度 | 数量 | 类别 |
|--------|------|------|
| P1 真实缺陷 | 3 | API Key 数据丢失链、i18n 系统性解析失败、dock-click 事件无监听 |
| P2 冗余/风险 | 4 | 保存风暴、硬编码文案、全局样式污染、i18n 双源维护 |
| P3 死代码/轻微 | 7 | 死 mixin、死映射条目、死 prop、README 过期等 |

内存泄露专项结论：**主链路健康**。`panel.destroy()` + `closeAiSettings()` → 两个 Modal 均走 `destroy()`（unmount + remove DOM）；`window` 监听有配对 `removeEventListener`；无定时器/Observer。唯一泄漏面是顶栏图标元素（P3-7）。

---

## P1-1 AI 设置面板 `apiKeys` 浅拷贝别名 → 可导致已存密钥被删除（数据丢失链）

**位置**：`components/AiSettingsPanel.vue:121,141,188-192`；`types/index.ts:264-284`；`utils/vueAppHelper.ts:299-306`

**机制**（三因叠加）：

1. `AiSettingsPanel.vue:121` `reactive<AiSettings>({ ...props.settings })` 是**浅拷贝**，`settings.apiKeys` 与 `props.settings.apiKeys`（即 `plugin.settings.aiApiKeys` 活对象）是**同一引用**。
2. `vueAppHelper.ts:301` `buildProps()` 仅在 `open()` 时求值一次 → 面板拿到的是**打开瞬间的静态快照**，保存后的新状态不会回流。
3. 管理器 `handleUpdateAiSettings`（types/index.ts:267）每次保存都 `{ ...aiApiKeys }` 重建新 map 并整体替换 `plugin.settings` → 面板内的旧引用**永久过期**。

**数据丢失复现路径**：

```
打开 AI 设置 → 输入 P1 密钥 → 保存（进入新 map M2，面板仍持旧 M1）
→ 切到 P2 → 切回 P1：handleProviderChange 读 M1["P1"] → undefined → 输入框显示空
→ 用户以为没存上，直接再点保存 → aiSettings.apiKey === ""
→ handleUpdateAiSettings 走 delete currentKeys["P1"] → 已存密钥被从磁盘删除
```

另外 `handleProfileApply`（AiSettingsPanel.vue:189-191）**直接改写别名 map**，即未持久化前就变更了插件运行态；保存失败时内存与磁盘不一致。

**修复建议**：面板持有自己的 key 桶，保存时把密钥镜像进本地 map，切换供应商从本地 map 读取：

```ts
// AiSettingsPanel.vue setup
const settings = reactive<AiSettings>({
  ...props.settings,
  apiKeys: { ...props.settings.apiKeys },   // ① 深拷贝 map，切断别名
})

const handleSettingUpdate = (field, value) => {
  settings[field] = value
  if (field === "apiKey") settings.apiKeys[settings.provider] = value  // ② 本地镜像
  emit("update:settings", { ...settings })
}
// handleProfileApply 中对 settings.apiKeys 的写入在 ① 之后即为安全私有副本
```

---

## P1-2 i18n 点号路径系统性解析失败 → 英文环境功能卡片全部回退中文

**位置**：`types/index.ts:118`（传切片）；`index.vue:142-145,160-161`（按全根路径解析）；对照组 `statusBar/featureRegistry.ts:179`（传全根，正确）

**机制**：管理器传给主面板的是**命名空间切片** `plugin.i18n.superPanel`，但 `FEATURE_CONFIG` 的 `titleI18nKey/descI18nKey` 是**全根路径**（`"superPanel.title"`、`"statusBar.title"`、`"resourceManager.panelTitle"`、`"textDiff.title"`、`"flashcardReading.panelTitle"`、`"docAnalysis.title"`…）。`resolveI18n(i18nSlice, "superPanel.title")` 在切片内找 `slice.superPanel` → 必然 MISS → 回退 `defaultTitle/defaultDesc`（中文硬编码）。

**后果**：en_US/superPanel.json 精心准备的翻译在面板卡片上**从不显示**；`i18n:merge`/`i18n:verify` 因键存在而校验通过，掩盖了断链。

**误点**：子功能标签（`"floatingToolbar.translate"`、`"quickNote.autoOpen"）能正常显示纯属巧合——superPanel 命名空间内恰好内嵌了同名子对象（见 P2-4）。

**修复建议**：主面板 i18n prop 改传全根对象（与 statusBar featureRegistry 对齐）：

```ts
// types/index.ts buildProps
i18n: (this.plugin.i18n as any) || {},   // 全根；卡片键 "xxx.title" 与子标签 "floatingToolbar.translate" 同源
```
注意联动：`index.vue` 中 `i18n.title` 等扁平键需改为 `i18n.superPanel.title`（或单独传一个 `panelI18n` prop），头部组件的键同步调整。

---

## P1-3 `dock-click` 事件全局无监听者；ACTION_EVENT_MAP 含 4 条不可达条目

**位置**：`types/index.ts:75-95`（映射表）；全局 grep 证据

- `ACTION_EVENT_MAP` 的 `openFlashcardReading`、`openStatistics`、`openDocAnalysis`、`openTextDiff` 四条，在 `FEATURE_CONFIG` 中**没有任何 action key 与之对应**（statistics/textDiff/flashcardReading/docAnalysis 条目均无 `actions` 字段）→ 这四条映射**不可达 = 死配置**。
- 附带发现（超出本模块但同链路）：`"dock-click"` 事件全仓库 **5 处 emit、0 处监听**（superPanel/docAnalysis/rssReader/skillLearning/statistics 均在发，App.vue 只监听 open*/toggle* 系列）。即使将来把 `openDocAnalysis` 挂到卡片上，emit 后也只会"面板关闭、功能不打开、无任何反馈"。

**修复建议**：删除或注释 4 条不可达映射（保留会在审计时制造"已支持"假象）；`dock-click` 属跨功能调度断链，应在 App.vue 补监听或统一改走 `plugin.addDock` 的实例调度（`plugin.__xxx.toggle()` 模式），建议单独立项处理。

---

## P2-1 API Key 输入无防抖：每个按键触发一次全量加密持久化

**位置**：`AiSettingsPanel.vue:133-136` → `types/index.ts:211-236` → `src/index.ts:262-274`

`TextInput @input` → `update:settings` → `saveSettings` → **全量** `aiApiKeys + aiProfiles` AES-GCM 加密 → `plugin.saveData` fs 写盘 → `saveFeatureFlagsSync` → `rebuildThemeColor()` → `emitCustomEvent("settingsUpdated")`。输入 50 字符密钥 = 50 次完整链路；且 `updateSettings` 无串行化，连续快速输入时多个异步保存并发，完成顺序不定（ last-writer-wins，兄弟字段可能被旧快照覆盖）。

**修复建议**：面板内对 `update:settings` 做 300~500ms debounce，或管理器侧对 `_updatePluginSettings` 加 Promise 队列串行化；`rebuildThemeColor` 仅在主题相关字段变化时调用。

## P2-2 硬编码中文文案（违反 AGENTS_I18N）

| 位置 | 文案 |
|------|------|
| `types/index.ts:247` | `"功能开发中..."` |
| `types/index.ts:282` | `"AI配置已保存"` |
| `AiSettingsPanel.vue:143` | `"供应商已更新"` |
| `AiSearchSettings.vue:57,63,64,71` | 测试查询串 `"今天是几号 最新新闻"`、`"搜索成功！…"`、`"联网搜索测试成功"`、`"搜索失败: "` |
| `ApiKeyInput.vue:14,55,59` | `"隐藏密钥"/"显示密钥"`、`"请输入…API密钥"`、`"…API密钥，用于所有AI功能"` |

en_US 用户在 AI 设置弹窗内看到大量中文。建议补 `superPanel.json` 键位并走 i18n。

## P2-3 主面板样式未 scoped：通用类名全局污染 + 重复定义

**位置**：`index.vue:234-237`（`<style lang="scss">` 无 `scoped`）+ `styles/index.scss`

该样式块随插件加载即注入 `<head>`，`.setting-input / .setting-desc / .setting-group / .setting-select / .setting-label` 等通用名进入**全局作用域**，与其他 feature 及各 AI 子组件 scoped 内的同类名规则**双份定义**（后者靠属性选择器权重取胜，行为脆弱）。`.ai-settings-content`（index.scss:75-80）在拆分 Tab 后**无任何模板引用 = 死类**。

**修复建议**：index.vue 的 style 块加 `scoped`（配合 `:deep()` 处理 Modal 动态 DOM），或给全局段只保留 `.super-panel-*` 前缀类、把 `.setting-*` 移入各组件 scoped 文件；删除 `.ai-settings-content`。

## P2-4 子功能标签 i18n 双源维护，且已发生文案分歧

`superPanel.json:22-28` 内嵌 `floatingToolbar.translate="英译中替换"`、`quickNote.autoOpen` 等副本；`floatingToolbar.json:10` 自身维护 `translate="翻译替换"`。**同名键两处文案已不一致**（"英译中替换" vs "翻译替换"），改一处漏一处是必然。

**修复建议**：以 feature 自身 i18n 为唯一真源，删除 superPanel.json 内嵌副本；配合 P1-2 传全根 i18n 后路径天然解析到 `floatingToolbar.translate`。

---

## P3 死代码 / 轻微问题清单

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| 1 | `styles/mixins.scss:26-43` | `text-ellipsis`、`tablet-only` 两个 mixin 无任何 `@include`；注释"被 statistics 引用不可删除"已过期（全仓库无 `superPanel/styles/mixins` 外部引用） | 删除两个 mixin 与过期注释 |
| 2 | `types/index.ts:79-94` | 4 条不可达映射（见 P1-3） | 删除或补 FEATURE_CONFIG action |
| 3 | `AiSettingsPanel.vue:4,91` + `types/index.ts:321` | `visible` prop 恒为 `true`（非持久 Modal 每次重建实例），`v-if` 为死分支 | 删 prop 与 v-if |
| 4 | `types/index.ts:131` vs `index.vue:196` | 子开关默认值不一致：切换处理器 `?? false`、显示端 `?? true`。当前被 DEFAULT_SETTINGS 全量合键掩盖；一旦某子键缺失会出现"显示开、点第一下无效果"的死点 | 统一为一处常量（建议 `?? true`） |
| 5 | `types/index.ts:129-133` | `onToggleSubFeature` 内 `featureIdToSettingKey` 算完只用于读值，`handleToggleFeature` 内部又算一遍 | 提取 `readSetting(key)` 小函数或让 toggle 接收 key |
| 6 | `components/providers.ts:31,38,45` | `defaultModel` 硬编码，与 `aiModels.ts` 的 `common[0]` 语义重复（注释自称"common 列表第一项"） | 改为派生：`models.common[0]?.value ?? ""` |
| 7 | `types/index.ts:164-176,345-349` | `addTopBar` 元素未在 `destroy()` 移除（全项目无此惯例，superPanel 常驻注册所以不显眼；插件禁用/重载时图标残留） | 存引用，destroy 中 `topBarElement?.remove()` |
| 8 | `types/index.ts:201-204` | `open()` 在 `loadAndApplySettings` 完成前被热键触发时，`reactive(undefined)` → `buildProps` 的 `reactiveSettings!` 为 undefined，面板渲染抛 TypeError | `settings` 判空回退 DEFAULT_SETTINGS |
| 9 | `README.md:3,7` | 已过期：提到博查 Key/`searchBochaApiKey`/`searchProvider`（已改为固定 DeepSeek Search）、"弹窗顶部下拉选择档案"（现为独立 Tab）、"网格布局"（现为 column-count 双列） | 按现状重写 |
| 10 | `AiSearchSettings.vue:51-75` | 测试搜索无超时/AbortController，组件销毁后 in-flight 请求仅写已脱离的 ref（无泄漏，仅状态悬挂） | 低优先级；可加 AbortSignal |

## 重复类型专项结论

- `AiSettings`（superPanel/types）与 `AiProfileConfig`（@/types/ai）字段高度重叠（provider/model/customModel/apiKey/customEndpoint/enableThinking），但语义不同：前者是含 `apiKeys` map 的**运行态**，后者是**命名快照**。可让快照类型 `Omit<AiSettings, "apiKeys">` 派生，消除 6 字段手工同步；非必改。
- `ProviderMeta/PROVIDERS`（superPanel 局部）与 `@/config/aiModels`（模型清单）分工正确；唯一重复点是 P3-6 的 defaultModel。
- `text-ellipsis` mixin 在 superPanel（未使用）/diskBrowser/dataSnapshot 三处各自实现——superPanel 的一份可直接删。

## 修复优先级建议

1. **P1-1（密钥丢失链）**：面板深拷贝 apiKeys + 本地镜像，改动最小、收益最高。
2. **P1-2（i18n 断链）**：改传全根 i18n + 删内嵌副本（与 P2-4 一起做）。
3. **P2-1（保存防抖）**：涉及全用户可感的性能与并发安全。
4. P1-3 / P2-2 / P2-3 及 P3 清单按批次清理。

> 验证方式：修复后由用户执行 `pnpm lint && pnpm i18n:verify && pnpm typecheck`；P1-1/P1-2 建议在 en_US 环境手工走一遍「输入密钥→切换供应商→回切」与「卡片标题显示」两个场景。
