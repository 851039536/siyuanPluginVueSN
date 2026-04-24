<template>
  <!-- 遮罩层 -->
  <Transition name="overlay">
    <div
      v-if="visible"
      class="super-panel-overlay"
      @click="emit('close')"
    />
  </Transition>

  <!-- 面板容器 -->
  <Transition name="panel">
    <div v-if="visible" class="super-panel-container">
      <!-- 头部 -->
      <SuperPanelHeader
        :title="i18n.title || '超级面板'"
        :i18n="i18n"
        @toggle-all="(v: boolean) => emit('toggleAllFeatures', v)"
        @toggle-ai-settings="toggleAiSettings"
        @refresh="emit('refresh')"
        @close="emit('close')"
      />

      <!-- AI配置区域 -->
      <AiSettingsPanel
        :visible="showAiSettings"
        :settings="aiSettings"
        :i18n="i18n"
        @close="toggleAiSettings"
        @update:settings="emit('updateAiSettings', $event)"
      />

      <!-- 内容区 -->
      <div class="super-panel-content">
        <FeatureCard
          v-for="feature in features"
          :key="feature.id"
          :feature="feature"
          :i18n="i18n"
          @action="emit('action', $event)"
          @toggle="(id: string, v: boolean) => emit('toggleFeature', id, v)"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SuperPanelHeader from "./components/SuperPanelHeader.vue";
import AiSettingsPanel from "./components/AiSettingsPanel.vue";
import FeatureCard from "./components/FeatureCard.vue";
import type { PluginSettings } from "@/config/settings";
import type { Feature, AiSettings } from "./types";

// 国际化接口 - 使用索引签名简化定义
interface I18n {
	title?: string;
	featureDisabled?: string;
	[key: string]: any;
}

interface Props {
	visible: boolean;
	settings: PluginSettings;
	i18n: I18n;
}

interface Emits {
	(e: "close"): void;
	(e: "action", action: string): void;
	(e: "toggleFeature", featureId: string, enabled: boolean): void;
	(e: "toggleAllFeatures", enabled: boolean): void;
	(e: "refresh"): void;
	(e: "updateAiSettings", settings: AiSettings): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// AI配置状态
const showAiSettings = ref(false);

// AI设置数据
const aiSettings = computed<AiSettings>(() => ({
	provider: props.settings.aiApiProvider || "tongyi",
	model: props.settings.aiModel || "qwen-plus",
	customModel: props.settings.aiCustomModel || "",
	apiKey: props.settings.aiApiKey || "",
	customEndpoint: props.settings.aiCustomEndpoint || "",
	enableThinking: props.settings.aiEnableThinking ?? false,
}));

// 切换AI配置面板
const toggleAiSettings = () => {
	showAiSettings.value = !showAiSettings.value;
};

// 功能列表配置
const features = computed<Feature[]>(() => [
	{
		id: "tableOfContents",
		iconKey: "tableOfContents",
		title: props.i18n.tableOfContents || "目录索引",
		desc: props.i18n.tableOfContentsDesc || "快速生成文档目录和大纲",
		enabled: props.settings.enableTableOfContents,
		actions: [],
	},
	{
		id: "imageCompressor",
		iconKey: "imageCompressor",
		title: props.i18n.imageCompressor || "图片压缩",
		desc: props.i18n.imageCompressorDesc || "批量压缩文档中的图片",
		enabled: props.settings.enableImageCompressor,
		actions: [
			{ key: "openCompressor", label: "打开压缩器", hotkey: "Ctrl+Alt+C" },
		],
	},
	{
		id: "docNavigation",
		iconKey: "docNavigation",
		title: props.i18n.docNavigation || "文档导航",
		desc: props.i18n.docNavigationDesc || "显示父子文档导航链接",
		enabled: props.settings.enableDocNavigation,
		actions: [],
	},
	{
		id: "pageLock",
		iconKey: "pageLock",
		title: props.i18n.pageLock || "页面锁定",
		desc: props.i18n.pageLockDesc || "锁定页面防止误编辑",
		enabled: props.settings.enablePageLock,
		actions: [],
	},
	{
		id: "wordQuery",
		iconKey: "wordQuery",
		title: props.i18n.wordQuery || "单词查询",
		desc: props.i18n.wordQueryDesc || "快速查询单词释义",
		enabled: props.settings.enableWordQuery,
		actions: [],
	},
	{
		id: "generalSettings",
		iconKey: "generalSettings",
		title: props.i18n.generalSettings || "通用设置",
		desc: props.i18n.generalSettingsDesc || "字体、标题、代码块等通用配置",
		enabled: props.settings.enableGeneralSettings,
		actions: [],
	},
	{
		id: "qrCode",
		iconKey: "qrCode",
		title: props.i18n.qrCode || "二维码生成",
		desc: props.i18n.qrCodeDesc || "生成文本或链接的二维码",
		enabled: props.settings.enableQRCode,
		actions: [],
	},
	{
		id: "unitConverter",
		iconKey: "unitConverter",
		title: props.i18n.unitConverter || "单位转换",
		desc: props.i18n.unitConverterDesc || "快速转换各种单位",
		enabled: props.settings.enableUnitConverter,
		actions: [],
	},
	{
		id: "shortcuts",
		iconKey: "shortcuts",
		title: props.i18n.shortcuts || "快捷键面板",
		desc: props.i18n.shortcutsDesc || "查看和管理快捷键",
		enabled: props.settings.enableShortcuts,
		actions: [],
	},
	{
		id: "diskBrowser",
		iconKey: "diskBrowser",
		title: props.i18n.diskBrowser || "本地磁盘",
		desc: props.i18n.diskBrowserDesc || "浏览本地磁盘和文件夹",
		enabled: props.settings.enableDiskBrowser,
		actions: [],
	},
	{
		id: "codeImageGenerator",
		iconKey: "codeImageGenerator",
		title: props.i18n.codeImageGenerator || "代码图片生成",
		desc:
			props.i18n.enableCodeImageGeneratorDesc ||
			"生成代码截图，支持GitHub、Mac、卡通风格",
		enabled: props.settings.enableCodeImageGenerator,
		actions: [],
	},
	{
		id: "aiContentGenerator",
		iconKey: "aiContentGenerator",
		title: props.i18n.aiContentGenerator || "AI信息生成",
		desc:
			props.i18n.aiContentGeneratorDesc ||
			"使用AI生成Markdown格式内容，支持自定义对话和上下文",
		enabled: props.settings.enableAIContentGenerator,
		actions: [],
	},
	{
		id: "statistics",
		iconKey: "statistics",
		title: "数据统计",
		desc: "显示笔记数据统计和分析",
		enabled: props.settings.enableStatistics,
		actions: [
			{
				key: "openStatistics",
				label: "打开统计面板",
				hotkey: "",
			},
		],
	},
	{
		id: "pronunciation",
		iconKey: "pronunciation",
		title: props.i18n.pronunciationHelp || "谐音翻译",
		desc:
			props.i18n.pronunciationDesc ||
			"英文单词生成谐音记忆，中文词语翻译成英文后生成谐音",
		enabled: props.settings.enablePronunciation,
		actions: [],
	},
	{
		id: "encryption",
		iconKey: "encryption",
		title: props.i18n.encryption || "内容加密",
		desc:
			props.i18n.enableEncryptionDesc ||
			"使用 AES-256-GCM 算法对选中文本进行加密和解密",
		enabled: props.settings.enableEncryption,
		actions: [],
	},
	{
		id: "video",
		iconKey: "video",
		title: props.i18n.videoManager || "视频管理器",
		desc: props.i18n.videoManagerDesc || "管理和播放文档中的视频文件",
		enabled: props.settings.enableVideo,
		actions: [
			{ key: "openVideoManager", label: "打开管理器", hotkey: "Ctrl+Alt+V" },
		],
	},
	{
		id: "everythingSearch",
		iconKey: "everythingSearch",
		title: props.i18n.everythingSearch || "Everything搜索",
		desc: props.i18n.everythingSearchDesc || "本地文件快速搜索工具",
		enabled: props.settings.enableEverythingSearch,
		actions: [
			{ key: "openEverythingSearch", label: "打开搜索", hotkey: "Ctrl+Alt+E" },
		],
	},
	{
		id: "statusBar",
		iconKey: "statusBar",
		title: props.i18n.statusBar?.title || "状态栏",
		desc:
			props.i18n.statusBar?.description ||
			"在状态栏显示 CPU、内存使用情况及文档统计",
		enabled: props.settings.enableStatusBar,
		actions: [],
	},
	{
		id: "floatingToolbar",
		iconKey: "floatingToolbar",
		title: props.i18n.floatingToolbar?.title || "浮动工具栏",
		desc:
			props.i18n.floatingToolbarDescription ||
			"选中文字时显示包含多种操作的工具栏",
		enabled: props.settings.enableFloatingToolbar,
		actions: [],
	},
	{
		id: "floatingBox",
		iconKey: "floatingBox",
		title: props.i18n.floatingBox?.title || "悬浮框",
		desc:
			props.i18n.floatingBox?.description || "页面右侧显示可展开的功能悬浮框",
		enabled: props.settings.enableFloatingBox,
		actions: [],
	},
	{
		id: "textDiff",
		iconKey: "textDiff",
		title: props.i18n.textDiff?.title || "文本对比",
		desc:
			props.i18n.enableTextDiffDesc ||
			"提供文本差异对比功能，支持字符、词语、行和补丁模式对比",
		enabled: props.settings.enableTextDiff,
		actions: [{ key: "openTextDiff", label: "打开文本对比", hotkey: "" }],
	},
	{
		id: "base64Image",
		iconKey: "base64Image",
		title: props.i18n.base64Image || "Base64图片转换",
		desc: props.i18n.base64ImageDesc || "图片与Base64编码相互转换",
		enabled: props.settings.enableBase64Image,
		actions: [],
	},
	{
		id: "skills",
		iconKey: "skills",
		title: props.i18n.skills?.title || "技能库",
		desc: props.i18n.skills?.description || "管理常用的Claude技能和模板",
		enabled: props.settings.enableSkills,
		actions: [],
	},
	{
		id: "flashcardReading",
		iconKey: "flashcardReading",
		title: props.i18n.flashcardReading?.title || "单词阅读",
		desc:
			props.i18n.flashcardReading?.description ||
			"闪卡式阅读工具，支持分类和翻转",
		enabled: props.settings.enableFlashcardReading,
		actions: [],
	},

	{
		id: "translate",
		iconKey: "translate",
		title: props.i18n.floatingToolbar?.translate || "英译中替换",
		desc: "在浮动工具栏中快速翻译英文并替换",
		enabled: props.settings.enableTranslate,
		actions: [],
	},
	{
		id: "webDAV",
		iconKey: "webDAV",
		title: props.i18n.webDAV || "WebDAV同步",
		desc: props.i18n.webDAVDesc || "使用WebDAV协议同步数据到云存储",
		enabled: props.settings.enableWebDAV,
		actions: [{ key: "openWebDAV", label: "打开WebDAV", hotkey: "" }],
	},
	{
		id: "docAnalysis",
		iconKey: "docAnalysis",
		title: props.i18n.docAnalysis?.title || "文档分析",
		desc:
			props.i18n.docAnalysis?.description ||
			"分析文档内容大小，查找小文档",
		enabled: props.settings.enableDocAnalysis,
		actions: [
			{ key: "openDocAnalysis", label: "打开文档分析", hotkey: "Ctrl+Alt+D" },
		],
	},
]);
</script>

<style scoped lang="scss">
@use './styles/index.scss';
</style>
