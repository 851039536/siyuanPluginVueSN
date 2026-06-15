/**
 * 密码箱功能模块
 */
import type { Plugin } from "siyuan"
import { ref } from "vue"

// ============================================================
// 全局状态（运行时逻辑，非类型定义）
// ============================================================

/** 弹窗显示状态 */
export const passwordVaultVisible = ref(false)

/** 待预填的名称（来自外部调用，如浮动工具栏） */
export const pendingEntryName = ref("")

/** 显示密码箱弹窗 */
export function showPasswordVault() {
  passwordVaultVisible.value = true
}

/** 隐藏密码箱弹窗 */
export function hidePasswordVault() {
  passwordVaultVisible.value = false
  pendingEntryName.value = ""
}

/** 切换密码箱弹窗显示状态 */
export function togglePasswordVault() {
  passwordVaultVisible.value = !passwordVaultVisible.value
}

/**
 * 打开密码箱弹窗并预填名称字段
 * 由浮动工具栏"存密码"按钮通过事件总线间接调用
 */
export function openPasswordVaultWithText(text: string) {
  pendingEntryName.value = text
  passwordVaultVisible.value = true
}

// ============================================================
// 功能注册
// ============================================================

/**
 * 注册密码箱功能
 */
export function registerPasswordVault(plugin: Plugin) {
  plugin.addCommand({
    langKey: "passwordVault",
    langText: "密码箱",
    hotkey: "⌃⌥W", // Ctrl+Alt+W
    callback: () => {
      showPasswordVault()
    },
  })
}
