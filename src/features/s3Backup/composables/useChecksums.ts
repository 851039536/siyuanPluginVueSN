/**
 * 备份文件校验值管理 composable
 *
 * 维护 SHA-256 校验值列表状态，提供保存（同名覆盖并移到头部）、删除单条与清空能力。
 * saveChecksum 支持 persistNow=false 批量场景只更新内存，循环结束后由调用方统一落盘。
 * 通过依赖注入的 persist 写入存储槽，不直接接触插件实例。
 */
import { ref } from "vue"
import type { FileChecksum, PersistFn } from "../types"

export function useChecksums(deps: { persist: PersistFn }) {
  const checksums = ref<FileChecksum[]>([])

  /**
   * 保存一条校验值（同名覆盖并移到头部），默认立即落盘。
   * @param persistNow 传 false 时只更新内存不落盘，供批量循环场景使用
   */
  async function saveChecksum(
    fileName: string,
    filePath: string,
    fileSize: number,
    checksum: string,
    persistNow = true,
  ): Promise<void> {
    const item: FileChecksum = {
      fileName,
      filePath,
      checksum,
      fileSize,
      time: new Date().toISOString(),
    }
    // 同名覆盖：移除旧条目后 unshift 到头部，与新增条目的"最近在前"语义一致
    const idx = checksums.value.findIndex((c) => c.fileName === fileName)
    if (idx >= 0) {
      checksums.value.splice(idx, 1)
    }
    checksums.value.unshift(item)
    if (persistNow) {
      await persistChecksums()
    }
  }

  /** 将当前内存中的校验值列表写入存储槽 */
  async function persistChecksums(): Promise<void> {
    await deps.persist((s) => s.checksums.save({ items: checksums.value }))
  }

  async function clearChecksums(): Promise<void> {
    checksums.value = []
    await persistChecksums()
  }

  async function removeOneChecksum(fileName: string): Promise<void> {
    checksums.value = checksums.value.filter((c) => c.fileName !== fileName)
    await persistChecksums()
  }

  return { checksums, saveChecksum, persistChecksums, clearChecksums, removeOneChecksum }
}
