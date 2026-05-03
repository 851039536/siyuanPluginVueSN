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
// 验证链在 config.ts（FEATURE_CONFIG → FeatureId）、FEATURE_SETTINGS_MAP（Record<FeatureId, string>）
// 以及本文件之间建立三重校验：

import type { FeatureId } from "./config";

/**
 * 白名单：仅用于 UI 配置展示、不需要 register 函数的功能
 * 当 config.ts 新增此类功能时，必须在此添加 ID
 */
type _ConfigOnly = "qrCode" | "pronunciation" | "skills" | "translate";

/**
 * 需要 register 导出的功能列表（必须与本文件 export 行一一对应）
 */
type _Registered =
  | "pageLock" | "tableOfContents" | "imageCompressor" | "docNavigation"
  | "shortcuts" | "wordQuery" | "generalSettings" | "unitConverter"
  | "superPanel" | "diskBrowser" | "codeImageGenerator" | "aiContentGenerator"
  | "statistics" | "encryption" | "video" | "everythingSearch"
  | "statusBar" | "floatingToolbar" | "floatingBox" | "textDiff"
  | "base64Image" | "flashcardReading" | "passwordVault" | "docAnalysis"
  | "webDAV";

// --- 编译时断言辅助 ---
// 利用泛型接口约束 T extends true 产生 TypeScript 编译错误，无运行时开销
interface _AssertTrue<T extends true> {}

// ① 正向校验：_Registered 中的每个 ID 必须是有效的 FeatureId
// 当 config.ts 删除了某功能但这里未同步移除时 → ❌ 编译报错
type _AssertRegisteredInConfig = _AssertTrue<
  _Registered extends FeatureId ? true : false
>;

// ② 反向校验：每个需要 register 的 FeatureId 都在 _Registered 中
// 当 config.ts 新增了功能但这里未同步添加时 → ❌ 编译报错
type _AssertAllCovered = _AssertTrue<
  Exclude<FeatureId, _ConfigOnly> extends _Registered ? true : false
>;
