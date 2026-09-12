/**
 * S3Backup 模块级单例持有
 *
 * 集中存放唯一实例引用与访问器，断开 index.ts（类定义）与 index.vue/各 composable
 * （实例消费）之间的循环依赖；实例生命周期仍由 registerS3Backup/destroy 管理。
 * 另提供共用的存储持久化辅助，消除面板与编排层的重复实现。
 */
import type { S3Backup } from "./index"
import type { PersistFn } from "./types"

let s3BackupInstance: S3Backup | null = null

/** 获取当前 S3Backup 实例（供 Vue 面板与 composable 查询状态/复用存储） */
export function getS3BackupInstance(): S3Backup | null {
  return s3BackupInstance
}

/** 设置当前 S3Backup 实例（仅由 registerS3Backup 注册与 destroy 清理调用） */
export function setS3BackupInstance(instance: S3Backup | null): void {
  s3BackupInstance = instance
}

/**
 * 持久化辅助：统一「获取实例 → 存储槽 save」样板。
 * 供 index.vue（日志/校验值）与 useBackupOrchestrator（备份历史/上传来源映射）共用。
 */
export const persistS3BackupStorage: PersistFn = async (save) => {
  const instance = getS3BackupInstance()
  if (instance) { await save(instance.getStorage()) }
}
