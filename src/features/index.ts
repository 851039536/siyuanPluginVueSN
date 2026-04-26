/**
 * 功能模块统一导出
 */
export { registerPageLock } from "./pageLock";
export { registerTableOfContents } from "./tableOfContents";
export { registerImageCompressor } from "./imageCompressor";
export { registerDocNavigation } from "./docNavigation";
export {
	registerShortcut,
	addCustomShortcut,
	addCustomShortcuts,
	getShortcutManager,
	type ShortcutInfo,
} from "./shortcut";
export { registerWordQuery } from "./wordQuery";
export { registerGeneralSettings } from "./generalSettings";
export { registerUnitConverter } from "./unitConverter";
export { registerSuperPanel } from "./superPanel";
export { registerDiskBrowser } from "./diskBrowser";
export { registerCodeImageGenerator } from "./codeImageGenerator";
export { registerAIContentGenerator } from "./aiContentGenerator";
export { registerStatistics } from "./statistics";
export { registerEncryption } from "./encryption";
export { registerVideo } from "./video";
export {
	registerEverythingSearch,
	showEverythingSearch,
	hideEverythingSearch,
	toggleEverythingSearch,
	everythingSearchVisible,
} from "./everythingSearch";
export { registerStatusBar } from "./statusBar";
export { registerFloatingToolbar } from "./floatingToolbar";
export { registerFloatingBox } from "./floatingBox";
export { registerTextDiff } from "./textDiff";
export { registerBase64Image } from "./base64Image";
export { registerFlashcardReading } from "./flashcardReading";
export {
	registerPasswordVault,
	showPasswordVault,
	hidePasswordVault,
	togglePasswordVault,
	passwordVaultVisible,
} from "./passwordVault";
export { registerDocAnalysis } from "./docAnalysis";
export { registerWebDAV } from "./webDAV";
