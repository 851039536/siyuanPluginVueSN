// Web Storage 安全读写（无存储能力 / 隐私模式 / 配额限制时静默降级）
//
// 收敛前各弹窗各自写 try/catch，语义一致但容易漏掉其中一侧；
// 统一入口后调用方只需处理「读到 null 就是没有」这一种情况。
// session：会话内记忆（关闭应用即失效）；local：跨启动的界面偏好（展开态 / 上次位置等）。

/** 读取会话级字符串（不可用或抛错时返回 null） */
export function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** 写入会话级字符串（不可用或抛错时静默忽略，不影响功能） */
export function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // 无存储能力（隐私模式）：仅本次会话内生效
  }
}

/** 读取本地持久化字符串（不可用或抛错时返回 null） */
export function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 写入本地持久化字符串（不可用或超配额时静默忽略，不影响功能） */
export function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 无存储能力 / 配额已满：本次设置不持久化，界面行为不受影响
  }
}
