/**
 * 速记功能 — 共享工具函数
 * 提供条目 ID 生成、持久化失败提示守卫与 AI 润色流式回填辅助，供多个 composable / 组件复用，避免复制粘贴
 */
import type { PolishFn } from "./composables/useAiPolish"
import { pushMsg } from "@/api"
import { PolishError } from "./composables/useAiPolish"

/** 生成条目唯一 ID（时间戳 + 随机串） */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 持久化失败统一提示守卫
 * 包裹一次「会写盘」的变更：失败时 console.error + 顶部消息提示。
 * 视图层的 CRUD 调用无需 await —— 写盘顺序由 QuickNoteStorage 的串行锁保证
 * @param i18n 功能文案（saveFailed 提示键）
 */
export function createPersistGuard(i18n: Record<string, string>): (task: () => Promise<void>) => void {
  return (task) => {
    task().catch((err) => {
      console.error("[quickNote] 保存失败:", err)
      pushMsg(i18n.saveFailed, 5000, "error")
    })
  }
}

/**
 * AI 润色流式回填辅助：缓存原稿 → 清空目标 → 流式回填 → 空结果/异常时恢复原稿并提示
 * 新增表单与编辑态共用，消除两处视图的 try-catch 重复代码
 * @param polish 润色函数（useAiPolish().polish）
 * @param target 目标文本 ref（传入 ref 对象，经其 value 读写）
 * @param original 润色前的原稿文本
 * @param i18n 功能文案（NO_API_KEY / 调用失败的提示键）
 */
export async function polishText(
  polish: PolishFn,
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
