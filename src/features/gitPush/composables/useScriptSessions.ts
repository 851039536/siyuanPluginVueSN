// gitPush 脚本会话 Vue 桥：会话表变更映射为响应式信号（弹窗/卡片角标共用）
import { ref } from "vue"
import {
  scriptSessions,
  type ScriptSession,
  type ScriptSessionState,
  type ScriptSessionStore,
} from "../managers/ScriptSessionStore"

/** 全局变更信号（含日志追加）：日志镜像类消费方使用，配合节流 */
const version = ref(0)
/** 状态变更信号（启动/停止/退出/淘汰）：卡片角标、行状态等高频路径使用，日志追加不触发 */
const statusVersion = ref(0)
scriptSessions.onChange(() => {
  version.value++
})
scriptSessions.onStatusChange(() => {
  statusVersion.value++
})

export interface UseScriptSessions {
  /** 会话任意变更信号（computed 内读取即可建立响应式依赖） */
  sessionVersion: typeof version
  /** 会话状态变更信号（不含日志追加） */
  statusVersion: typeof statusVersion
  store: ScriptSessionStore
  sessionsOf: (projectId: string) => ScriptSession[]
  sessionOf: (projectId: string, scriptId: string) => ScriptSession | undefined
  /** 轻量状态（不含日志 join） */
  stateOf: (projectId: string, scriptId: string) => ScriptSessionState | undefined
  hasRunning: (projectId: string) => boolean
}

export function useScriptSessions(): UseScriptSessions {
  return {
    sessionVersion: version,
    statusVersion,
    store: scriptSessions,
    sessionsOf: (projectId: string) => {
      void version.value
      return scriptSessions.listByProject(projectId)
    },
    sessionOf: (projectId: string, scriptId: string) => {
      void version.value
      return scriptSessions.get(projectId, scriptId)
    },
    stateOf: (projectId: string, scriptId: string) => {
      void statusVersion.value
      return scriptSessions.getState(projectId, scriptId)
    },
    hasRunning: (projectId: string) => {
      void statusVersion.value
      return scriptSessions.hasRunningByProject(projectId)
    },
  }
}
