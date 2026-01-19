/**
 * 超级面板 - 统一功能入口
 * 在右侧边栏提供所有功能的快捷访问
 */
import { Plugin, showMessage } from 'siyuan'
import { createApp, type App as VueApp } from 'vue'
import SuperPanelView from './SuperPanelView.vue'
import { replaceTopBarIcon } from '@/utils/iconHelper'
import { FEATURE_ICONS } from '@/config/icons'
import { toggleTextDiff } from '../textDiff'

let vueApp: VueApp | null = null
let panelContainer: HTMLElement | null = null

/**
 * 注册超级面板功能
 */
export function registerSuperPanel(plugin: Plugin) {

  // 添加右侧边栏图标
  const topBarElement = plugin.addTopBar({
    icon: 'iconMenu',
    title: (plugin.i18n as any).superPanel?.title || '超级面板',
    position: 'right',
    callback: () => {
      toggleSuperPanel(plugin)
    }
  })

  // 替换为 Iconify 图标
  const superPanelIcon = FEATURE_ICONS.superPanel
  replaceTopBarIcon(topBarElement, superPanelIcon.icon, superPanelIcon.color)

  // 添加快捷键
  plugin.addCommand({
    langKey: 'toggleSuperPanel',
    hotkey: '⌃⌥P',
    callback: () => {
      toggleSuperPanel(plugin)
    }
  })

  // 监听悬浮框触发的超级面板事件
  window.addEventListener('toggleSuperPanel', () => {
    toggleSuperPanel(plugin)
  })
}

/**
 * 切换超级面板显示/隐藏
 */
function toggleSuperPanel(plugin: Plugin) {
  if (vueApp && panelContainer) {
    // 如果面板已存在，关闭它
    closeSuperPanel()
  } else {
    // 创建并显示面板
    openSuperPanel(plugin)
  }
}

/**
 * 打开超级面板
 */
function openSuperPanel(plugin: Plugin) {
  // 创建容器
  panelContainer = document.createElement('div')
  panelContainer.id = 'super-panel-vue-container'
  document.body.appendChild(panelContainer)

  // 创建 Vue 应用
  vueApp = createApp(SuperPanelView, {
    visible: true,
    settings: (plugin as any).settings,
    i18n: (plugin.i18n as any).superPanel || {},
    onClose: () => {
      closeSuperPanel()
    },
    onAction: (action: string) => {
      handleFeatureAction(plugin, action)
    },
    onToggleFeature: async (featureId: string, enabled: boolean) => {
      await handleFeatureToggle(plugin, featureId, enabled)
    },
    onToggleAllFeatures: async (enabled: boolean) => {
      await handleToggleAllFeatures(plugin, enabled)
    },
    onRefresh: async () => {
      await handleRefresh(plugin)
    },
    onUpdateAiSettings: async (aiSettings: { provider: string; model: string; apiKey: string; customEndpoint: string }) => {
      await handleUpdateAiSettings(plugin, aiSettings)
    }
  })

  vueApp.mount(panelContainer)
}

/**
 * 关闭超级面板
 */
function closeSuperPanel() {
  if (vueApp && panelContainer) {
    vueApp.unmount()
    panelContainer.remove()
    vueApp = null
    panelContainer = null
  }
}



/**
 * 处理刷新
 */
async function handleRefresh(plugin: Plugin) {
  try {
    showMessage((plugin.i18n as any).superPanel?.refreshing || '正在刷新...', 1000, 'info')

    // 先关闭面板
    if (vueApp && panelContainer) {
      vueApp.unmount()
      panelContainer.remove()
      vueApp = null
      panelContainer = null
    }

    // 使用 setTimeout 确保 DOM 完全清理后再重新打开
    await new Promise(resolve => setTimeout(resolve, 100))

    openSuperPanel(plugin)
    showMessage((plugin.i18n as any).superPanel?.refreshSuccess || '已刷新', 1500, 'info')
  } catch (error) {
    console.error('刷新失败:', error)
    showMessage('刷新失败', 2000, 'error')
  }
}

/**
 * 处理功能开关切换
 */
async function handleFeatureToggle(plugin: Plugin, featureId: string, enabled: boolean) {
  const pluginSample = plugin as any
  const settingsMap: Record<string, keyof typeof pluginSample.settings> = {
    'tableOfContents': 'enableTableOfContents',
    'imageCompressor': 'enableImageCompressor',
    'docNavigation': 'enableDocNavigation',
    'pageLock': 'enablePageLock',
    'wordQuery': 'enableWordQuery',
    'generalSettings': 'enableGeneralSettings',
    'qrCode': 'enableQRCode',
    'unitConverter': 'enableUnitConverter',
    'shortcuts': 'enableShortcuts',
    'diskBrowser': 'enableDiskBrowser',
    'codeImageGenerator': 'enableCodeImageGenerator',
    'aiContentGenerator': 'enableAIContentGenerator',
    'statistics': 'enableStatistics',
    'pronunciation': 'enablePronunciation',
    'encryption': 'enableEncryption',
    'video': 'enableVideo',
    'everythingSearch': 'enableEverythingSearch',
    'systemMonitor': 'enableSystemMonitor',
    'apiReference': 'enableApiReference',
    'floatingToolbar': 'enableFloatingToolbar',
    'floatingBox': 'enableFloatingBox',
    'textDiff': 'enableTextDiff',
    'base64Image': 'enableBase64Image',
    'skills': 'enableSkills',
    'flashcardReading': 'enableFlashcardReading',
    'flashcardQuery': 'enableFlashcardQuery'
  }

  const settingKey = settingsMap[featureId]
  if (settingKey) {
    const newSettings = {
      ...pluginSample.settings,
      [settingKey]: enabled
    }

    const success = await pluginSample.updateSettings(newSettings)
    if (success) {

        showMessage(
          enabled
            ? (plugin.i18n as any).featureEnabled || '功能已启用，请重启插件生效'
            : (plugin.i18n as any).featureDisabled || '功能已禁用，请重启插件生效',
          3000,
          'info'
        )
      // 不关闭面板，让用户可以继续操作
    } else {
      showMessage((plugin.i18n as any).saveFailed || '保存失败', 3000, 'error')
    }
  }
}

/**
 * 处理全部功能开关切换
 */
async function handleToggleAllFeatures(plugin: Plugin, enabled: boolean) {
  const pluginSample = plugin as any

  // 所有功能的设置键
  const allFeatureSettings = [
    'enableTableOfContents',
    'enableImageCompressor',
    'enableDocNavigation',
    'enablePageLock',
    'enableWordQuery',
    'enableGeneralSettings',
    'enableQRCode',
    'enableUnitConverter',
    'enableShortcuts',
    'enableDiskBrowser',
    'enableCodeImageGenerator',
    'enableAIContentGenerator',
    'enableStatistics',
    'enablePronunciation',
    'enableEncryption',
    'enableVideo',
    'enableEverythingSearch',
    'enableSystemMonitor',
    'enableApiReference',
    'enableFloatingToolbar',
    'enableFloatingBox',
    'enableTextDiff',
    'enableBase64Image',
    'enableFlashcardReading',
    'enableFlashcardQuery'
  ]

  // 构建新设置对象
  const newSettings = { ...pluginSample.settings }
  allFeatureSettings.forEach(key => {
    newSettings[key] = enabled
  })

  const success = await pluginSample.updateSettings(newSettings)
  if (success) {
    showMessage(
      enabled
        ? (plugin.i18n as any).superPanel?.allFeaturesEnabled || '所有功能已开启，请重启插件生效'
        : (plugin.i18n as any).superPanel?.allFeaturesDisabled || '所有功能已关闭，请重启插件生效',
      3000,
      'info'
    )
    // 使用思源 API 刷新面板
    await handleRefresh(plugin)
  } else {
    showMessage((plugin.i18n as any).saveFailed || '保存失败', 3000, 'error')
  }
}

/**
 * 处理功能操作
 */
function handleFeatureAction(_plugin: Plugin, action: string) {
  switch (action) {
    case 'insertIndex':
      // 触发插入索引命令
      window.dispatchEvent(new CustomEvent('executeCommand', {
        detail: { command: 'insertIndex' }
      }))
      closeSuperPanel()
      break

    case 'insertOutline':
      // 触发插入大纲命令
      window.dispatchEvent(new CustomEvent('executeCommand', {
        detail: { command: 'insertSubDocsWithOutline' }
      }))
      closeSuperPanel()
      break

    case 'insertRef':
      // 触发插入引用命令
      window.dispatchEvent(new CustomEvent('executeCommand', {
        detail: { command: 'insertSubDocsRef' }
      }))
      closeSuperPanel()
      break

    case 'openCompressor':
      // 触发打开图片压缩器
      window.dispatchEvent(new CustomEvent('openImageCompressor'))
      closeSuperPanel()
      break

    case 'openVideoManager':
      // 触发打开视频管理器
      window.dispatchEvent(new CustomEvent('openVideoManager'))
      closeSuperPanel()
      break

    case 'openEverythingSearch':
      // 触发打开Everything搜索
      window.dispatchEvent(new CustomEvent('openEverythingSearch'))
      closeSuperPanel()
      break

    case 'openApiReference':
      // 触发打开API参考
      if ((_plugin as any).settings.enableApiReference) {
        window.dispatchEvent(new CustomEvent('openApiReference'))
        closeSuperPanel()
      }
      break

    case 'openStatistics':
      // 触发打开统计面板
      if ((_plugin as any).settings.enableStatistics) {
        window.dispatchEvent(new CustomEvent('openStatistics'))
        closeSuperPanel()
      }
      break

    case 'openTextDiff':
      // 打开文本对比工具
      if ((_plugin as any).settings.enableTextDiff) {
        toggleTextDiff(_plugin)
        closeSuperPanel()
      }
      break

    case 'openBase64Image':
      // 打开 Base64 图片转换器
      if ((_plugin as any).settings.enableBase64Image) {
        window.dispatchEvent(new CustomEvent('openBase64Image'))
        closeSuperPanel()
      }
      break

    case 'openFlashcardReading':
      // 打开单词阅读面板
      window.dispatchEvent(new CustomEvent('openFlashcardReading'))
      closeSuperPanel()
      break

    default:
      showMessage('功能开发中...', 2000, 'info')
  }
}

/**
 * 处理AI配置更新
 */
async function handleUpdateAiSettings(
  plugin: Plugin,
  aiSettings: { provider: string; model: string; apiKey: string; customEndpoint: string }
) {
  const pluginSample = plugin as any

  const newSettings = {
    ...pluginSample.settings,
    aiApiProvider: aiSettings.provider,
    aiModel: aiSettings.model,
    aiApiKey: aiSettings.apiKey,
    aiCustomEndpoint: aiSettings.customEndpoint
  }

  const success = await pluginSample.updateSettings(newSettings)
  if (success) {
    // 通知相关功能模块更新配置
    if (pluginSample.__wordQuery) {
      pluginSample.__wordQuery.updateApiConfig(aiSettings.provider, aiSettings.model, aiSettings.apiKey, aiSettings.customEndpoint)
    }
    if (pluginSample.__aiContentGenerator) {
      pluginSample.__aiContentGenerator.updateApiConfig(aiSettings.provider, aiSettings.model, aiSettings.apiKey, aiSettings.customEndpoint)
    }
  } else {
    showMessage((plugin.i18n as any).saveFailed || '保存失败', 3000, 'error')
  }
}


