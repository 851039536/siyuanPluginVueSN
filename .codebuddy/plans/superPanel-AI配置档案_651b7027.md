---
name: superPanel-AI配置档案
overview: 在超级面板的 AI 大模型配置弹窗中新增「配置档案」能力：可将整套 AI 设置（供应商/模型/自定义模型/API Key/自定义端点/思考模式/搜索设置）以命名档案保存多份，面板内下拉选择后点「加载/应用」按钮整组回填并立即生效，支持覆盖保存与删除。
todos:
  - id: add-profile-type-and-settings
    content: 在 src/types/ai.ts 新增 AiProfileConfig 接口，并在 src/config/settings.ts 增加 aiProfiles 字段（默认空数组）及加解密循环扩展
    status: completed
  - id: manager-profile-persistence
    content: 在 superPanel/types/index.ts 的 SuperPanelManager 透传 profiles prop 并新增 handleUpdateAiProfiles 持久化 aiProfiles
    status: completed
    dependencies:
      - add-profile-type-and-settings
  - id: profile-manager-component
    content: 新建 components/AiProfileManager.vue 与 styles/AiProfileManager.scss，实现档案下拉及应用/保存/删除按钮行（语义事件上抛）
    status: completed
    dependencies:
      - add-profile-type-and-settings
  - id: panel-integration
    content: 在 AiSettingsPanel.vue 集成配置档案区块，实现保存快照、整组回填单次生效、删除及 apiKeys 同步逻辑
    status: completed
    dependencies:
      - profile-manager-component
      - manager-profile-persistence
  - id: i18n-and-readme
    content: 为 zh_CN/en_US 的 superPanel.json 新增对齐的档案 i18n 键（含模板中文注释），并更新 superPanel/README.md 说明
    status: completed
    dependencies:
      - panel-integration
---

## 产品概述

在思源笔记插件「超级面板」的 AI 大模型配置弹窗中新增「配置档案」能力：用户可将整套 AI 设置保存为**命名档案**（多份），之后在面板中选中某档案并点击「应用」，即可整组切换到该档案对应的 AI 配置并立即生效。

## 核心功能

- **保存档案**：将当前整套 AI 设置（供应商、模型、自定义模型名、API Key、自定义端点、思考模式、搜索引擎、博查 Key）以命名档案形式保存；同名保存视为覆盖更新。
- **多档案管理**：可保存多份档案；面板提供档案下拉列表、保存、应用、删除操作。
- **应用切换**：下拉选中档案本身不改动任何字段；点击「应用」按钮后整组字段回填并即刻生效，直接覆盖当前值、无二次确认（沿用现有"边改边自动保存"机制，不做显式提交改造）。
- **适用范围**：所有供应商（通义千问 / DeepSeek / 小米 MiMo / 自定义API）均适用，不局限于自定义API。

## 边界与约束

- 运行期 AI 调用（`aiApi.getApiConfigFromPlugin`）只读取"单一激活配置"，因此切换档案只需原子改写现有激活字段，AI 调用链路零改动。
- 档案内 API Key 属敏感字段，须与现有 `aiApiKeys` 一致使用 AES-GCM 加密落盘。

## 技术栈选型

沿用项目现有技术栈与规范：Vue 3 + TypeScript + Vite + SCSS（样式必须分离到 styles/ 目录、使用设计 Token），数据持久化走既有 `PluginSettings` → `saveSettings/loadSettings`（AES-GCM 统一加解密）链路。不新增依赖、不新建 feature、不触发 8 步注册流程（仅扩展现有 superPanel 模块内部与全局设置字段）。

## 实施方案

档案机制 = 「多份命名快照 + 一份激活态」。激活态仍由现有 `aiApiProvider/aiModel/aiCustomModel/aiApiKeys/aiCustomEndpoint/aiEnableThinking/searchProvider/searchBochaApiKey` 字段承载（运行期唯一消费源），档案列表仅作为"可回填激活态的仓库"。应用档案 = 把该档案字段整组写入激活态一次并持久化，运行期消费与其它 feature 全部零感知。

### 关键决策与理由

1. **数据存储**：`PluginSettings` 新增 `aiProfiles: AiProfileConfig[]`，默认 `[]`（老存档无此字段时按空数组兼容）。共享类型 `AiProfileConfig` 放 `src/types/ai.ts`（`config/settings.ts` 禁止反向 import feature 层，而 superPanel 与全局设置均依赖 `@/types/ai`，无循环依赖风险）。
2. **敏感字段加密单点扩展**：`settings.ts` 的 `encryptSensitiveFields/decryptSensitiveFields` 增加对 `aiProfiles` 内每份档案 `apiKey` 与 `searchBochaApiKey` 的加解密循环。`plugin.updateSettings()` → `saveSettings()` 是唯一落盘入口（src/index.ts 265 行已确认），因此只需扩展这两处即可全链路覆盖，不泄漏明文。
3. **原子切换，避免中间态**：应用档案时一次性赋值本地 `reactive<AiSettings>` 全字段后仅 emit 一次 `update:settings`，由 `SuperPanelManager.handleUpdateAiSettings` 单次持久化；禁止逐字段赋值触发多次写盘与 UI 闪烁。应用时同步回写 `settings.apiKeys[provider] = apiKey`（空则删除），保持既有"切供应商读 KeyMap"机制一致。
4. **UI 结构与行数管控**：新增档案区块自包含、逻辑内聚，提取为展示性子组件 `AiProfileManager.vue`（只接收 `profiles` + `i18n`，语义事件 `save(name)/apply(name)/delete(name)` 上抛），AiSettingsPanel 持有表单快照与档案持久化，保持各文件在 300 行警戒线附近、不触 500 行硬阈值。子组件样式拆入 `styles/AiProfileManager.scss`（scoped）+ 共享 `styles/index.scss`（`.setting-*` 全局类由主面板 index.vue 注入，已确认可用）。
5. **交互规则（按澄清结论落地）**：

- 下拉选中 = 仅高亮选择，不改字段；
- 「应用」= 整组回填 + 单次生效，直接覆盖不确认；
- 「保存」= 取当前表单快照 + 输入名称存为新档案，同名覆盖；
- 「删除」= 移除选中档案。

6. **性能与可靠性**：档案规模小（数组快照），操作均为 O(n) 遍历/过滤，无性能热点；加解密为逐档案一次 AES-GCM 调用，量级可忽略；所有档案操作成功/失败沿用现有 `showMessage` 反馈与 `_updatePluginSettings` 错误分支，不新增日志。

## 实施要点

- 复用现有组件与样式原语：`SettingGroup`（分组+大写标签）、`Button`（`size="xsmall" variant="ghost"`）、`TextInput`、全局 `.setting-select/.setting-input/.setting-desc`；新增布局样式（档案下拉行/操作行）写入 `AiProfileManager.scss`，仅用设计 Token，禁 box-shadow、禁硬编码 px 字号。
- 档案变更（保存/删除）通过新事件 `update:profiles` 上抛至 `SuperPanelManager`，由其 `_updatePluginSettings({ aiProfiles })` 持久化（走既有加密链路）。
- i18n：只改分片文件 `src/i18n/{zh_CN,en_US}/superPanel.json`，新增键必须两端对齐；模板中每处 i18n 键渲染位置上方加中文 HTML 注释；弹出消息沿用现有脚本内直写中文的惯例。
- 兼容性：不破坏现有 `update:settings` 契约与 `AiSettings` 结构；`getApiConfigFromPlugin`、toolCollection deepSeekCost 只读引用均零改动。
- 验证（用户执行，AI 不运行）：`pnpm i18n:verify`、`npx tsc --noEmit`、`pnpm lint`。

## 架构设计

数据流：AiProfileManager（选择/操作）→ AiSettingsPanel（本地 profileList + 当前表单快照；save=构造快照、apply=整组回填本地 settings 后单次 emit `update:settings`、delete=过滤）→ SuperPanelManager（`handleUpdateAiSettings` 持久化激活字段 / 新增 `handleUpdateAiProfiles` 持久化档案列表）→ `plugin.updateSettings` → `saveSettings`（encryptSensitiveFields 扩展加密 aiProfiles）→ `plugin.saveData`。加载反向：`loadSettings` → decryptSensitiveFields 解密 → `buildAiSettingsProps` 透传 `profiles`。运行期消费链（`getApiConfigFromPlugin`）不经过档案字段，零改动。

## 目录结构

```
src/
├── types/
│   └── ai.ts                       # [MODIFY] 新增共享接口 AiProfileConfig（name + AiSettings 全字段快照），
│                                   #          供 config/settings.ts 与 superPanel 共用，避免循环依赖
├── config/
│   └── settings.ts                 # [MODIFY] PluginSettings 新增 aiProfiles: AiProfileConfig[]（DEFAULT_SETTINGS 为 []）；
│                                   #          encryptSensitiveFields/decryptSensitiveFields 增加对 aiProfiles
│                                   #          每份档案 apiKey 与 searchBochaApiKey 的 AES-GCM 加解密循环
└── features/
    └── superPanel/
        ├── types/
        │   └── index.ts            # [MODIFY] SuperPanelManager：buildAiSettingsProps 透传 profiles prop +
        │                           #          onUpdate:profiles 回调；新增 handleUpdateAiProfiles() 持久化 aiProfiles
        ├── components/
        │   ├── AiSettingsPanel.vue # [MODIFY] Props 增 profiles；本地 profileList ref 初始化；
        │   │                       #          模板增「配置档案」SettingGroup 区块；实现 saveProfile/applyProfile/
        │   │                       #          deleteProfile（应用=整组回填+单次 emit update:settings，同步 apiKeys map）
        │   └── AiProfileManager.vue # [NEW]  展示性子组件：档案下拉 + 名称输入 + 应用/保存/删除按钮行；
        │                            #          仅接收 profiles/i18n，语义事件 save(name)/apply(name)/delete(name) 上抛
        ├── styles/
        │   └── AiProfileManager.scss # [NEW] 档案区块专属样式（scoped，随子组件导入，Token 化、对齐既有 ai-settings 视觉）
        ├── README.md                # [MODIFY] 补充「AI 配置档案」能力说明（保存/应用/覆盖/删除 与数据落盘机制）
        └── src/i18n/{zh_CN,en_US}/superPanel.json
                                     # [MODIFY] 新增档案相关键（两端对齐，键数一致）
```

## 关键代码结构

- 共享类型（`src/types/ai.ts`，无运行时依赖）：

```ts
/** AI 配置档案（整套 AI 设置的命名快照，字段与 AiSettings 对应） */
export interface AiProfileConfig {
  name: string                      // 档案名称（唯一，下拉标识，同名保存=覆盖）
  provider: AiProvider
  model: string
  customModel: string
  apiKey: string
  customEndpoint: string
  enableThinking: boolean
  searchProvider: SearchProvider
  searchBochaApiKey: string
}
```

- AiProfileManager 事件契约：`emit("save", name)`、`emit("apply", name)`、`emit("delete", name)`（camelCase，均带档案名，由父组件从本地 profileList 解析具体档案，父子间无全量数据往返）。
- 持久化契约：`AiSettingsPanel` 新增 `update:profiles`（载荷为全量 AiProfileConfig[]），Manager 端直接写入 `aiProfiles` 字段，与激活字段共用 `_updatePluginSettings` 的成功/失败反馈。