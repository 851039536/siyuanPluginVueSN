// gitPush i18n 占位替换单一真源（纯叶子模块：不 import 任何桶/运行时，Node 单测可直接加载）
//
// 模板约定统一为 {0} {1} … 顺序占位（数值按序号逐个替换，只替换首个出现）。
// 历史上此逻辑有三份实现（index.vue tf() 可变参、htmlReport fmt() 单参、组件内联 .replace("{0}")），
// 占位风格漂移风险高；现统一委托本函数。

/**
 * 按序号替换模板占位：fmtTemplate("共 {0} 个文件，展示前 {1} 个", 200, 12)。
 * 无占位/无参数时原样返回；args 少于占位数时未替换占位保留（避免 undefined 泄漏）。
 */
export function fmtTemplate(template: string, ...args: (string | number)[]): string {
  let s = String(template ?? "")
  args.forEach((a, i) => {
    s = s.replace(`{${i}}`, String(a))
  })
  return s
}

/**
 * 把 AI 降级原因翻译成可操作提示。
 *
 * 旧实现只有一句「AI 未返回有效信息」：没配密钥、网络 401、输出不合规全压成同一句，
 * 用户无法判断该去填 Key、重试，还是换模型。这里按 fallback 分流，并保留无字段时的原文案兜底。
 */
export function describeAiFallback(
  result: { fallback?: string, detail?: string },
  t: (key: string, ...args: (string | number)[]) => string,
): string {
  switch (result.fallback) {
    case "no-key":
      return t("aiFallbackNoKey")
    case "no-diff":
      return t("aiFallbackNoDiff")
    case "api-error":
      return t("aiFallbackApiError", result.detail || "-")
    case "invalid-format":
      return t("aiFallbackInvalidFormat")
    default:
      // 老调用点没有 fallback 字段时的兜底文案（保留原文案，行为不退化）
      return t("aiHeuristic")
  }
}
