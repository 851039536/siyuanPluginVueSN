# AGENTS_I18N.md

思源笔记插件 — i18n 分片架构、不生效排查与文案兜底禁止规范。

## i18n 不生效问题排查

### 症状

修改 `src/i18n/zh_CN/{feature}.json` 分片文件后，思源中显示仍为旧值或空白（`undefined`），但源码中 key 已存在。

### 根因

`viteStaticCopy` + watch 模式的组合问题：分片文件修改后 watch 触发合并 → 但合并产物（`src/i18n/zh_CN.json`）可能未被 `viteStaticCopy` 可靠地复制到思源工作区目录。导致思源加载的仍是旧版合并 JSON。

### 排查三步法

用同一验证命令模板依次检查三处，key 数应一致且包含目标 key：

```bash
node -e "const j=require('<路径>'); const gp=j.gitPush||j; console.log(Object.keys(gp).length, 'refreshWorkingTree' in gp)"
```

| 步骤 | 路径 | 说明 |
|------|------|------|
| 1. 源分片 | `./src/i18n/zh_CN/gitPush.json` | 确认源文件正确（应返回完整 key 数，如 257） |
| 2. 合并文件 | `./src/i18n/zh_CN.json` | 确认合并产物与源分片一致 |
| 3. 构建产物 | `E:/siyuan2/data/plugins/siyuan-plugin-vite-vue-sn/i18n/zh_CN.json` | 思源工作区路径见 `.env` 的 `VITE_SIYUAN_WORKSPACE_PATH`；key 数不对或缺 key → 构建产物是旧的 |

### 手动修复

```bash
pnpm i18n:merge
copy /Y src\i18n\zh_CN.json "{workspace}\data\plugins\{pluginName}\i18n\zh_CN.json"
copy /Y src\i18n\en_US.json "{workspace}\data\plugins\{pluginName}\i18n\en_US.json"
```
然后**重启思源**（不是 reload 插件），让思源重新读取 i18n 文件。

### 运行时诊断

在 `GitPushManager.init()` 中添加临时日志：
```ts
console.log("[i18n debug]", {
  hasGitPush: !!pluginI18n.gitPush,
  totalKeys: Object.keys(i18n).length,
  refreshWorkingTree: i18n.refreshWorkingTree,
  workingTreeClean: i18n.workingTreeClean,
})
```
在思源 F12 控制台查看输出，确认运行时实际加载的 key 数量和具体值。

### watch 配置

`vite.config.ts` 的 `watch-external` 插件必须同时监听顶层和子目录 i18n 文件：
```ts
const files = await fg([
  "src/i18n/*.json",       // 顶层合并文件
  "src/i18n/**/*.json",    // 子目录分片文件 ← 不可缺少
  "./README*.md",
  "./plugin.json",
])
```

### 注意事项

- 合并后的 `zh_CN.json` 使用嵌套结构：`{ gitPush: { workingTreeClean: "..." } }`
- 代码中通过 `pluginI18n.gitPush || pluginI18n` 兼容嵌套/扁平两种结构
- 模板中已移除所有 `|| '硬编码中文'` 兜底值，i18n 是唯一数据源
- 本项目思源工作区路径：`E:/siyuan2/data/plugins/siyuan-plugin-vite-vue-sn/`

## 强制规则：禁止 i18n 硬编码兜底值

模板中 `{{ i18n.xxx || '中文兜底' }}` 模式**禁止使用**。i18n 是 UI 文案的唯一数据源，兜底值会掩盖 i18n 未加载/缺失的 bug。

**❌ 错误**：
```html
<span>{{ i18n.workingTreeClean || '工作区干净' }}</span>
<button :title="i18n.refreshWorkingTree || '刷新工作空间'" />
:placeholder="i18n.commitMessagePlaceholder || '输入提交信息...'"
```

**✅ 正确**：
```html
<span>{{ i18n.workingTreeClean }}</span>
<button :title="i18n.refreshWorkingTree" />
:placeholder="i18n.commitMessagePlaceholder"
```

**原因**：
- 兜底值让 i18n 加载失败变成"静默成功"，开发者永远不知道 key 不存在
- 所有文案应定义在 i18n JSON 的分片中，不在模板中重复
- 如果 i18n 有値 → 显示 i18n 值；如果无值 → 显示空白（暴露问题，及时排查）

> 此规则 2026-07-24 正式生效，从 gitPush 模块 (`WorkingTreePanel.vue`) 移除 17 处兜底值开始推广到全项目。
