<template>
  <div class="plugin-app-main">
    <!-- 图片压缩器 -->
    <ImageViewer
      :visible="showImageViewer"
      :i18n="(plugin.i18n as any).imageCompressor || {}"
      @close="showImageViewer = false"
    />
    <!-- 二维码对话框 -->
    <QRCodeDialog
      :visible="showQRCodeDialog"
      :content="qrcodeContent"
      :i18n="plugin.i18n"
      @update:visible="(v: boolean) => showQRCodeDialog = v"
      @close="showQRCodeDialog = false"
    />

    <!-- 谐音翻译对话框 -->
    <PronunciationDialog
      :visible="showPronunciationDialog"
      :content="pronunciationWord"
      :plugin="plugin"
      :i18n="plugin.i18n"
      @update:visible="(v: boolean) => showPronunciationDialog = v"
      @close="showPronunciationDialog = false"
    />

    <!-- 视频管理器 -->
    <VideoManager
      :visible="showVideoManager"
      @close="showVideoManager = false"
    />

    <!-- Everything搜索弹窗 -->
    <EverythingSearchDialog
      :visible="everythingSearchVisible"
      @update:visible="(v) => everythingSearchVisible = v"
      @close="hideEverythingSearch"
    />

    <!-- 密码箱弹窗 -->
    <PasswordVaultDialog
      :visible="passwordVaultVisible"
      @update:visible="(v) => passwordVaultVisible = v"
      @close="hidePasswordVault"
    />

    <!-- 解密对话框 -->
    <DecryptDialog
      :visible="showDecryptDialog"
      :encrypted-text="pendingEncryptedText"
      :i18n="plugin.i18n"
      @update:visible="(v) => showDecryptDialog = v"
      @close="showDecryptDialog = false"
      @replace="handleDecryptReplace"
    />

    <!-- HTML展示弹窗 -->
    <HtmlViewerDialog
      :visible="htmlViewerVisible"
      @update:visible="(v) => htmlViewerVisible = v"
      @close="htmlViewerVisible = false"
    />

    <!-- Skills 查看器弹窗 -->
    <SkillsViewerDialog
      v-if="skillsViewerEnabled"
      :visible="skillsViewerVisible"
      :plugin="plugin"
      @update:visible="(v) => skillsViewerVisible = v"
      @close="hideSkillsViewer"
    />

    <!-- 图片生成器 -->
    <CoverGenerator
      :visible="imageCreationVisible"
      :initial-title="imageCreationInitialTitle"
      :initial-keywords="imageCreationInitialKeywords"
      @update:visible="(v: boolean) => { imageCreationVisible = v; if (!v) hideImageCreation() }"
    />
  </div>
</template>

<script setup lang="ts">
import type PluginSample from "@/index"
import {
  onMounted,
  ref,
} from "vue"
import {
  everythingSearchVisible,
  getTextDiffManager,
  hideEverythingSearch,
  hideImageCreation,
  hidePasswordVault,
  hideSkillsViewer,
  showSkillsModal,
  htmlViewerVisible,
  imageCreationInitialKeywords,
  imageCreationInitialTitle,
  imageCreationVisible,
  openPasswordVaultWithText,
  passwordVaultVisible,
  skillsViewerVisible,
  toggleFlashcardDialog,
  toggleToolCollection,
} from "@/features"
import DecryptDialog from "@/features/encryption/components/DecryptDialog.vue"
import { getEncryptionInstance } from "@/features/encryption/index"
import EverythingSearchDialog from "@/features/everythingSearch/index.vue"
import {
  PronunciationDialog,
  QRCodeDialog,
} from "@/features/floatingToolbar"
import HtmlViewerDialog from "@/features/htmlViewer/index.vue"
import ImageViewer from "@/features/imageCompressor/index.vue"
import CoverGenerator from "@/features/imageCreation/components/CoverGenerator.vue"
import PasswordVaultDialog from "@/features/passwordVault/index.vue"
import SkillsViewerDialog from "@/features/skillsViewer/index.vue"
import VideoManager from "@/features/video/index.vue"
import { usePlugin } from "@/main"

const plugin = usePlugin() as PluginSample
const skillsViewerEnabled = plugin.settings.enableSkillsViewer !== false
const showImageViewer = ref(false)
const showQRCodeDialog = ref(false)
const showVideoManager = ref(false)
const qrcodeContent = ref("")
const showPronunciationDialog = ref(false)
const pronunciationWord = ref("")
const showDecryptDialog = ref(false)
const pendingEncryptedText = ref("")

// 打开二维码对话框
const openQRCodeDialog = (content: string) => {
  qrcodeContent.value = content
  showQRCodeDialog.value = true
}

// 打开谐音翻译对话框
const openPronunciationDialog = (word: string) => {
  pronunciationWord.value = word
  showPronunciationDialog.value = true
}

// 打开解密对话框
const openDecryptDialogAction = (encryptedText: string) => {
  pendingEncryptedText.value = encryptedText
  showDecryptDialog.value = true
}

// 替换加密文本为解密后内容
const handleDecryptReplace = (decryptedText: string) => {
  const instance = getEncryptionInstance()
  if (instance) {
    instance.replaceCurrentText(decryptedText)
  }
}

onMounted(() => {
  window._sy_plugin_sample = {}
  window._sy_plugin_sample.openQRCodeDialog = openQRCodeDialog
  window._sy_plugin_sample.openPronunciationDialog = openPronunciationDialog

  // 监听打开二维码对话框事件
  window.addEventListener("openQRCodeDialog", ((event: any) => {
    if (event.detail?.content) openQRCodeDialog(event.detail.content)
  }) as EventListener)

  // 监听打开谐音翻译对话框事件
  window.addEventListener("openPronunciationDialog", ((event: any) => {
    if (event.detail?.content) openPronunciationDialog(event.detail.content)
  }) as EventListener)

  // 监听打开图片压缩器事件
  window.addEventListener("openImageCompressor", () => {
    showImageViewer.value = true
  })

  // 监听打开视频管理器事件
  window.addEventListener("openVideoManager", () => {
    showVideoManager.value = true
  })

  // 监听打开Everything搜索事件
  window.addEventListener("openEverythingSearch", () => {
    everythingSearchVisible.value = true
  })

  // 监听打开密码箱事件
  window.addEventListener("openPasswordVault", () => {
    passwordVaultVisible.value = true
  })

  // 监听浮动工具栏"存密码"事件（携带选中文本）
  window.addEventListener("openPasswordVaultAdd", ((event: any) => {
    if (event.detail?.content) {
      openPasswordVaultWithText(event.detail.content)
    }
  }) as EventListener)

  // 监听打开解密对话框事件
  window.addEventListener("openDecryptDialog", ((event: any) => {
    if (event.detail?.encryptedText)
      openDecryptDialogAction(event.detail.encryptedText)
  }) as EventListener)

  // 监听打开排版助手事件
  window.addEventListener("openFormatAssistant", () => {
    const pluginInstance = plugin as any
    if (pluginInstance.__formatAssistant) {
      pluginInstance.__formatAssistant.open()
    }
  })

  // 监听打开书签标记设置事件
  window.addEventListener("openBookmarkMarker", () => {
    const pluginInstance = plugin as any
    if (pluginInstance.__bookmarkMarker) {
      pluginInstance.__bookmarkMarker.open()
    }
  })

  // 监听打开HTML展示事件
  window.addEventListener("openHtmlViewer", ((event: any) => {
    htmlViewerVisible.value = true
  }) as EventListener)

  // 监听打开文本对比事件（来自超级面板 / 悬浮框）
  window.addEventListener("openTextDiff", () => {
    getTextDiffManager()?.toggle()
  })

  // 监听打开单词阅读事件（来自悬浮框）
  window.addEventListener("openFlashcardReading", () => {
    toggleFlashcardDialog()
  })

  // 监听打开提示词库事件（来自悬浮框）
  window.addEventListener("openPrompts", () => {
    showSkillsModal(plugin as any)
  })

  // 监听工具合集面板切换事件
  window.addEventListener("toggleToolCollection", () => {
    toggleToolCollection()
  })
})
</script>

<!-- 局部样式 -->
<style lang="scss" scoped>
.plugin-app-main {
  width: 100%;
  height: 100%;
  max-height: 100vh;
  box-sizing: border-box;
  pointer-events: none;

  position: absolute;
  top: 0;
  left: 0;
  z-index: 4;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
}
</style>
