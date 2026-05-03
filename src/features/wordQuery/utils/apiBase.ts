/**
 * wordQuery API 基础模块
 * 现已迁移至 @/utils/aiApi 统一模块，此处保留重新导出以保持向后兼容
 */
export {
  callAI as callAPI,
  extractResponseText,
  getApiConfigFromPlugin,
} from "@/utils/aiApi";
export type { AiApiConfig as ApiConfig } from "@/types/ai";
