/**
 * 文档分析功能 - 持久化 ref（加载 + 首次放行 + 变更自动回写）
 * 消除各持久化槽位重复的「loaded 标志 + nextTick 放行 + watch 回写」样板。
 */
import type { Ref } from "vue"
import { nextTick, ref, watch } from "vue"
import type { TypedStorage } from "@/utils/typedStorage"

interface Options<T> {
  /** 生成全新的默认值（避免与模块级常量共享引用） */
  defaultValue: () => T
  /** 加载后的兜底归一（如过滤已废弃的枚举 key） */
  normalize?: (saved: T) => T
}

/**
 * 绑定一个 TypedStorage 槽位为可持久化的 ref
 * @returns state 响应式值；load 首次加载（须在 setup 中调用，watch 随 effect scope 自动回收）
 */
export function usePersistedRef<T>(slot: TypedStorage<T>, opts: Options<T>) {
  const state = ref(opts.defaultValue()) as Ref<T>
  // 首次加载完成前跳过持久化，避免加载回填（或加载失败置空）触发回写覆盖存储
  let loaded = false

  async function load() {
    try {
      const saved = await slot.loadOrDefault()
      state.value = opts.normalize ? opts.normalize(saved) : saved
    } catch {
      state.value = opts.defaultValue()
    }
    // 等 watch 刷新完成后再放行持久化
    await nextTick()
    loaded = true
  }

  watch(state, async (val) => {
    if (!loaded) return
    try {
      await slot.save(val)
    } catch (e) {
      console.error("保存文档分析配置失败:", e)
    }
  }, { deep: true })

  return { state, load }
}
