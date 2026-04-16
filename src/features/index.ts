/**
 * 功能模块统一导出
 */
export { registerPageLock } from "./pageLock";
export { registerTableOfContents } from "./tableOfContents/types";
export { registerImageCompressor } from "./imageCompressor";
export { registerDocNavigation } from "./docNavigation";
export {
	registerShortcut,
	addCustomShortcut,
	addCustomShortcuts,
	getShortcutManager,
	type ShortcutInfo,
} from "./shortcut";
export { registerWordQuery } from "./wordQuery/types";
export { registerGeneralSettings } from "./generalSettings/types";
export { registerUnitConverter } from "./unitConverter/types";
export { registerSuperPanel } from "./superPanel/types";
export { registerDiskBrowser } from "./diskBrowser";
export { registerCodeImageGenerator } from "./codeImageGenerator/types";
export { registerAIContentGenerator } from "./aiContentGenerator/types";
export { registerStatistics } from "./statistics";
export { registerEncryption } from "./encryption";
export { registerVideo } from "./video/types";
export {
	registerEverythingSearch,
	showEverythingSearch,
	hideEverythingSearch,
	toggleEverythingSearch,
	everythingSearchVisible,
} from "./everythingSearch/types";
export { registerSystemMonitor } from "./systemMonitor";
export { registerFloatingToolbar } from "./floatingToolbar";
export { registerFloatingBox } from "./floatingBox";
export { registerTextDiff } from "./textDiff/types";
export { registerBase64Image } from "./base64Image/types";
export { registerFlashcardReading } from "./flashcardReading/types";
export {
	registerPasswordVault,
	showPasswordVault,
	hidePasswordVault,
	togglePasswordVault,
	passwordVaultVisible,
} from "./passwordVault/types";
export { registerWebDAV } from "./webDAV";
