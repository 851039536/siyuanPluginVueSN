/**
 * 速记功能 — 灵感速记 composable
 * 承载灵感条目的响应式列表与 CRUD、标签提取/筛选，支持按标签过滤灵感列表
 */
import type { Ref } from "vue"
import type {
  AppData,
  InspirationItem,
} from "../types"
import type { QuickNoteStorage } from "../types/storage"
import {
  computed,
  ref,
} from "vue"
import { splitTags } from "../pureUtils"
import {
  createPersistGuard,
  generateId,
} from "../utils"

/** useInspirations 返回结构（供子组件 props 类型引用） */
export type InspirationsApi = ReturnType<typeof useInspirations>

export function useInspirations(storage: QuickNoteStorage, i18n: Record<string, string>) {
  const inspirations: Ref<InspirationItem[]> = ref([])
  /** 当前选中的筛选标签（null = 全部） */
  const activeTag = ref<string | null>(null)

  /** 写盘失败统一提示（视图层无需 await，写盘顺序由存储层串行锁保证） */
  const runPersist = createPersistGuard(i18n)

  /** 持久化当前灵感列表（QuickNoteStorage 串行锁与待办/项目共享，避免并发覆盖丢更新） */
  const persist = () => storage.mutate((data) => ({
    ...data,
    inspirations: inspirations.value,
  }))

  /**
   * 加载灵感列表
   * @param snapshot 面板挂载时统一读取的数据快照；缺省时自行读取（兼容独立调用）
   */
  const load = async (snapshot?: AppData) => {
    const data = snapshot ?? await storage.loadAll()
    inspirations.value = data.inspirations
  }

  /** 新增灵感（空内容忽略），tags 为原始字符串（自动拆分） */
  const add = (content: string, tagsInput: string = ""): void => {
    const trimmed = content.trim()
    if (!trimmed) return
    const ts = Date.now()
    const item: InspirationItem = {
      id: generateId(),
      content: trimmed,
      tags: splitTags(tagsInput),
      createdAt: ts,
      updatedAt: ts,
    }
    inspirations.value = [item, ...inspirations.value]
    runPersist(persist)
  }

  /** 更新灵感内容与标签（tags 为原始字符串，自动拆分） */
  const update = (id: string, content: string, tagsInput: string): void => {
    const item = inspirations.value.find((i) => i.id === id)
    if (!item) return
    item.content = content.trim()
    item.tags = splitTags(tagsInput)
    item.updatedAt = Date.now()
    runPersist(persist)
  }

  /** 删除灵感 */
  const remove = (id: string): void => {
    inspirations.value = inspirations.value.filter((i) => i.id !== id)
    runPersist(persist)
  }

  /** 全量标签（去重 + 按出现频次降序） */
  const allTags = computed(() => {
    const count = new Map<string, number>()
    inspirations.value.forEach((i) => {
      i.tags.forEach((tag) => count.set(tag, (count.get(tag) ?? 0) + 1))
    })
    return Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  })

  /** 当前筛选结果：按 activeTag 过滤，新建的排前面 */
  const filteredInspirations = computed(() =>
    inspirations.value
      .filter((i) => !activeTag.value || i.tags.includes(activeTag.value))
      .sort((a, b) => b.createdAt - a.createdAt),
  )

  return {
    inspirations,
    activeTag,
    allTags,
    filteredInspirations,
    load,
    add,
    update,
    remove,
  }
}
