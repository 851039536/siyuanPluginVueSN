// 项目表单纯函数：标签文本解析等（编辑弹窗与单测共用）

/**
 * 解析逗号分隔的标签文本（中英文逗号均可；去空白、去重、忽略空项）
 * @param text 输入框原文
 * @returns 去重后的标签数组
 */
export function parseProjectTags(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t || seen.has(t)) return false
      seen.add(t)
      return true
    })
}
