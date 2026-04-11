import type { Plugin } from "siyuan";

let globalPassword: string | null = null;
const GLOBAL_PASSWORD_KEY = "global-password";
export const SUPER_PASSWORD = "kaiouyang";

export async function loadGlobalPassword(plugin: Plugin) {
	try {
		globalPassword = await plugin.loadData(GLOBAL_PASSWORD_KEY);
	} catch (error) {
		console.error("加载全局密码失败:", error);
	}
}

export async function saveGlobalPassword(plugin: Plugin, password: string) {
	try {
		await plugin.saveData(GLOBAL_PASSWORD_KEY, password);
		globalPassword = password;
	} catch (error) {
		console.error("保存全局密码失败:", error);
	}
}

export function getGlobalPassword(): string | null {
	return globalPassword;
}

export function getProtyleByDocId(docId: string): any {
	const protyleElement = document
		.querySelector(`[data-node-id="${docId}"]`)
		?.closest(".protyle");
	if (!protyleElement) return null;

	const protyle = (protyleElement as any).protyle;
	return protyle;
}

export function getCurrentOrCachedProtyle(
	docId: string,
	fallbackProtyle?: any,
): any {
	return getProtyleByDocId(docId) || fallbackProtyle;
}
