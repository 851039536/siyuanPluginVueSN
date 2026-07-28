// git clone 实时日志缓冲（\r 原地刷新进度行、\n 换行、超限截断），供编辑弹窗克隆日志面板使用
import { ref } from "vue"

/** 日志最大保留行数（超过后丢弃最早的行，防止长输出撑爆内存） */
const MAX_LINES = 200

export function useCloneLog() {
  const lines = ref<string[]>([])
  const running = ref(false)
  /** \r 之后的下一段文本覆盖当前行（git --progress 原地刷新进度） */
  let pendingOverwrite = false

  /** 开始记录：首行显示执行的命令 */
  function start(command: string) {
    lines.value = [command, ""]
    pendingOverwrite = false
    running.value = true
  }

  /** 追加 git 原始输出块：\n 换行提交，\r 标记下段覆盖当前行 */
  function append(chunk: string) {
    const arr = lines.value
    for (const token of chunk.replace(/\r\n/g, "\n").split(/([\r\n])/)) {
      if (token === "\n") {
        arr.push("")
      } else if (token === "\r") {
        pendingOverwrite = true
      } else if (token) {
        if (pendingOverwrite) {
          arr[arr.length - 1] = token
          pendingOverwrite = false
        } else {
          arr[arr.length - 1] += token
        }
      }
    }
    if (arr.length > MAX_LINES) { arr.splice(0, arr.length - MAX_LINES) }
  }

  /** 结束：追加结果行并退出运行态（面板保留，等待用户关闭） */
  function finish(message: string) {
    append(`\n${message}`)
    running.value = false
  }

  /** 清空并隐藏日志面板 */
  function clear() {
    lines.value = []
    running.value = false
  }

  return { lines, running, start, append, finish, clear }
}
