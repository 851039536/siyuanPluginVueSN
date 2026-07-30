/**
 * S3 协议层纯函数（再导出垫片）
 *
 * 实现已提升至 @/utils/s3/s3Protocol 供多功能模块共用，
 * 本文件保留原路径再导出，使 s3Backup 模块内既有 import 零改动。
 */
export * from "@/utils/s3/s3Protocol"
