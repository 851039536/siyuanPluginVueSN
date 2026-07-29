# FileChecksumsCard 冗余与逻辑修复

## 摘要
审查发现 6 处逻辑缺陷、5 处规范违规、3 处冗余，集中修复于 `src/features/s3Backup/components/FileChecksumsCard.vue`，附带 i18n 分片与 SCSS 小改。

## 逻辑修复（FileChecksumsCard.vue）

- 新增 `clearDropResults()`：同时清空 `droppedResults` / `compareSelects` / `compareResults`，替换模板中 `@click="droppedResults = []"`（修复清空后旧比对状态污染新拖放结果的 bug）；`onDrop` 内 push 新结果时按新 index 不残留旧状态。
- `v-for` 拖放结果改用 `:key="index"`（与按 index 存储的 compare 状态保持一致，消除同文件重复拖放的 key 冲突）。
- 验证状态清理：`watch(() => props.storedItems, ...)` 中剔除 `verifyResults` / `verifyingItems` 里已不存在于列表的 fileName 键；已出结果的条目徽章旁保留"验证"按钮（把 L96 的 `v-if === undefined` 改为始终渲染按钮 + 徽章并列），支持单条重验。
- `getManager()` 用 try/catch 包裹 `new BackupManager()`，构造抛错时 `showMessage(getErrorMessage(err))` 并返回 null；`onDrop` 中 manager 为 null 且 `workspaceRoot` 为空时提示改用已有键 `i18n.noWorkspace`。
- `verifyAll` 期间禁用单条验证按钮（`:disabled="verifyingItems[...] || isVerifyingAll"`）。
- `onDragEnter` 补 `isDragging.value = true`；`onDragOver` 去掉重复赋值只保留 `dropEffect`；`resolveDropPath` 头注释删去不存在的"文件选择器兜底"描述。

## 规范修复

- 删除全部 i18n 兜底：`i18n.verify || "验证"`、`match`、`mismatch`、`removeChecksum`、`confirmRemoveChecksum`、`confirmClearAll` 共 6 处（键均已存在）。
- 硬编码文案入 i18n：新增键 `hashCopied`（"SHA-256 已复制" / "SHA-256 copied"）到 `src/i18n/{zh_CN,en_US}/s3Backup.json`；L261 错误分支改用 `noWorkspace` 或 `getErrorMessage(err)`，不再硬编码。
- 图标替换：L16 `📂` 改为 `@iconify/vue` 的 `<Icon icon="mdi:folder-open-outline">`（COMMON_ICONS/已注册集内，必要时在 `src/config/icons.ts` 注册后运行 validate）；L89 `&#9432;` 改为 `mdi:information-outline`。
- `(file as any).path` 改为局部类型 `(file as File & { path?: string }).path`。
- 模板各 i18n 渲染处补中文注释（如 `<!-- 按钮："验证全部" -->`），主要区块注释已有、保持。

## 冗余清理

- `verifyResults.value = { ...verifyResults.value, [k]: v }` 等 5 处展开拷贝改为直接下标赋值（Vue 3 响应式支持）。
- SCSS `FileChecksumsCard.scss`：合并两处 `.drop-result-item` 选择器；emoji 移除后删除 `.drop-zone-icon` 的硬编码 `font-size: 28px`（改 Icon 尺寸经 token 或 width 控制）；`.drop-zone` 去掉无对应交互的 `cursor: pointer`。

## 验证

- `npx tsc --noEmit`、`pnpm i18n:verify`、`pnpm validate:icons`（若新注册图标）。
- `pnpm lint` / `pnpm build` 由用户自行执行。

## 假设

- 保留子组件自建 `cachedManager`（含 workspaceRoot 变化重建），不改为父传 `backupManager` prop——父实例生命周期由 `initBackupManager` 控制，改造收益低、影响面大，本次不动。
- 原生 `confirm()` 与原生 `<select class="compare-select">` 为 s3Backup 模块现有统一做法（多处同款），本次不替换。
- `.checksum-hash-value` 的 `border-radius: 3px` / `padding: 1px` 等历史硬编码不在本次范围。