/**
 * 速记功能 — 共享工具函数
 * 提供条目 ID 生成、串行持久化锁与 AI 润色流式回填辅助，供多个 composable / 组件复用，避免复制粘贴
 */
import { pushMsg } from "@/api"
import type { TypedStorage } from "@/utils/typedStorage"
import type { AppData } from "./types"
import { PolishError } from "./composables/useAiPolish"

/** 生成条目唯一 ID（时间戳 + 随机串） */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建串行持久化锁
 * 防止快速连续操作时 read-modify-write 读到旧数据：多个 persist 调用共享同一把锁，
 * buildPayload 接收最新存储数据并返回待写入的完整 payload（支持携带额外参数，如项目删除时跨槽写入待办）
 * @param data 统一数据存储槽（TypedStorage<AppData>）
 * @param buildPayload 构造待写入 payload 的函数
 * @returns 串行化后的持久化函数
 */
export function createPersistLock<TArgs extends unknown[]>(
  data: TypedStorage<AppData>,
  buildPayload: (current: AppData, ...args: TArgs) => AppData,
): (...args: TArgs) => Promise<void> {
  let lock: Promise<void> = Promise.resolve()
  return async (...args: TArgs) => {
    lock = lock
      .catch(() => undefined)
      .then(async () => {
        const current = await data.loadOrDefault()
        await data.save(buildPayload(current, ...args))
      })
    await lock
  }
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
