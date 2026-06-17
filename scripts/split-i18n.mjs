/**
 * i18n 自动拆分脚本
 * 将 src/i18n/{zh_CN,en_US}.json 按功能模块拆分为 src/i18n/{zh_CN,en_US}/*.json
 *
 * 分类策略：
 *   - 嵌套对象名作为模块名（imageCompressor → imageCompressor.json）
 *   - 平铺键根据前缀/关键词归类到对应模块
 *   - 无法归类的放入 common.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const I18N_DIR = join(__dirname, '..', 'src', 'i18n')

// 模块分组规则：key 匹配模式 → 模块名
const MODULE_RULES = [
  // === 嵌套对象直接按对象名归类 ===
  { pattern: 'imageCompressor', module: 'imageCompressor' },
  { pattern: 'floatingToolbar', module: 'floatingToolbar' },
  { pattern: 'heatmapMarker', module: 'heatmapMarker' },
  { pattern: 'skills', module: 'skills' },
  { pattern: 'superPanel', module: 'superPanel' },
  { pattern: 'bookmarkMarker', module: 'bookmarkMarker' },
  { pattern: 'wordQuery', module: 'wordQuery' },
  { pattern: 'diskBrowser', module: 'diskBrowser' },
  { pattern: 'codeImageGeneratorPanel', module: 'codeImageGeneratorPanel' },
  { pattern: 'statusBar', module: 'statusBar' },
  { pattern: 'apiUsage', module: 'apiUsage' },
  { pattern: 'textDiff', module: 'textDiff' },
  { pattern: 'flashcardReading', module: 'flashcardReading' },
  { pattern: 'video', module: 'video' },
  { pattern: 'floatingBox', module: 'floatingBox' },
  { pattern: 'docAnalysis', module: 'docAnalysis' },
  { pattern: 'rssReader', module: 'rssReader' },
  { pattern: 'resourceManager', module: 'resourceManager' },
  { pattern: 'apiDebugger', module: 'apiDebugger' },
  { pattern: 'websiteNavigation', module: 'websiteNavigation' },
  { pattern: 'scriptLauncher', module: 'scriptLauncher' },
  { pattern: 'dataSnapshot', module: 'dataSnapshot' },
  { pattern: 'gitPush', module: 'gitPush' },

  // === 平铺键按前缀/关键词归类 ===
  // 页面锁定
  { pattern: /^(lock|unlock|setPassword|updatePassword|enterPassword|password|pageLock|pleaseUnlock|pleaseSetPassword)/, module: 'pageLock' },
  // 目录索引
  { pattern: /^(tableOfContents|insert|subDocument|notebookToc|noActiveDocument|noHeadings|noSubDocuments|noNotebook|notebookNotFound|noDocuments|untitled)/, module: 'tableOfContents' },
  // 快捷键
  { pattern: /^(shortcut|allShortcuts|siyuanShortcuts|pluginShortcuts|customShortcuts|claudeShortcuts|openspecShortcuts|npmShortcuts|nvmShortcuts|cmdShortcuts|vscodeShortcuts|visualStudioShortcuts|searchPlaceholder|noResults|other|addCustom|keysPlaceholder|group|enterGroup|fillRequired|favorite|unFavorite|dataPath|searchCategory|noCategoryFound)/, module: 'shortcuts' },
  // 通用设置
  { pattern: /^(font|heading|codeBlock|codePadding|expandCode|collapse|titleCenter|titleColor|titleFont|enableHeading|iconStyle|emojiStyle|symbolStyle|numberStyle|geometricStyle|arrowStyle|customIcon|iconPlaceholder|documentFont|tableStyle|tableBorder|tableCell|tableHeader|tableOdd|tableEven|tableText|tableBorderRadius|listStyle|orderedList|unorderedList|listSymbol|resetColor|resetToDefault|enableHighlight|highlightDescription|enableFloatingToolbar|floatingToolbarDescription|enableHeatmapMarker|heatmapMarkerDescription|enableCodeBlock|codeBlockBackground|codeBlockBorder|borderColor|borderWidth|borderRadius|codeBlockShadow|noneShadow|lightShadow|mediumShadow|heavyShadow|lineNumber|showLineNumber|hideLineNumber|codeFont|codeColor|textColor|keywordColor|stringColor|commentColor|functionColor|numberColor|colorPlaceholder|enableDocumentFont|enableTableStyle|enableListStyle|levelDisplay|levelDisplayHint|customLevelMarkers|generalSettings|enableGeneralSettings|generalSettingsDesc|commonSettings|githubStyle|rainbowStyle|monochromeStyle|warmStyle|coolStyle|gradientStyle|customStyle|defaultStyle|defaultStyleDesc|macStyle|macStyleDesc|githubStyleDesc|advancedSettings|heading1|heading2|heading3|heading4|heading5|heading6)/, module: 'generalSettings' },
  // 二维码
  { pattern: /^(qrcode|qrCode)/, module: 'qrcode' },
  // 单位转换
  { pattern: /^(unitConverter|length)/, module: 'unitConverter' },
  // AI 内容生成
  { pattern: /^(ai|generate|generating|generatedContent|conversationSettings|systemPrompt|temperature|precise|creative|maxTokens|forceMarkdown|enableTypewriter|inputPlaceholder|retry|stop|stopGeneration|copyMarkdown|insert|insertToDoc|rawMarkdown|emptyHint|quickTemplates|article|summary|todoList|brainstorm|enterInput|selectPrompt|savedPrompts|noSavedPrompts|savePromptConfig|promptName|enterPrompt|confirmDelete|currentPrompt|referenceCurrentDoc|contextMessageLimit|minimal|maximum|editMode|editModeEnabled|editModeDisabled|targetDocument|selectDocument|editContent|viewDiff|hideDiff|applyEdit|undoEdit|insertSubDocument|insertSubDoc|subDocument|subDocumentName|aiSummary|editPlaceholder|polish|expand|condense|fix|analyze|rewrite|translate|undo|plagiarismCheck|riskLevel|similarityRate|suggestions|lowRisk|mediumRisk|highRisk|aiSuggestions|applySuggestions|documentTitle|editModeHint|insertToDocument|confirmInsert|undoInsert|presetTemplates|originalContent|newContent)/, module: 'aiContentGenerator' },
  // 谐音翻译
  { pattern: /^(pronunciation|enablePronunciation|pronunciationDesc|pronunciationPlaceholder|pronunciationHelp|pronunciationHint)/, module: 'pronunciation' },
  // 内容加密
  { pattern: /^(encryption|encrypt|decrypt|invalidEncrypted|currentPassword|passwordNotSetYet|changePassword|encryptionTip|algorithmInfo|decryptPassword|decryptedContent|copyContent|copied|copySuccess|copyFailed|replaceEncrypted|replaceSuccess|replaceFailed|saveToArchive|savingToArchive)/, module: 'encryption' },
  // 数据备份
  { pattern: /^(dataBackup|workspaceInfo|workspacePath|notSet|lastBackup|never|manualBackup|backup|autoBackup|disabled|enabled|backupFrequency|everyMinute|everyHour|everyDay|backupTime|keepBackups|backupHistory|noBackups|restore|restoreSuccess|restoreFailed|confirmRestore|restoring|delete|confirmDelete|deleteSuccess|deleteFailed|selectPath|selectWorkspace|enterWorkspacePath|workspacePathSet|selectPathFailed|pleaseSelectWorkspace|mobileBackupDisabled|pluginSettingsBackup|exportSettings|pluginSettingsBackupHint|exportSuccess|exportFailed)/, module: 'dataBackup' },
  // 图片生成
  { pattern: /^(enableImageCreation|enableImageCreationDesc)/, module: 'imageCreation' },
  // 数据快照
  { pattern: /^(enableDataSnapshot|enableDataSnapshotDesc)/, module: 'dataSnapshot' },
  // Git 推送
  { pattern: /^(enableGitPush|enableGitPushDesc)/, module: 'gitPush' },
  // 脚本启动器
  { pattern: /^(enableScriptLauncher|enableScriptLauncherDesc)/, module: 'scriptLauncher' },
  // 紧凑模式
  { pattern: /^(compactMode)/, module: 'compactMode' },
  // Skills 查看器
  { pattern: /^(skillsViewer|skillsUnit|checking|noSkills|skillsPathHint|projectPath|projectPathPlaceholder|openDir|openDirFailed|scanning|scanComplete|scanFailed|expand|collapse|noSkillsFound|editSkill|saveSkill|cancelEdit|editSkillPlaceholder|editSkillHint|saveSkillSuccess|saveSkillFailed|deleteSkill|deleteSkillTitle|deleteSkillConfirm|deleteSkillSuccess|deleteSkillFailed)/, module: 'skillsViewer' },
  // HTML 展示
  { pattern: /^(htmlViewer|enableHtmlViewer)/, module: 'htmlViewer' },
  // Base64 图片
  { pattern: /^(base64Image|enableBase64Image)/, module: 'base64Image' },
  // 文本对比
  { pattern: /^(enableTextDiff)/, module: 'textDiff' },
  // 图片压缩
  { pattern: /^(enableImageCompressor)/, module: 'imageCompressor' },
  // 文档导航
  { pattern: /^(enableDocNavigation)/, module: 'docNavigation' },
  // 超级面板切换
  { pattern: /^(toggleSuperPanel)/, module: 'superPanel' },
]

/**
 * 判断一个 key 属于哪个模块
 */
function classifyKey(key) {
  for (const rule of MODULE_RULES) {
    if (typeof rule.pattern === 'string') {
      if (key === rule.pattern) return rule.module
    } else if (rule.pattern instanceof RegExp) {
      if (rule.pattern.test(key)) return rule.module
    }
  }
  return 'common'
}

/**
 * 将原始 JSON 对象按模块拆分
 */
function splitI18n(data) {
  const modules = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 嵌套对象：用 key 名作为模块名
      const moduleName = key
      if (!modules[moduleName]) modules[moduleName] = {}
      modules[moduleName][key] = value
    } else {
      // 平铺键：按规则分类
      const moduleName = classifyKey(key)
      if (!modules[moduleName]) modules[moduleName] = {}
      modules[moduleName][key] = value
    }
  }

  return modules
}

function main() {
  for (const lang of ['zh_CN', 'en_US']) {
    const srcFile = join(I18N_DIR, `${lang}.json`)
    const data = JSON.parse(readFileSync(srcFile, 'utf-8'))
    const modules = splitI18n(data)
    const outDir = join(I18N_DIR, lang)

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }

    let totalKeys = 0
    for (const [moduleName, moduleData] of Object.entries(modules)) {
      const outFile = join(outDir, `${moduleName}.json`)
      writeFileSync(outFile, JSON.stringify(moduleData, null, 2) + '\n', 'utf-8')
      const keyCount = Object.keys(moduleData).length
      console.log(`  ${lang}/${moduleName}.json → ${keyCount} keys`)
      totalKeys += keyCount
    }
    console.log(`✅ ${lang}: ${totalKeys} keys across ${Object.keys(modules).length} files\n`)
  }
}

main()
