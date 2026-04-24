<template>
  <!-- 遮罩层 -->
  <div
    v-if="visible"
    class="super-panel-overlay"
    @click="emit('close')"
  />

  <!-- 面板容器 -->
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
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SuperPanelHeader from "./components/SuperPanelHeader.vue";
import AiSettingsPanel from "./components/AiSettingsPanel.vue";
import FeatureCard from "./components/FeatureCard.vue";
import type { PluginSettings } from "@/config/settings";
import type { Feature, FeatureAction, AiSettings } from "./types";
import { FEATURE_SETTINGS_MAP } from "./types";
import type { IconKey } from "@/config/icons";

interface Props {
	visible: boolean;
	settings: PluginSettings;
	i18n: Record<string, any>;
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

// ==================== 功能列表配置 ====================

interface FeatureConfigItem {
	id: string;
	defaultTitle: string;
	defaultDesc: string;
	titleI18nKey?: string;
	descI18nKey?: string;
	actions?: FeatureAction[];
}

const resolveI18n = (obj: Record<string, any>, key: string): any => {
	if (!key.includes(".")) return obj[key];
	return key.split(".").reduce((acc, k) => acc?.[k], obj);
};

const FEATURE_CONFIG: FeatureConfigItem[] = [
	{ id: "tableOfContents", defaultTitle: "目录索引", defaultDesc: "快速生成文档目录和大纲" },
	{ id: "imageCompressor", defaultTitle: "图片压缩", defaultDesc: "批量压缩文档中的图片",
		actions: [{ key: "openCompressor", label: "打开压缩器", hotkey: "Ctrl+Alt+C" }] },
	{ id: "docNavigation", defaultTitle: "文档导航", defaultDesc: "显示父子文档导航链接" },
	{ id: "pageLock", defaultTitle: "页面锁定", defaultDesc: "锁定页面防止误编辑" },
	{ id: "wordQuery", defaultTitle: "单词查询", defaultDesc: "快速查询单词释义" },
	{ id: "generalSettings", defaultTitle: "通用设置", defaultDesc: "字体、标题、代码块等通用配置" },
	{ id: "qrCode", defaultTitle: "二维码生成", defaultDesc: "生成文本或链接的二维码" },
	{ id: "unitConverter", defaultTitle: "单位转换", defaultDesc: "快速转换各种单位" },
	{ id: "shortcuts", defaultTitle: "快捷键面板", defaultDesc: "查看和管理快捷键" },
	{ id: "diskBrowser", defaultTitle: "本地磁盘", defaultDesc: "浏览本地磁盘和文件夹" },
	{ id: "codeImageGenerator", defaultTitle: "代码图片生成", defaultDesc: "生成代码截图，支持GitHub、Mac、卡通风格",
		descI18nKey: "enableCodeImageGeneratorDesc" },
	{ id: "aiContentGenerator", defaultTitle: "AI信息生成", defaultDesc: "使用AI生成Markdown格式内容，支持自定义对话和上下文" },
	{ id: "statistics", defaultTitle: "数据统计", defaultDesc: "显示笔记数据统计和分析",
		actions: [{ key: "openStatistics", label: "打开统计面板", hotkey: "" }] },
	{ id: "pronunciation", defaultTitle: "谐音翻译", defaultDesc: "英文单词生成谐音记忆，中文词语翻译成英文后生成谐音",
		titleI18nKey: "pronunciationHelp" },
	{ id: "encryption", defaultTitle: "内容加密", defaultDesc: "使用 AES-256-GCM 算法对选中文本进行加密和解密",
		descI18nKey: "enableEncryptionDesc" },
	{ id: "video", defaultTitle: "视频管理器", defaultDesc: "管理和播放文档中的视频文件",
		actions: [{ key: "openVideoManager", label: "打开管理器", hotkey: "Ctrl+Alt+V" }] },
	{ id: "everythingSearch", defaultTitle: "Everything搜索", defaultDesc: "本地文件快速搜索工具",
		actions: [{ key: "openEverythingSearch", label: "打开搜索", hotkey: "Ctrl+Alt+E" }] },
	{ id: "statusBar", defaultTitle: "状态栏", defaultDesc: "在状态栏显示 CPU、内存使用情况及文档统计",
		titleI18nKey: "statusBar.title", descI18nKey: "statusBar.description" },
	{ id: "floatingToolbar", defaultTitle: "浮动工具栏", defaultDesc: "选中文字时显示包含多种操作的工具栏",
		titleI18nKey: "floatingToolbar.title", descI18nKey: "floatingToolbarDescription" },
	{ id: "floatingBox", defaultTitle: "悬浮框", defaultDesc: "页面右侧显示可展开的功能悬浮框",
		titleI18nKey: "floatingBox.title", descI18nKey: "floatingBox.description" },
	{ id: "textDiff", defaultTitle: "文本对比", defaultDesc: "提供文本差异对比功能，支持字符、词语、行和补丁模式对比",
		titleI18nKey: "textDiff.title", descI18nKey: "enableTextDiffDesc" },
	{ id: "base64Image", defaultTitle: "Base64图片转换", defaultDesc: "图片与Base64编码相互转换" },
	{ id: "skills", defaultTitle: "技能库", defaultDesc: "管理常用的Claude技能和模板",
		titleI18nKey: "skills.title", descI18nKey: "skills.description" },
	{ id: "flashcardReading", defaultTitle: "单词阅读", defaultDesc: "闪卡式阅读工具，支持分类和翻转",
		titleI18nKey: "flashcardReading.title", descI18nKey: "flashcardReading.description" },
	{ id: "translate", defaultTitle: "英译中替换", defaultDesc: "在浮动工具栏中快速翻译英文并替换",
		titleI18nKey: "floatingToolbar.translate" },
	{ id: "webDAV", defaultTitle: "WebDAV同步", defaultDesc: "使用WebDAV协议同步数据到云存储",
		actions: [{ key: "openWebDAV", label: "打开WebDAV", hotkey: "" }] },
	{ id: "docAnalysis", defaultTitle: "文档分析", defaultDesc: "分析文档内容大小，查找小文档",
		titleI18nKey: "docAnalysis.title", descI18nKey: "docAnalysis.description",
		actions: [{ key: "openDocAnalysis", label: "打开文档分析", hotkey: "Ctrl+Alt+D" }] },
];

const features = computed<Feature[]>(() =>
	FEATURE_CONFIG.map(({ id, defaultTitle, defaultDesc, titleI18nKey, descI18nKey, actions }) => ({
		id,
		iconKey: id as IconKey,
		title: (titleI18nKey ? resolveI18n(props.i18n, titleI18nKey) : props.i18n[id]) || defaultTitle,
		desc: (descI18nKey ? resolveI18n(props.i18n, descI18nKey) : props.i18n[`${id}Desc`]) || defaultDesc,
		enabled: (props.settings as any)[FEATURE_SETTINGS_MAP[id]] ?? false,
		actions: actions || [],
	})),
);
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
