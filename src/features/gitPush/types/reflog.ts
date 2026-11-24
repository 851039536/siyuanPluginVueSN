// reflog 读模型（F6 reflog 浏览器 / 恢复丢失提交）
export interface RefLogEntry {
  /** 完整提交 hash（40 位） */
  hash: string
  /** reflog 说明（如 `commit: 修复登录` / `reset: moving to abc1234`） */
  subject: string
  /** 选择器（`HEAD@{2026-11-24 09:00:00 +0800}`，已按 --date=iso 展开） */
  selector: string
}
