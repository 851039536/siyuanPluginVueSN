/**
 * S3 兼容存储客户端（再导出垫片）
 *
 * 实现已提升至 @/utils/s3/s3Client 供多功能模块共用，
 * 本文件保留原路径再导出，使 s3Backup 模块内既有 import 零改动。
 */
export { S3Client } from "@/utils/s3/s3Client"
