// AI 生成消息自动同步到本地输入（消除 WorkingTreePanel + StashSection 重复 watch 模式）
import type { Ref } from "vue"
import { watch } from "vue"

/** 监听 AI 生成的消息，有值时自动填入目标 ref */
export function useGeneratedMsgSync(generatedMsg: Ref<string>, target: Ref<string>) {
  watch(generatedMsg, (msg) => {
    if (msg) target.value = msg
  })
}
