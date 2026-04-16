<template>
  <div class="plugin-app-main">
    <!-- 图片压缩器 -->
    <ImageViewer
      :visible="showImageViewer"
      :i18n="(plugin.i18n as any).imageCompressor || {}"
      @close="onCloseImageViewer"
    />
    <!-- 二维码对话框 -->
    <QRCodeDialog
      :visible="showQRCodeDialog"
      :content="qrcodeContent"
      :i18n="plugin.i18n"
      @update:visible="onQRCodeDialogVisibleChange"
      @close="onCloseQRCodeDialog"
    />

    <!-- 谐音翻译对话框 -->
    <PronunciationDialog
      :visible="showPronunciationDialog"
      :content="pronunciationWord"
      :plugin="plugin"
      :i18n="plugin.i18n"
      @update:visible="onPronunciationDialogVisibleChange"
      @close="onClosePronunciationDialog"
    />

    <!-- 视频管理器 -->
    <VideoManager
      :visible="showVideoManager"
      @close="onCloseVideoManager"
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


  </div>
</template>

<script setup lang="ts">
import { usePlugin } from "@/main";
import { onMounted, ref } from "vue";
import ImageViewer from "@/features/imageCompressor/index.vue";
import { QRCodeDialog, PronunciationDialog } from "@/features/floatingToolbar";
import VideoManager from "@/features/video/index.vue";
import EverythingSearchDialog from "@/features/everythingSearch/index.vue";
import PasswordVaultDialog from "@/features/passwordVault/index.vue";
import {
	everythingSearchVisible,
	hideEverythingSearch,
	passwordVaultVisible,
	hidePasswordVault,
} from "@/features";
import type PluginSample from "@/index";

const plugin = usePlugin() as PluginSample;
const showImageViewer = ref(false);
const showQRCodeDialog = ref(false);
const showVideoManager = ref(false);
const qrcodeContent = ref("");
const showPronunciationDialog = ref(false);
const pronunciationWord = ref("");

// 打开图片压缩器
const openImageCompressor = () => {
	showImageViewer.value = true;
};

// 关闭图片压缩器
const onCloseImageViewer = () => {
	showImageViewer.value = false;
};

// 二维码对话框控制
const onQRCodeDialogVisibleChange = (visible: boolean) => {
	showQRCodeDialog.value = visible;
};

const onCloseQRCodeDialog = () => {
	showQRCodeDialog.value = false;
};

// 视频管理器控制
const openVideoManager = () => {
	showVideoManager.value = true;
};

const onCloseVideoManager = () => {
	showVideoManager.value = false;
};

// 公开方法，纲projuct可以通过事件打开二维码对话框
const openQRCodeDialog = (content: string) => {
	qrcodeContent.value = content;
	showQRCodeDialog.value = true;
};

// 打开谐音翻译对话框
const openPronunciationDialog = (word: string) => {
	pronunciationWord.value = word;
	showPronunciationDialog.value = true;
};

// 谐音翻译对话框控制
const onPronunciationDialogVisibleChange = (visible: boolean) => {
	showPronunciationDialog.value = visible;
};

const onClosePronunciationDialog = () => {
	showPronunciationDialog.value = false;
};

onMounted(() => {
	window._sy_plugin_sample = {};
	window._sy_plugin_sample.openQRCodeDialog = openQRCodeDialog;
	window._sy_plugin_sample.openPronunciationDialog = openPronunciationDialog;

	// 监听打开二维码对话框事件
	window.addEventListener("openQRCodeDialog", ((event: any) => {
		const content = event.detail?.content;
		if (content) {
			qrcodeContent.value = content;
			showQRCodeDialog.value = true;
		}
	}) as EventListener);

	// 监听打开谐音翻译对话框事件
	window.addEventListener("openPronunciationDialog", ((event: any) => {
		const content = event.detail?.content;
		if (content) {
			pronunciationWord.value = content;
			showPronunciationDialog.value = true;
		}
	}) as EventListener);

	// 监听打开图片压缩器事件
	window.addEventListener("openImageCompressor", openImageCompressor);

	// 监听打开视频管理器事件
	window.addEventListener("openVideoManager", openVideoManager);

	// 监听打开Everything搜索事件
	window.addEventListener("openEverythingSearch", () => {
		everythingSearchVisible.value = true;
	});

	// 监听打开密码箱事件
	window.addEventListener("openPasswordVault", () => {
		passwordVaultVisible.value = true;
	});
});
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
