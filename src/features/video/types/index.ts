/**
 * 视频管理器模块 - 类型定义
 */
import { Plugin, showMessage } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"

/**
 * 视频文件信息
 */
export interface VideoInfo {
  name: string
  path: string
  category: string
  size: number
  modTime: number
}

/**
 * 加密/解密结果
 */
export interface EncryptResult {
  success: number
  failed: number
  errors: string[]
}

/**
 * FFmpeg 处理结果
 */
export interface FFmpegResult {
  success: boolean
  outputPath?: string
  error?: string
  progress?: number
}

/**
 * yt-dlp 下载结果
 */
export interface YtdlpResult {
  success: boolean
  outputPath?: string
  fileName?: string
  error?: string
  progress?: number
}

/**
 * 视频管理器配置
 */
export interface VideoManagerOptions {
  storagePath?: string
}

/**
 * 视频管理器类
 */
export class VideoManager {
  private plugin: Plugin
  /**
   * 构造时传入的配置（如自定义存储目录）。
   * 对外只读暴露：调用方/调试代码可读取当前生效配置，同时避免出现只写不读的私有字段。
   */
  public readonly options: VideoManagerOptions

  constructor(plugin: Plugin, options: VideoManagerOptions = {}) {
    this.plugin = plugin
    this.options = options
  }

  /**
   * 初始化视频管理器
   */
  public init() {
    this.addCommand()
    this.addEventListeners()
  }

  /**
   * 添加快捷键命令
   */
  private addCommand() {
    this.plugin.addCommand({
      langKey: "videoManager",
      hotkey: "⌃⌥V",
      callback: () => {
        this.openVideoManager()
      },
    })
  }

  /**
   * 添加事件监听
   */
  private addEventListeners() {
    this.plugin.eventBus.on("click-blockicon", (event: any) => {
      const { detail } = event
      if (detail.type === "video") {
        // 处理视频相关操作
        showMessage("视频功能已触发", 2000, "info")
      }
    })
  }

  /**
   * 打开视频管理器
   */
  public openVideoManager() {
    // 触发全局事件，由主插件处理
    emitCustomEvent("openVideoManager")
    showMessage("打开视频管理器", 2000, "info")
  }

  /**
   * 销毁
   */
  public destroy() {
    // 清理逻辑
  }
}

// 重新导出子模块
export {
  buildVideoPath,
  clearFFmpegPath,
  compressVideo,
  getCurrentFFmpegPath,
  isFFmpegAvailable,
  mergeVideoAudio,
  mergeVideos,
  setFFmpegPath,
} from "../utils/ffmpeg"
export {
  calculateCompressionRate,
  formatFileSize,
  getWorkspacePath,
} from "../utils/utils"
export {
  clearYtdlpPath,
  downloadVideo,
  getCurrentYtdlpPath,
  getSupportedSites,
  getYtdlpVersion,
  getVideoInfo as getYtdlpVideoInfo,
  isYtdlpAvailable,
  setYtdlpPath,
} from "../utils/ytdlp"
