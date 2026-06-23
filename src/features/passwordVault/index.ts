/**
 * 密码箱功能模块
 */
import type { Plugin } from "siyuan"
import type { PendingEntryData } from "./utils/parser"
import { ref } from "vue"
import { parsePasswordText } from "./utils/parser"

// ============================================================
// 全局状态（运行时逻辑，非类型定义）
// ============================================================

/** 弹窗显示状态 */
export const passwordVaultVisible = ref(false)

/** 待预填的条目数据（来自外部调用，如浮动工具栏"存密码"） */
export const pendingEntryData = ref<PendingEntryData | null>(null)

/** 显示密码箱弹窗 */
export function showPasswordVault() {
  passwordVaultVisible.value = true
}

/** 隐藏密码箱弹窗 */
export function hidePasswordVault() {
  passwordVaultVisible.value = false
  pendingEntryData.value = null
}

/** 切换密码箱弹窗显示状态 */
export function togglePasswordVault() {
  passwordVaultVisible.value = !passwordVaultVisible.value
}

/**
 * 打开密码箱弹窗并自动解析文本预填各字段
 * 由浮动工具栏"存密码"按钮通过事件总线间接调用
 *
 * 自动识别分隔符：`：` `:` `_` `-` `|` `,` `\t` `空格`
 * - 2 字段 → 账号 + 密码
 * - 3+ 字段 → 账号 + 密码 + 描述
 * - 1 字段 → 名称（无自动填充）
 */
export function openPasswordVaultWithText(text: string) {
  pendingEntryData.value = parsePasswordText(text)
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
