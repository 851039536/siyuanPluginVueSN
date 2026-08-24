/**
 * 文档分析功能 - 平台元数据模块级响应式单例
 */
import { ref } from "vue"
import type { PlatformMeta } from "../types/index"
import { DEFAULT_PLATFORM_META } from "../types/index"

/** 平台元数据（模块级响应式单例，供统计/列表/辅助面板共享） */
export const PLATFORM_META = ref<PlatformMeta[]>([...DEFAULT_PLATFORM_META])
