# ComparisonView.vue 审查修复

## 范围
仅修改 `src/features/statistics/components/ComparisonView.vue`（280 行，改后仍在阈值内）。不改 `reportStats.ts`、不改 i18n 分片。

## 逻辑漏洞修复

1. mergedBreakdown 改为按对齐键 Map 合并（替换 L232–246 的下标配对）：
   - 新增纯函数 `alignKey(label)`：年度 label 形如 `2024/01` 时取月份 `01` 对齐；日度 label 形如 `01/15` 时原样返回。
   - 用 Map 按 `alignKey` 合并 A/B：A 先插入（保持顺序），B 命中同键则回填 `bWords`，否则追加；`label` 取先出现的一侧。
   - 效果：年 vs 年按月正确配对、月 vs 月按日期正确配对、年 vs 月不再错误强配（各自成行）。

2. compare() 增加错误处理（L260–273）：`try/catch`，reject 时 `console.error`（与 reportStats 现有日志风格一致），`finally` 复位 loading 保留。

3. compare() 增加请求时序控制：setup 内 `let reqSeq = 0`；进入时 `const seq = ++reqSeq`，await 回填前判断 `if (seq !== reqSeq) return`，避免旧响应覆盖新结果。

## 冗余消除

1. 删除 `fmtN`（L256–258），模板两处 `fmtN(...)` 改为直接调用已导入的 `formatNumber(...)`。
2. `const i18n = computed(() => props.i18n || {})` 去掉 `|| {}`（withDefaults 已保证为对象）。
3. 抽 `getDelta(key)` 助手，`deltaClass`/`deltaText` 复用，消除重复的 `data.value?.deltas?.[key] ?? 0` 取值。

## 内存泄露
- 无。组件无定时器/监听器/DOM 引用，无需改动。

## 保留不改（审查记录）
- `deltaText` 百分比以 A 为基数，A=0 时显示 0%：语义次要，不改。
- breakdown 年 vs 月本质不可比，按键合并后各自成行为可接受的降级表现，不引入额外 UI 提示。

## 验证
- 由用户自行执行 `pnpm lint` 与 `npx tsc --noEmit`（AI 不运行）。
- 手工验证点：年 vs 年、月 vs 月、年 vs 月三种组合下 breakdown 配对与 label；数据接口 reject 时不崩溃且控制台有错误日志；快速连点对比结果与所选期间一致。
