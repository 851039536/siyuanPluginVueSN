import type { FloatingTool } from "../types";
import { toggleFlashcardDialog } from "../../flashcardReading/types";

export function createFlashcardReadingTool(plugin?: any): FloatingTool {
	return {
		id: "flashcardReading",
		label: plugin?.i18n?.floatingBox?.flashcardReading || "单词阅读",
		title: plugin?.i18n?.floatingBox?.flashcardReadingTitle || "打开单词阅读",
		icon: '<path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 19H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V9h2v2zm0-4H7V5h2v2zm10 12h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V9h8v2zm0-4h-8V5h8v2z"/>',
		bgColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
		action: (plugin?: any) => {
			toggleFlashcardDialog(plugin, plugin?.i18n?.flashcardReading);
		},
	};
}
