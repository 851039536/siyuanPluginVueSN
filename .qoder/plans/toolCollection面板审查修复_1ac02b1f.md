# toolCollection index.vue 审查修复

## 修复范围
- `src/features/toolCollection/index.vue`
- `src/features/toolCollection/types/index.ts`
- `src/i18n/zh_CN/toolCollection.json` / `src/i18n/en_US/toolCollection.json`

## 内存泄露修复（index.vue）
- `onMounted` 拆分：`window.addEventListener("keydown", handleKeydown)` 移到 `onMounted` 同步段最前（任何 `await` 之前），确保 `onBeforeUnmount` 的 `removeEventListener` 必然晚于注册执行。持久化尺寸加载放在其后。

## 尺寸持久化修复（index.vue）
- 用 `TypedStorage<number>` 替代裸 `PluginStorage.load<number>`：
  - `const widthSlot = new TypedStorage<number>(storage, "toolCollection-width", DEFAULT_WIDTH)`，height 同理（key 不变，保持已有数据兼容）。
  - `onMounted` 中 `Promise.all([widthSlot.loadOrDefault(), heightSlot.loadOrDefault()])` 并行加载，`loadOrDefault` 内置字符串数字归一化，消除 `"1140" + 80` 字符串拼接 bug。
  - 保留范围校验（500–1600 / 30–100）与"仍为默认值时才应用"守卫。
- `adjustDimension` 改调对应槽位的 `save()`，其余钳制逻辑不变。

## 硬编码文案 i18n 化
- 在 `zh_CN/toolCollection.json` 与 `en_US/toolCollection.json` 新增嵌套键（同步中英）：`toolCollectionPanel.narrower` (变窄/Narrower)、`wider` (变宽/Wider)、`shorter` (变矮/Shorter)、`taller` (变高/Taller)、`prevTool` (上一个工具 (←)/Previous tool (←))、`nextTool` (下一个工具 (→)/Next tool (→))。
- 模板中 6 处 `title` 改为绑定 i18n 键，每处按项目规范在上方添加中文 HTML 注释标明实际文案（如 `<!-- 按钮提示："变窄" -->`）。

## 冗余与类型清理（index.vue + types/index.ts）
- `tools` 由 `computed` 改为普通常量数组（无响应式依赖）。
- `i18n` 声明去掉 `|| {}` 兜底；类型收敛：不再 `as Record<string, any>`，改为 `props.plugin.i18n as Record<string, string> & { wordQuery: { title: string } }` 级别的最小断言（或在组件内定义局部接口仅声明用到的键：`toolCollection`、`base64Image`、`unitConverter`、`wordQuery.title`、`toolCollectionPanel.*`）。
- `ToolMeta.label` 保持 `string`，由上述类型收敛保证 `label` 不再可能是 `undefined`。
- 移除 `visibleRef` 镜像层：模板 `v-if` 直接用 `visible.value`（props 中 Ref 在模板需显式 `.value`），watch 仅保留"打开时 nextTick 聚焦激活 Tab"逻辑；`close()` 不变。
- `handleKeydown` 的标签排除补充 `SELECT`。

## 不改动项（说明）
- `index.ts` 的 `(plugin as any).__toolCollection` 与 command 不可反注册问题超出本次单文件审查范围，不动。
- `adjustDimension` 每次点击写存储：写入量小且 last-write-wins，不加防抖。

## 验证
- 修改后由用户自行执行：`npx tsc --noEmit`、`pnpm i18n:verify`（AI 不执行 build/lint）。