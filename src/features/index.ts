// ========== 编译时验证 ==========
// 验证链在 config.ts（FEATURE_CONFIG → FeatureId）与本文件之间建立二重校验：

import type { FeatureId } from "./config"

export { registerAIContentGenerator } from "./aiContentGenerator"
export { registerApiDebugger } from "./apiDebugger"
export { registerBookmarkMarker } from "./bookmarkMarker"
export { registerDataSnapshot } from "./dataSnapshot"
export { registerDiskBrowser } from "./diskBrowser"
export { registerDocAnalysis } from "./docAnalysis"
export { registerDocNavigation } from "./docNavigation"
export { registerEncryption } from "./encryption"
export {
  everythingSearchVisible,
  hideEverythingSearch,
  registerEverythingSearch,
  showEverythingSearch,
} from "./everythingSearch"
export {
  registerFlashcardReading,
  toggleFlashcardDialog,
} from "./flashcardReading"
export { registerFloatingBox } from "./floatingBox"
export { registerFloatingToolbar } from "./floatingToolbar"
export { registerFormatAssistant } from "./formatAssistant"
export { registerGeneralSettings } from "./generalSettings"
export { registerGitPush } from "./gitPush"
export { registerHtmlViewer } from "./htmlViewer"
export {
  htmlViewerVisible,
} from "./htmlViewer/state"
export { registerImageCompressor } from "./imageCompressor"
export {
  hideImageCreation,
  imageCreationInitialKeywords,
  imageCreationInitialTitle,
  imageCreationVisible,
  registerImageCreation,
  showImageCreation,
} from "./imageCreation"
/**
 * 功能模块统一导出
 *
 * 功能注册表（registerXxx）与 UI 元数据（FEATURE_CONFIG）通过 FeatureId 类型关联。
 *
 * 添加功能时：
 *   1. 在 config.ts 的 FEATURE_CONFIG 中添加条目（自动生成 FeatureId）
 *   2. 在 features/index.ts 中添加对应的 register 导出
 * 移除功能时：反向操作，TypeScript 同样会报错。
 */
export { registerPageLock } from "./pageLock"
export {
  hidePasswordVault,
  openPasswordVaultWithText,
  passwordVaultVisible,
  pendingEntryData,
  registerPasswordVault,
} from "./passwordVault"
export { registerResourceManager } from "./resourceManager"
export { registerRssReader } from "./rssReader"
export { registerScriptLauncher } from "./scriptLauncher"
export { registerS3Backup } from "./s3Backup"
export { registerShortcut } from "./shortcut"
export { registerSkillLearning } from "./skillLearning"
export {
  hideSkillsViewer,
  registerSkillsViewer,
  scanSkills,
  type SkillInfo,
  skillsViewerVisible,
} from "./skillsViewer"
export {
  registerPrompts,
  showPromptsModal,
} from "./prompts"
export {
  getStatisticsInstance,
  registerStatistics,
} from "./statistics"
export {
  registerStatusBar,
  unregisterStatusBar,
} from "./statusBar"
export { registerSuperPanel } from "./superPanel"
export { registerTableOfContents } from "./tableOfContents"
export {
  getTextDiffManager,
  registerTextDiff,
} from "./textDiff"
export { registerThemeColor } from "./themeColor"
export {
  closeToolCollection,
  registerToolCollection,
  toggleToolCollection,
  toolCollectionVisible,
} from "./toolCollection"
// unitConverter 已迁移至 toolCollection/tools/unitConverter/
// wordQuery 已迁移至 toolCollection/tools/wordQuery/
export { registerVideo } from "./video"
export { registerWebsiteNavigation } from "./websiteNavigation"
export { showWebsiteNavigation } from "./websiteNavigation/types"

/**
 * 白名单：仅用于 UI 配置展示、不需要 register 函数的功能
 * 当 config.ts 新增此类功能时，必须在此添加 ID
 */
type _ConfigOnly = "qrCode" | "heatmapMarker" | "base64Image"

/**
 * 需要 register 导出的功能列表（必须与本文件 export 行一一对应）
 */
type _Registered =
  | "imageCreation"
  | "pageLock" | "tableOfContents" | "imageCompressor" | "docNavigation"
  | "shortcuts" | "generalSettings"
  | "superPanel" | "diskBrowser" | "aiContentGenerator"
  | "statistics" | "encryption" | "video" | "everythingSearch"
  | "statusBar" | "floatingToolbar" | "floatingBox" | "textDiff"
  | "flashcardReading" | "passwordVault" | "docAnalysis"
  | "formatAssistant" | "htmlViewer" | "rssReader" | "resourceManager"
  | "skillsViewer" | "themeColor" | "bookmarkMarker" | "apiDebugger"
  | "scriptLauncher" | "websiteNavigation" | "dataSnapshot" | "gitPush" | "skillLearning" | "prompts" | "toolCollection" | "s3Backup"

// --- 编译时断言辅助 ---
// 利用泛型接口约束 T extends true 产生 TypeScript 编译错误，无运行时开销
interface _AssertTrue<T extends true> {}

// ① 正向校验：_Registered 中的每个 ID 必须是有效的 FeatureId
// 当 config.ts 删除了某功能但这里未同步移除时 → ❌ 编译报错
type _AssertRegisteredInConfig = _AssertTrue<
  _Registered extends FeatureId ? true : false
>

// ② 反向校验：每个需要 register 的 FeatureId 都在 _Registered 中
// 当 config.ts 新增了功能但这里未同步添加时 → ❌ 编译报错
type _AssertAllCovered = _AssertTrue<
  Exclude<FeatureId, _ConfigOnly> extends _Registered ? true : false
>
