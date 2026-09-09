/**
 * S3Backup 模块级单例持有
 *
 * 集中存放唯一实例引用与访问器，断开 index.ts（类定义）与 index.vue/各 composable
 * （实例消费）之间的循环依赖；实例生命周期仍由 registerS3Backup/destroy 管理。
 */
import type { S3Backup } from "./index"

let s3BackupInstance: S3Backup | null = null

/** 获取当前 S3Backup 实例（供 Vue 面板与 composable 查询状态/复用存储） */
export function getS3BackupInstance(): S3Backup | null {
  return s3BackupInstance
}

/** 设置当前 S3Backup 实例（仅由 registerS3Backup 注册与 destroy 清理调用） */
export function setS3BackupInstance(instance: S3Backup | null): void {
  s3BackupInstance = instance
}
