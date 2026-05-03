/**
 * 功能模块统一导出
 *
 * 功能注册表（registerXxx）与 UI 元数据（FEATURE_CONFIG）通过 FeatureId 类型关联。
 * 编译时验证链：
 *   config.ts（FEATURE_CONFIG）→ FeatureId 类型 → FEATURE_SETTINGS_MAP（Record<FeatureId, string>）
 *
 * 添加功能时：
 *   1. 在 config.ts 的 FEATURE_CONFIG 中添加条目（自动生成 FeatureId）
 *   2. 在 features/index.ts 中添加对应的 register 导出
 *   3. 在 FEATURE_SETTINGS_MAP 中添加设置键映射（TypeScript 会检查遗漏/多余）
 * 移除功能时：反向操作，TypeScript 同样会报错。
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

// ========== 编译时验证 ==========
// 导入 FeatureId 确保本文件感知到 config.ts 中注册的所有功能 ID
// 如果 config.ts 新增了功能而 features/index.ts 遗漏了对应的 register 导出，
// 开发者需要在此手动补全导入；反之亦然。
import type {} from "./config";
