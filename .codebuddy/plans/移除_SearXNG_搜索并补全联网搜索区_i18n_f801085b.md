---
name: 移除 SearXNG 搜索并补全联网搜索区 i18n
overview: 彻底移除 SearXNG 联网搜索（UI 选项、webSearch.ts 实现与路由、SearchProvider 类型、SearchApiConfig/PluginSettings/AiSettings 的 searxngUrl 字段、settings.ts 默认值全部清除，旧配置 searchProvider=searxng 运行时自动回退 jina），并顺手将 AiSettingsPanel 联网搜索区硬编码中文改为 i18n 键渲染。
todos:
  - id: clean-types-config
    content: 清理 searxng 类型与配置字段：types/ai.ts、config/settings.ts、superPanel/types/index.ts 三文件同步删除
    status: completed
  - id: clean-websearch
    content: 删除 webSearch.ts 的 searchSearXNG 实现与 case 路由，清理文件头注释
    status: completed
    dependencies:
      - clean-types-config
  - id: add-fallback
    content: webSearch.ts 与 aiApi.ts 两处 searchProvider 读取加 searxng→jina 降级并删 searxngUrl 构造行
    status: completed
    dependencies:
      - clean-websearch
  - id: add-i18n-search
    content: 补 zh_CN/en_US superPanel.json 联网搜索区 13 个 i18n 键并保持对齐
    status: completed
  - id: update-settings-panel
    content: AiSettingsPanel.vue 删除 SearXNG UI 区块与选项，联网搜索区静态文案改 i18n 渲染并补中文注释
    status: completed
    dependencies:
      - add-i18n-search
      - clean-websearch
  - id: verify-removal
    content: 验证：grep searx 残留为零、npx tsc --noEmit 无新增错误、pnpm i18n:verify 通过
    status: completed
    dependencies:
      - add-fallback
      - update-settings-panel
---

## 用户需求

1. 彻底移除 SearXNG 搜索引擎支持：设置面板 UI 选项、`webSearch.ts` 的 `searchSearXNG` 实现与路由分支、`SearchProvider` 类型及 `SearchApiConfig`/`PluginSettings`/`AiSettings` 中的配置字段全部清除；旧配置 `searchProvider=searxng` 自动回退 `jina`，不产生运行时错误、无需迁移脚本。
2. 优化 AI 配置：将 AiSettingsPanel 联网搜索区（搜索引擎选择、博查 API Key、Jina 提示、测试搜索按钮等）的硬编码中文全部改为 i18n 键渲染（zh_CN/en_US 对齐），消除 AGENTS_I18N 违规。
3. 视觉呈现保持现状不变，仅移除 SearXNG 相关条目并切换文案来源。

## 边界

- 测试搜索的动态反馈文案（"搜索成功！获取到 N 条结果…"、"搜索失败: xxx"）与 script 内 showMessage 提示不在 i18n 范围内。
- i18n 仅改分片文件 `src/i18n/{zh_CN,en_US}/superPanel.json`。
- superPanel README 未提及 SearXNG，无需更新。

## 技术方案

### 涉及文件与改动（探索已定位全部 19 处引用）

**1. 类型与配置层清理（先删类型，避免中间态误用）**

- `src/types/ai.ts`：`SearchProvider` 联合类型移除 `"searxng"`；`SearchApiConfig` 删除 `searxngUrl` 字段及注释
- `src/config/settings.ts`：`PluginSettings` 删除 `searchSearxngUrl: string` 及注释中的 `'searxng'`；`DEFAULT_SETTINGS` 删除 `searchSearxngUrl: ""`
- `src/features/superPanel/types/index.ts`：`AiSettings` 删除 `searchSearxngUrl` 字段；`handleUpdateAiSettings` 保存行删除；`buildAiSettingsProps` 传值行删除

**2. 实现与路由清理 + 向后兼容降级**

- `src/utils/webSearch.ts`：删除 `searchSearXNG()` 函数整块与文件头注释 SearXNG 字样；`searchWeb()` switch 删除 `case "searxng"` 分支
- `src/utils/webSearch.ts` `getSearchConfigFromPlugin` 与 `src/utils/aiApi.ts` `getApiConfigFromPlugin`：删除 `searxngUrl` 构造行；`searchProvider` 读取处加降级

**3. 向后兼容降级写法**（参照 aiApi.ts 既有 openai/zhipu → tongyi 供应商降级先例：先以 string 读取旧值，再收窄联合类型，避免类型不含旧值导致比较不成立）

```ts
// webSearch.ts / aiApi.ts 内 searchProvider 读取处
const rawProvider: string = settings.searchProvider || "jina"
const searchProvider: SearchProvider = rawProvider === "searxng"
  ? "jina"
  : (rawProvider as SearchProvider)
```

- `PluginSettings.searchSearxngUrl` 字段删除后，已落盘的残留键无任何读取路径，无害，不做迁移

**4. UI 清理 + 联网搜索区 i18n 化（AiSettingsPanel.vue）**

- 删除 SearXNG 实例地址 SettingGroup（含 `settings.searchProvider === 'searxng'` 的 v-if 判定整块）
- `searchProviderOptions` 删除 searxng 项；label 改为存 i18n 键名，模板以 `i18n[opt.labelKey]` 渲染
- `testSearch()` 调 `searchWeb` 删除 `searxngUrl` 传参（`settings.searchSearxngUrl` 字段已随类型删除，此处必删否则编译失败）
- 联网搜索区静态文案全部改 i18n 键 + 每处补中文 HTML 注释（AGENTS_I18N 规则）：
- 分隔线 "联网搜索（RAG 模式）"、"搜索引擎" 分组标签、"博查 API Key" 分组标签、占位符、Jina 提示、测试按钮三目（"测试联网搜索"/"搜索中..."）、"搜索未返回结果，请检查配置"
- 博查说明含内嵌链接，i18n JSON 不支持 HTML → 拆三段渲染，中英文语序各自可调：

```
<!-- 说明文字：注册 博查AI 获取 API Key，免费额度 1000 次/月 -->
{{ i18n.bochaDescStart }} <a href="https://open.bochaai.com" target="_blank" class="setting-link">{{ i18n.bochaBrand }}</a> {{ i18n.bochaDescEnd }}
```

**5. i18n 键清单（13 键，zh_CN/en_US 对齐）**

| 键 | zh_CN | en_US |
| --- | --- | --- |
| searchSectionTitle | 联网搜索（RAG 模式） | Web Search (RAG Mode) |
| searchEngine | 搜索引擎 | Search Engine |
| searchProviderJina | Jina（免费） | Jina (Free) |
| searchProviderBocha | 博查搜索 | Bocha Search |
| searchBochaApiKeyLabel | 博查 API Key | Bocha API Key |
| searchBochaApiKeyPlaceholder | 在 open.bochaai.com 注册获取 | Get it at open.bochaai.com |
| bochaDescStart | 注册 | Register at |
| bochaBrand | 博查AI | Bocha AI |
| bochaDescEnd | 获取 API Key，免费额度 1000 次/月 | for an API key, 1000 free requests per month |
| searchJinaHint | Jina Search 免费无需 API Key，国内可访问，开箱即用。适合轻度使用，重度推荐博查搜索。 | Jina Search is free, no API key required, works out of the box. Ideal for light use; Bocha recommended for heavy use. |
| testSearchButton | 测试联网搜索 | Test Web Search |
| searching | 搜索中... | Searching... |
| searchNoResults | 搜索未返回结果，请检查配置 | Search returned no results, please check your config |


### 设计要点

- 不新增设置字段、不改存储 Schema，零迁移成本
- 类型层先删 → 实现层跟进，避免联合类型与 switch 分支残留不一致
- 改动集中于统一入口层（webSearch/aiApi）与 superPanel 设置面板，不跨 feature 直接导入，符合项目约束
- 静态文案全部收敛到 superPanel.json 分片，模板不再出现中文兜底

### 验证（lint / vite build 由用户执行）

- `grep -ri searx` 全仓（含 docs/）应为 0 残留
- `npx tsc --noEmit`：改动文件零新增错误（项目存在已知既有错误：statusBar/featureRegistry 等，需人工区分）
- `pnpm i18n:verify`：zh_CN/en_US 键对齐通过
- `read_lints` 检查改动文件诊断归零