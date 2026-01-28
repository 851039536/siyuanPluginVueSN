/**
 * 密码箱功能模块
 */
import { Plugin } from 'siyuan'
import { ref } from 'vue'

// 弹窗显示状态
export const passwordVaultVisible = ref(false)

/**
 * 显示密码箱弹窗
 */
export function showPasswordVault() {
  passwordVaultVisible.value = true
}

/**
 * 隐藏密码箱弹窗
 */
export function hidePasswordVault() {
  passwordVaultVisible.value = false
}

/**
 * 切换密码箱弹窗显示状态
 */
export function togglePasswordVault() {
  passwordVaultVisible.value = !passwordVaultVisible.value
}

/**
 * 注册密码箱功能
 */
export function registerPasswordVault(plugin: Plugin) {
  // 注册快捷键命令
  plugin.addCommand({
    langKey: 'passwordVault',
    langText: '密码箱',
    hotkey: '⌃⌥W', // Ctrl+Alt+W
    callback: () => {
      showPasswordVault()
    }
  })
}
