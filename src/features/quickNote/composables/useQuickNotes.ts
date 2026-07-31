/**
 * 速记功能 — 数据流 composable
 * 承载速记条目的响应式列表与增/删/改/勾选逻辑，每次变更后动作级持久化
 */
import type { Ref } from "vue"
import type { QuickNoteFilter, QuickNoteItem } from "../types"
import type { QuickNoteStorage } from "../types/storage"
import { computed, ref } from "vue"

/** 生成条目唯一 ID（时间戳 + 随机串） */
function generateNoteId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useQuickNotes(storage: QuickNoteStorage) {
  const notes: Ref<QuickNoteItem[]> = ref([])
  const filter: Ref<QuickNoteFilter> = ref("pending")

  // 当前视图的条目（新建的排前面）
  const filteredNotes = computed(() =>
    notes.value
      .filter((n) => (filter.value === "done" ? n.done : !n.done))
      .sort((a, b) => b.createdAt - a.createdAt),
  )

  const pendingCount = computed(() => notes.value.filter((n) => !n.done).length)
  const doneCount = computed(() => notes.value.filter((n) => n.done).length)

  /** 从存储加载全部条目 */
  const load = async () => {
    notes.value = await storage.notes.loadOrDefault()
  }

  /** 持久化当前列表（动作级保存，无需防抖） */
  const persist = async () => {
    await storage.notes.save(notes.value)
  }

  /** 新增速记（空白内容忽略） */
  const add = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const now = Date.now()
    notes.value = [
      {
        id: generateNoteId(),
        content: trimmed,
        done: false,
        createdAt: now,
        updatedAt: now,
      },
      ...notes.value,
    ]
    await persist()
  }

  /** 更新条目内容（编辑确认时调用） */
  const update = async (id: string, content: string) => {
    const note = notes.value.find((n) => n.id === id)
    if (!note) return
    note.content = content.trim()
    note.updatedAt = Date.now()
    await persist()
  }

  /** 切换完成/待完成状态 */
  const toggleDone = async (id: string) => {
    const note = notes.value.find((n) => n.id === id)
    if (!note) return
    note.done = !note.done
    note.updatedAt = Date.now()
    await persist()
  }

  /** 删除条目 */
  const remove = async (id: string) => {
    notes.value = notes.value.filter((n) => n.id !== id)
    await persist()
  }

  return {
    notes,
    filter,
    filteredNotes,
    pendingCount,
    doneCount,
    load,
    add,
    update,
    toggleDone,
    remove,
  }
}
