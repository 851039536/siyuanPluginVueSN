/**
 * 速记功能 — 灵感速记 composable
 * 承载灵感条目的响应式列表与 CRUD、标签提取/筛选，支持按标签过滤灵感列表
 */
import type { Ref } from "vue"
import type { QuickNoteStorage } from "../types/storage"
import type { InspirationItem } from "../types"
import { computed, ref } from "vue"

/** 生成条目唯一 ID（时间戳 + 随机串） */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 标签输入：按逗号/顿号/空格拆分并去重去空 */
export function splitTags(input: string): string[] {
  const set = new Set<string>()
  input
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => set.add(s))
  return Array.from(set)
}

export function useInspirations(storage: QuickNoteStorage) {
  const inspirations: Ref<InspirationItem[]> = ref([])
  /** 当前选中的筛选标签（null = 全部） */
  const activeTag = ref<string | null>(null)

  /** 从存储加载全部灵感 */
  const load = async () => {
    const data = await storage.data.loadOrDefault()
    inspirations.value = data.inspirations
  }

  /** 持久化当前灵感列表（动作级保存） */
  const persist = async () => {
    const data = await storage.data.loadOrDefault()
    await storage.data.save({ ...data, inspirations: inspirations.value })
  }

  /** 新增灵感（空内容忽略），tags 为原始字符串（自动拆分） */
  const add = async (content: string, tagsInput: string = "") => {
    const trimmed = content.trim()
    if (!trimmed) return
    const now = Date.now()
    const item: InspirationItem = {
      id: generateId(),
      content: trimmed,
      tags: splitTags(tagsInput),
      createdAt: now,
      updatedAt: now,
    }
    inspirations.value = [item, ...inspirations.value]
    await persist()
  }

  /** 更新灵感内容与标签（tags 为原始字符串，自动拆分） */
  const update = async (id: string, content: string, tagsInput: string) => {
    const item = inspirations.value.find((i) => i.id === id)
    if (!item) return
    item.content = content.trim()
    item.tags = splitTags(tagsInput)
    item.updatedAt = Date.now()
    await persist()
  }

  /** 删除灵感 */
  const remove = async (id: string) => {
    inspirations.value = inspirations.value.filter((i) => i.id !== id)
    await persist()
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
