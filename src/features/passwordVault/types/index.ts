/**
 * 密码箱类型定义和注册函数
 */
import { Plugin } from "siyuan";
import { ref } from "vue";

// ============================================================
// 类型定义
// ============================================================

/**
 * 运行时密码条目（密码已解密，仅在内存中）
 */
export interface PasswordEntry {
	id: string; // 唯一标识
	category: string; // 类别
	name: string; // 名称
	account: string; // 账号
	password: string; // 密码（明文，仅在登录后存在于内存）
	description: string; // 描述
	createdAt: number; // 创建时间
	updatedAt: number; // 更新时间
}

/**
 * 存储的加密密码条目（持久化存储）
 */
export interface StoredPasswordEntry {
	id: string;
	category: string;
	name: string;
	account: string;
	encryptedPassword: string; // 加密后的密码
	iv: string; // 初始化向量 (Base64)
	description: string;
	createdAt: number;
	updatedAt: number;
}

/**
 * 密码分类
 */
export interface PasswordCategory {
	id: string; // 分类ID
	name: string; // 分类名称
	color: string; // 分类颜色
}

/**
 * 密码提示设置
 */
export interface PasswordHint {
	hint: string; // 密码提示文本
}

// ============================================================
// 全局状态
// ============================================================

/**
 * 弹窗显示状态
 */
export const passwordVaultVisible = ref(false);

/**
 * 显示密码箱弹窗
 */
export function showPasswordVault() {
	passwordVaultVisible.value = true;
}

/**
 * 隐藏密码箱弹窗
 */
export function hidePasswordVault() {
	passwordVaultVisible.value = false;
}

/**
 * 切换密码箱弹窗显示状态
 */
export function togglePasswordVault() {
	passwordVaultVisible.value = !passwordVaultVisible.value;
}

// ============================================================
// 注册函数
// ============================================================

/**
 * 注册密码箱功能
 */
export function registerPasswordVault(plugin: Plugin) {
	// 注册快捷键命令
	plugin.addCommand({
		langKey: "passwordVault",
		langText: "密码箱",
		hotkey: "⌃⌥W", // Ctrl+Alt+W
		callback: () => {
			showPasswordVault();
		},
	});
}

// 导出存储管理
export { PasswordVaultStorage, STORAGE_KEYS } from "./storage";
