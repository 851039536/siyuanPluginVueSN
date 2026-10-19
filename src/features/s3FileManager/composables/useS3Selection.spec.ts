/**
 * S3 文件管理器多选状态 composable 测试
 *
 * 覆盖资源管理器式选择语义：单击 / Ctrl 切换 / Shift 范围 / 右键接管 / 清空，
 * 以及选中集对"当前目录可见条目"的过滤契约（跨目录残留 key 不计数）。
 */
import { describe, it, expect } from "vitest"
import { ref } from "vue"
import type { S3Entry } from "../types"
import { useS3Selection } from "./useS3Selection"

/** 构造条目的便捷工厂 */
function entry(key: string): S3Entry {
  return { name: key, key, isFolder: false, size: 0, lastModified: "" }
}

/** 模拟无修饰键的点击事件 */
function click(mods: { ctrl?: boolean; shift?: boolean; meta?: boolean } = {}): MouseEvent {
  return {
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
  } as MouseEvent
}

function setup(keys: string[]) {
  const orderedEntries = ref(keys.map(entry))
  const sel = useS3Selection({ orderedEntries })
  return { sel, orderedEntries }
}

describe("useS3Selection 选择语义", () => {
  it("普通单击单选并更新锚点", () => {
    const { sel } = setup(["a", "b", "c"])
    sel.handleItemClick(entry("a"), click())
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["a"])
    sel.handleItemClick(entry("c"), click())
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["c"])
  })

  it("ensureSelected：未选中改为单选，已选中保持现有多选", () => {
    const { sel } = setup(["a", "b", "c"])
    sel.handleItemClick(entry("a"), click({ ctrl: true }))
    sel.handleItemClick(entry("b"), click({ ctrl: true }))
    // 右键已选中项：多选保持
    sel.ensureSelected(entry("a"))
    expect(sel.selectedCount.value).toBe(2)
    // 右键未选中项：改为单选
    sel.ensureSelected(entry("c"))
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["c"])
  })

  it("Ctrl/Cmd+单击切换选中态", () => {
    const { sel } = setup(["a", "b", "c"])
    sel.handleItemClick(entry("a"), click({ ctrl: true }))
    sel.handleItemClick(entry("b"), click({ ctrl: true }))
    expect(sel.selectedCount.value).toBe(2)
    // 再 Ctrl+单击 a → 移除
    sel.handleItemClick(entry("a"), click({ ctrl: true }))
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["b"])
    // meta 键同语义（macOS）
    sel.handleItemClick(entry("c"), click({ meta: true }))
    expect(sel.selectedCount.value).toBe(2)
  })

  it("Shift+范围选择：锚点在前/在后两种方向", () => {
    const { sel } = setup(["a", "b", "c", "d"])
    sel.handleItemClick(entry("a"), click())
    sel.handleItemClick(entry("c"), click({ shift: true }))
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["a", "b", "c"])

    // 反向：锚点在后，点击在前
    sel.clearSelection()
    sel.handleItemClick(entry("d"), click())
    sel.handleItemClick(entry("b"), click({ shift: true }))
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["b", "c", "d"])
  })

  it("锚点已不在列表中时 Shift 退化为普通单选", () => {
    const { sel, orderedEntries } = setup(["a", "b", "c"])
    sel.handleItemClick(entry("a"), click())
    // 换一批列表（锚点 a 消失）
    orderedEntries.value = ["x", "y", "z"].map(entry)
    sel.handleItemClick(entry("z"), click({ shift: true }))
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["z"])
  })

  it("clearSelection 清空；跨目录残留 key 不计入 selectedCount", () => {
    const { sel, orderedEntries } = setup(["a", "b"])
    sel.handleItemClick(entry("a"), click({ ctrl: true }))
    sel.handleItemClick(entry("b"), click({ ctrl: true }))
    expect(sel.selectedCount.value).toBe(2)
    // 导航到新目录（列表整体替换），残留 key 不计数
    orderedEntries.value = ["x"].map(entry)
    expect(sel.selectedCount.value).toBe(0)
    expect(sel.isSelected("a")).toBe(true) // 集合本身未清（由宿主 watch 清理）
    sel.clearSelection()
    expect(sel.selectedCount.value).toBe(0)
    expect(sel.isSelected("a")).toBe(false)
  })

  it("selectedEntries 顺序 = 选中 key 集合的插入序（O(k) 反查实现契约）", () => {
    const { sel } = setup(["a", "b", "c"])
    sel.handleItemClick(entry("c"), click({ ctrl: true }))
    sel.handleItemClick(entry("a"), click({ ctrl: true }))
    expect(sel.selectedEntries.value.map((e) => e.key)).toEqual(["c", "a"])
  })

  it("isSelected 反映集合状态", () => {
    const { sel } = setup(["a", "b"])
    sel.handleItemClick(entry("a"), click())
    expect(sel.isSelected("a")).toBe(true)
    expect(sel.isSelected("b")).toBe(false)
  })
})
