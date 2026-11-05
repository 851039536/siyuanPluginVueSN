/**
 * 存储槽注册表 - localStorage 键
 *
 * 白名单：只允许这些键；不得用 localStorage 存业务数据。
 */
import { localStorageSlot } from "./helpers"

export const LOCAL_STORAGE_SLOTS = [
  localStorageSlot("core.featureFlagsLocal", ["core"], "sn-plugin-feature-flags", "功能开关降级缓存", {
    exportable: false,
    resettable: false,
    notes: "文件落盘失败时的降级副本；不是事实源",
  }),
  localStorageSlot("video.ytdlpPath", ["video"], "siyuan-ytdlp-path", "yt-dlp 路径"),
  localStorageSlot("video.ffmpegPath", ["video"], "siyuan-ffmpeg-path", "ffmpeg 路径"),
] as const
