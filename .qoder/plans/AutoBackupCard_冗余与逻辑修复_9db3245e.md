# AutoBackupCard 冗余与逻辑修复

## 摘要
审查发现 3 类冗余（i18n 兜底、v-model 样板、缺失中文注释）+ 2 处逻辑风险（keepBackupCount 无防护、backupTime 无格式提示）。涉及 2 个文件：`AutoBackupCard.vue` 及其父组件 `s3Backup/index.vue` 的绑定处。

## AutoBackupCard.vue 修改

### 删除 i18n 硬编码兜底（13 处）
- 模板中 `{{ i18n.xxx || "中文" }}` 全部改为 `{{ i18n.xxx }}`（涉及 autoBackupSettings / autoBackup / backupFrequency / backupTime / keepBackupCount / keepBackupCountHint / autoBackupEnabledHint / autoBackupDisabledHint 8 处）
- 脚本中 `autoBackupOptions` / `frequencyOptions` 的 `props.i18n.xxx || "中文"` 兜底删除（disabled / enabled / everyMinute / everyHour / everyDay 5 处）
- 所有键已核实存在于 `src/i18n/{zh_CN,en_US}/s3Backup.json`，无需改 i18n 文件

### defineModel 重构（消除样板）
- 4 个双向 prop 改为 `defineModel`：
  ```ts
  const autoBackupEnabled = defineModel<boolean>("autoBackupEnabled", { required: true })
  const backupFrequency = defineModel<string>("backupFrequency", { required: true })
  const backupTime = defineModel<string>("backupTime", { required: true })
  const keepBackupCount = defineModel<number>("keepBackupCount", { required: true })
  ```
- `defineProps` 仅保留 `i18n`；整个 `defineEmits` 块删除
- 模板中 Select/Input 改为 `v-model` 直绑（backupTime、frequency、enabled 三处），消除 `$event as xxx` 断言

### keepBackupCount 数值防护（逻辑修复）
- 保留份数 Input 不直接 v-model，改为显式处理：`@update:model-value="keepBackupCount = sanitizeKeepCount($event)"`
- 新增本地纯函数：`Number()` 转换后 `Math.floor`，非有限数或 < 1 时回退为 1，防止 NaN/0 持久化后导致本地备份保留清理失效或误删全部记录（下游 `index.vue` L590 比较逻辑）

### backupTime 格式提示
- Input 增加 `placeholder="03:00"`（Input.vue 已支持该 prop），调度器侧已有 B19 格式校验兜底，UI 不做强校验以免破坏受控输入的键入体验

### 注释与格式
- 每处 i18n 渲染点上方添加中文 HTML 注释（如 `<!-- 行内标签："自动备份" -->`），主要结构区块加区块注释
- 修正 L33-39 保留份数 Input 块的多余缩进

## s3Backup/index.vue 修改（L155-165）
- `AutoBackupCard` 绑定改为：
  ```
  v-model:auto-backup-enabled="autoBackupEnabled"
  @update:auto-backup-enabled="saveWorkspaceSettings()"
  ```
  其余 3 个字段同样处理（v-model + update 监听触发保存，两者可共存）

## 验证
- `npx tsc --noEmit` 类型检查（lint / build 由用户自行执行）
- 手动确认：清空保留份数输入 → 值钳制为 1 而非 NaN/0

## 不改动项
- `<style scoped>` 双行 @use 符合 feature 内统一约定
- 频率值 minute/hourly/daily 与调度器 switch 分支已对齐
- i18n 分片文件无需变更