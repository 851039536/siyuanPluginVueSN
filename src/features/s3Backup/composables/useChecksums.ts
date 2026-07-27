/**
 * 备份文件校验值管理 composable
 *
 * 维护 SHA-256 校验值列表状态，提供保存（同名覆盖）、删除单条与清空能力。
 * 通过依赖注入的 persist 写入存储槽，不直接接触插件实例。
 */
import { ref } from "vue"
import type { FileChecksum, S3BackupStorage } from "../types"

/** 依赖注入：持久化辅助由 index.vue 提供（统一「获取实例 → 存储槽 save」样板） */
export interface ChecksumsDeps {
  persist: (save: (storage: S3BackupStorage) => Promise<unknown>) => Promise<void>
}

export function useChecksums(deps: ChecksumsDeps) {
  const checksums = ref<FileChecksum[]>([])

  /** 保存一条校验值（同名覆盖）并持久化 */
  function saveChecksum(fileName: string, filePath: string, fileSize: number, checksum: string): void {
    const item: FileChecksum = {
      fileName,
      filePath,
      checksum,
      fileSize,
      time: new Date().toISOString(),
    }
    // 同名覆盖
    const idx = checksums.value.findIndex((c) => c.fileName === fileName)
    if (idx >= 0) {
      checksums.value[idx] = item
    } else {
      checksums.value.unshift(item)
    }
    saveChecksums()
  }

  async function saveChecksums(): Promise<void> {
    await deps.persist((s) => s.checksums.save({ items: checksums.value }))
  }

  async function clearChecksums(): Promise<void> {
    checksums.value = []
    await saveChecksums()
  }

  async function removeOneChecksum(fileName: string): Promise<void> {
    checksums.value = checksums.value.filter((c) => c.fileName !== fileName)
    await saveChecksums()
  }

  return { checksums, saveChecksum, clearChecksums, removeOneChecksum }
}
