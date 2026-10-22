// gitPush 脚本会话 Vue 桥：会话表变更映射为响应式 version 信号（弹窗/卡片角标共用）
import { ref } from "vue"
import { scriptSessions, type ScriptSession, type ScriptSessionStore } from "../managers/ScriptSessionStore"

/** 全局变更信号：会话/日志任意变更 +1，依赖它的 computed 自动重算（模块级单订阅） */
const version = ref(0)
scriptSessions.onChange(() => {
  version.value++
})

export interface UseScriptSessions {
  /** 会话变更信号（computed 内读取即可建立响应式依赖） */
  sessionVersion: typeof version
  store: ScriptSessionStore
  sessionsOf: (projectId: string) => ScriptSession[]
  sessionOf: (projectId: string, scriptId: string) => ScriptSession | undefined
  hasRunning: (projectId: string) => boolean
}

export function useScriptSessions(): UseScriptSessions {
  return {
    sessionVersion: version,
    store: scriptSessions,
    sessionsOf: (projectId: string) => {
      void version.value
      return scriptSessions.listByProject(projectId)
    },
    sessionOf: (projectId: string, scriptId: string) => {
      void version.value
      return scriptSessions.get(projectId, scriptId)
    },
    hasRunning: (projectId: string) => {
      void version.value
      return scriptSessions.hasRunningByProject(projectId)
    },
  }
}
