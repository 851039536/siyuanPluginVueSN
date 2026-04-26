export const SUPER_PASSWORD = "kaiouyang";

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
