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
