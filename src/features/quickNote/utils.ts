/**
 * 速记功能 — 共享工具函数
 * 提供条目 ID 生成与 AI 润色流式回填辅助，供多个 composable / 组件复用，避免复制粘贴
 */
import { pushMsg } from "@/api"
import { PolishError } from "./composables/useAiPolish"

/** 生成条目唯一 ID（时间戳 + 随机串） */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * AI 润色流式回填辅助：缓存原稿 → 清空目标 → 流式回填 → 空结果/异常时恢复原稿并提示
 * 新增表单与编辑态共用，消除两处视图的 try-catch 重复代码
 * @param polish 润色函数（useAiPolish().polish）
 * @param target 目标文本 ref（新增表单 content 或编辑态 editDraft）
 * @param original 润色前的原稿文本
 * @param i18n 功能文案（NO_API_KEY / 调用失败的提示键）
 */
export async function polishText(
  polish: (text: string, onChunk?: (chunk: string) => void) => Promise<string>,
  target: { value: string },
  original: string,
  i18n: Record<string, string>,
): Promise<void> {
  try {
    target.value = ""
    const result = await polish(original, (chunk) => {
      target.value += chunk
    })
    // AI 返回空文本视为失败，恢复原稿
    if (!result.trim()) {
      target.value = original
    }
  } catch (err) {
    target.value = original
    if (err instanceof PolishError && err.code === "NO_API_KEY") {
      pushMsg(i18n.polishNoApiKey, 5000, "info")
    } else {
      pushMsg(i18n.polishFailed, 5000, "error")
    }
  }
}
