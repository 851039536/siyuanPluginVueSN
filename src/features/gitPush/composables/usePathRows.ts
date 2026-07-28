// 多设备路径行编辑共享逻辑（Add/Edit 弹窗复用：行增删、目录选择、持久化载荷构建）
import type { ProjectPathExtras } from "../types"
import { computed, ref } from "vue"
import { pickDirectory } from "@/utils/electronDialog"
import { getCurrentDeviceName } from "../utils"

/** 路径行：path 为路径，device 为可选的设备电脑名标注（旧数据无映射时为空串，向后兼容） */
export interface PathRow {
  path: string
  device: string
}

/** 路径行持久化载荷（主路径 + 备选路径 + 设备名映射） */
export interface PathRowsPayload extends ProjectPathExtras {
  path: string
}

export function usePathRows(pickTitle: () => string) {
  const rows = ref<PathRow[]>([])

  /** 初始化为单个空行（设备名预填当前电脑名，用于添加弹窗） */
  function initEmpty() {
    rows.value = [{ path: "", device: getCurrentDeviceName() }]
  }

  /** 从已有项目数据回填（主路径 + localPaths + 设备名映射，用于编辑弹窗） */
  function initFrom(path: string, localPaths?: string[], pathDevices?: Record<string, string>) {
    rows.value = [path, ...(localPaths || [])].map((p) => ({
      path: p,
      device: pathDevices?.[p] || "",
    }))
  }

  /** 新增路径行（自动填入当前设备电脑名） */
  function addRow() {
    rows.value = [...rows.value, { path: "", device: getCurrentDeviceName() }]
  }

  /** 移除路径行（至少保留一行） */
  function removeRow(idx: number) {
    if (rows.value.length <= 1) { return }
    rows.value = rows.value.filter((_, i) => i !== idx)
  }

  /** 目录选择器直接写入指定行 */
  async function pickRow(idx: number) {
    const dir = await pickDirectory(pickTitle())
    if (dir) { rows.value[idx].path = dir }
  }

  /** 是否至少存在一条有效路径（驱动提交按钮禁用态） */
  const hasValidPath = computed(() => rows.value.some((r) => r.path.trim()))

  /**
   * trim 过滤空行 → 构建持久化载荷；无有效路径时返回 null
   * 首行为主路径，其余进 localPaths；仅保留非空设备名标注（路径被编辑后键自动跟随）
   */
  function toPayload(): PathRowsPayload | null {
    const entries = rows.value
      .map((e) => ({ path: e.path.trim(), device: e.device.trim() }))
      .filter((e) => e.path)
    if (entries.length === 0) { return null }
    const pathDevices: Record<string, string> = {}
    for (const e of entries) {
      if (e.device) { pathDevices[e.path] = e.device }
    }
    return {
      path: entries[0].path,
      localPaths: entries.length > 1 ? entries.slice(1).map((e) => e.path) : undefined,
      pathDevices: Object.keys(pathDevices).length > 0 ? pathDevices : undefined,
    }
  }

  return { rows, initEmpty, initFrom, addRow, removeRow, pickRow, hasValidPath, toPayload }
}
