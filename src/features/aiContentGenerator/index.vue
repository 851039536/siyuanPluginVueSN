<template>
  <div class="ai-content-panel">
    <!-- 顶部工具栏 -->
    <PanelHeader @toggle-settings="toggleSettings" />

    <!-- 提示词配置面板 -->
    <SettingsPanel
      :showSettings="showSettings"
      v-model:systemPrompt="systemPrompt"
      v-model:temperature="temperature"
      v-model:maxTokens="maxTokens"
      v-model:contextMessageLimit="contextMessageLimit"
      :currentPromptName="currentPromptName"
      v-model:newPromptName="newPromptName"
      @toggle-settings="toggleSettings"
      @save-current-prompt="saveCurrentPrompt"
      @on-prompt-name-focus="onPromptNameFocus"
    />

    <!-- 内容显示区域（移到上方） -->
    <div class="content-display-section">
      <!-- 主内容显示区域 -->
      <MainContentArea
        :is-generating="isGenerating"
        :is-applying="isApplying"
        :is-undoing="isUndoing"
        :is-inserting-sub-doc="isInsertingSubDoc"
        :error-message="errorMessage"
        :displayed-content="displayedContent"
        :generated-content="generatedContent"
        :rendered-markdown="renderedDisplayedMarkdown"
        :original-content="originalContent"
        :can-apply="!!editTargetDoc && !isApplying && !isGenerating"
        :can-insert-sub-doc="!!editTargetDoc && !isInsertingSubDoc && !isGenerating"
        :can-undo="!!lastEditHistory"
        @stop="handleStop"
        @apply-edit="applyEdit"
        @insert-subdoc="insertSubDocument"
        @undo-edit="undoEdit"
        @copy="copyContent"
        @clear="clearContent"
      />
    </div>

    <!-- 底部输入区域 -->
    <BottomInputArea
      :is-generating="isGenerating"
      :edit-target-doc="editTargetDoc"
      :show-prompt-selector="showPromptSelector"
      :current-prompt-name="currentPromptName"
      :saved-prompts="savedPrompts"
      :filtered-prompts="filteredPrompts"
      :paginated-prompts="paginatedPrompts"
      :prompt-search-query="promptSearchQuery"
      :current-page="currentPage"
      :total-pages="totalPages"
      :edit-custom-input="editCustomInput"
      @ai-edit="aiEditAction"
      @stop="handleStop"
      @toggle-prompt-selector="showPromptSelector = !showPromptSelector"
      @clear-current-prompt="clearCurrentPrompt"
      @load-prompt="loadPrompt"
      @edit-prompt="editPrompt"
      @delete-prompt="deletePrompt"
      @select-target-doc="selectTargetDocument"
      @clear-target-doc="clearTargetDocument"
      @custom-edit="handleCustomEdit"
      @update:prompt-search-query="promptSearchQuery = $event"
      @update:current-page="currentPage = $event"
      @update:edit-custom-input="editCustomInput = $event"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { showMessage } from "siyuan";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import * as api from "@/api";
import { AIGeneratorStorage } from "./types/storage";
import type { GenerateOptions, SavedPrompt, TargetDoc } from "@/types/ai";
import PanelHeader from "./components/PanelHeader.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import MainContentArea from "./components/MainContentArea.vue";
import BottomInputArea from "./components/BottomInputArea.vue";

interface Props {
	i18n: any;
	plugin: any;
	onGenerate: (options: GenerateOptions) => Promise<string>;
}

const props = withDefaults(defineProps<Props>(), {
	plugin: null,
});

// 存储实例
let storage: AIGeneratorStorage | null = null;

// 状态
const generatedContent = ref("");
const isGenerating = ref(false);
const errorMessage = ref("");
const showSettings = ref(false);
const abortController = ref<AbortController | null>(null);

// 编辑模式状态
const editTargetDoc = ref<TargetDoc | null>(null);
const originalContent = ref(""); // 文档原始内容
const isApplying = ref(false);
const isUndoing = ref(false);
const isInsertingSubDoc = ref(false); // 插入子文档状态

// 编辑模式自定义提问输入
const editCustomInput = ref("");

// 编辑历史（用于撤回/重做）
interface EditHistory {
	docId: string;
	docTitle: string;
	originalContent: string;
	timestamp: number;
}
const lastEditHistory = ref<EditHistory | null>(null);

// 对话设置
const systemPrompt = ref(
	"你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。请确保输出内容使用标准的Markdown语法。",
);
const temperature = ref(0.7);
const maxTokens = ref(10000);

// 上下文消息数量配置
const contextMessageLimit = ref(1);

// 上下文配置已删除
const displayedContent = ref(""); // 用于打字机效果显示的内容
// 提示词管理
const savedPrompts = ref<SavedPrompt[]>([]);
const showPromptSelector = ref(false);
const newPromptName = ref("");
const currentPromptName = ref(""); // 当前选中的提示词名称

// 提示词搜索和分页状态
const promptSearchQuery = ref("");
const currentPage = ref(1);

// ============ 常量定义 ============
const ITEMS_PER_PAGE = 10; // 每页显示数量
const SETTINGS_SAVE_DEBOUNCE_MS = 300; // 设置保存防抖时间(毫秒)

// 过滤后的提示词
const filteredPrompts = computed(() => {
	if (!promptSearchQuery.value.trim()) {
		return savedPrompts.value;
	}

	const query = promptSearchQuery.value.toLowerCase().trim();
	return savedPrompts.value.filter(
		(prompt) =>
			prompt.name.toLowerCase().includes(query) ||
			prompt.systemPrompt.toLowerCase().includes(query),
	);
});

// 分页后的提示词
const paginatedPrompts = computed(() => {
	const start = (currentPage.value - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	return filteredPrompts.value.slice(start, end);
});

// 总页数
const totalPages = computed(() => {
	return Math.ceil(filteredPrompts.value.length / ITEMS_PER_PAGE) || 1;
});

// 监听搜索查询变化，重置页码
watch(promptSearchQuery, () => {
	currentPage.value = 1;
});

// 监听提示词选择面板显示状态，重置搜索
watch(showPromptSelector, (newVal) => {
	if (newVal) {
		promptSearchQuery.value = "";
		currentPage.value = 1;
	}
});

// ============ 公共工具函数 ============

/**
 * 开始生成内容的公共初始化
 */
const startGeneration = () => {
	abortController.value = new AbortController();
	isGenerating.value = true;
	generatedContent.value = "";
	displayedContent.value = "";
	errorMessage.value = "";
};

/**
 * 重置所有生成相关的状态
 */
const resetAllGenerationStates = () => {
	isGenerating.value = false;
	isApplying.value = false;
	isUndoing.value = false;
	isInsertingSubDoc.value = false;
	abortController.value = null;
};



/**
 * 处理生成过程中的错误
 * @returns true 表示是用户取消，调用方应直接返回
 */
const handleGenerationError = (
	error: Error,
	context: string,
	skipMessage = false,
): boolean => {
	if (error.name === "AbortError") {
		return true;
	}
	console.error(`${context}失败:`, error);
	if (!skipMessage) {
		const message = error.message || `${context}失败`;
		errorMessage.value = message;
	}
	return false;
};

/**
 * 统一的文档加载函数
 */
const loadDocument = async (
	docId: string,
): Promise<{ title: string; content: string } | null> => {
	try {
		const docBlock = await api.getBlockByID(docId);
		if (!docBlock) {
			showMessage("无法获取文档信息", 3000, "error");
			return null;
		}

		const docContent = await api.exportMdContent(docId);
		if (!docContent || !docContent.content) {
			showMessage("无法获取文档内容", 3000, "error");
			return null;
		}

		return {
			title: docBlock.content || "未命名文档",
			content: docContent.content,
		};
	} catch (error) {
		console.error("加载文档失败:", error);
		showMessage("加载文档失败: " + (error as Error).message, 3000, "error");
		return null;
	}
};

/**
 * 默认的流式输出回调（同时更新显示内容和生成内容）
 */
const defaultOnChunk = (chunk: string) => {
	displayedContent.value += chunk;
	generatedContent.value += chunk;
};

/**
 * 移除Markdown内容中的Frontmatter（YAML元数据）
 * @param content 原始内容
 * @returns 移除frontmatter后的内容
 */
const removeFrontmatter = (content: string): string => {
	// 匹配开头的 --- ... --- 格式的YAML frontmatter
	const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
	return content.replace(frontmatterRegex, "").trim();
};

/**
 * 移除Markdown内容中的标题
 * @param content 原始内容
 * @returns 移除标题后的内容
 */
const removeHeadings = (content: string): string => {
	// 移除第一行（通常是对应标题）
	const lines = content.split("\n");
	if (lines.length <= 1) {
		return "";
	}
	// 移除第一行后返回剩余内容
	return lines.slice(1).join("\n").trim();
};

// 配置 marked 选项（只需配置一次）
marked.setOptions({
	breaks: true,
	gfm: true,
});

/**
 * 统一的 Markdown 渲染函数
 */
const renderMarkdown = (
	content: string,
	highlightKeywords: string[] = [],
): string => {
	if (!content) return "";

	try {
		let processedContent = content;

		// 对特定关键词进行高亮标记
		const boldKeywords = highlightKeywords
			.filter((k) => k.startsWith("bold:"))
			.map((k) => k.slice(6));
		const italicKeywords = highlightKeywords
			.filter((k) => k.startsWith("italic:"))
			.map((k) => k.slice(8));

		boldKeywords.forEach((keyword) => {
			processedContent = processedContent.replace(
				new RegExp(keyword, "gi"),
				`**${keyword}**`,
			);
		});
		italicKeywords.forEach((keyword) => {
			processedContent = processedContent.replace(
				new RegExp(keyword, "gi"),
				`*${keyword}*`,
			);
		});

		// 移除标题中的粗体标记（对主内容）
		processedContent = processedContent.replace(
			/^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm,
			"$1 $2",
		);

		return marked.parse(processedContent) as string;
	} catch (error) {
		console.error("Markdown渲染失败:", error);
		return `<pre>${content}</pre>`;
	}
};

// 渲染主内容 Markdown
const renderedDisplayedMarkdown = computed(() => {
	return renderMarkdown(displayedContent.value);
});

/**
 * 统一的代码高亮应用函数
 */
const applyCodeHighlighting = async (selector: string) => {
	await nextTick();
	const preBlocks = document.querySelectorAll(selector);
	preBlocks.forEach((block) => {
		if (!(block as HTMLElement).dataset.highlighted) {
			hljs.highlightElement(block as HTMLElement);
		}
	});
};

// 监听渲染内容变化，应用代码高亮
watch(renderedDisplayedMarkdown, () =>
	applyCodeHighlighting(".markdown-preview pre code"),
);

// 切换设置面板
const toggleSettings = () => {
	showSettings.value = !showSettings.value;
};

/**
 * 安全执行存储操作的辅助函数
 */
const safeStorageOperation = async <T>(
	operation: () => Promise<T>,
	errorMessage: string,
): Promise<T | null> => {
	if (!storage) return null;
	try {
		return await operation();
	} catch (error) {
		console.error(errorMessage, error);
		return null;
	}
};

// 清理编辑模式状态
const clearEditState = () => {
	editTargetDoc.value = null;
	originalContent.value = "";
	editCustomInput.value = "";
	lastEditHistory.value = null;
};

// 停止生成
const handleStop = () => {
	if (abortController.value) {
		abortController.value.abort();
	}
	resetAllGenerationStates();
};

/**
 * 统一的内容处理函数
 * 移除 frontmatter 和标题，并转换为思源兼容格式
 */
const processContent = (content: string): string => {
	const withoutFrontmatter = removeFrontmatter(content);
	const withoutHeadings = removeHeadings(withoutFrontmatter);
	return convertToSiyuanMarkdown(withoutHeadings);
};

/**
 * 根据内容类型处理内容
 * @param content 原始内容
 * @param isBlock 是否为块内容
 * @returns 处理后的内容
 */
const processContentByType = (content: string, isBlock: boolean): string => {
	const processed = isBlock ? removeFrontmatter(content) : content;
	return isBlock
		? convertToSiyuanMarkdown(processed)
		: processContent(content);
};

/**
 * 转换 Markdown 为思源兼容格式
 * 思源笔记对某些 Markdown 语法有特殊要求
 *
 * 注意：思源笔记在使用 markdown 模式时会解析 Markdown 语法
 * 但某些格式（如粗体）可能在某些情况下显示不正确
 */
const convertToSiyuanMarkdown = (content: string): string => {
	let converted = content;

	// 1. 确保标题前后有空行
	const headingStart = /([^\n])\n(#{1,6}\s)/g;
	const headingEnd = /(#{1,6}\s[^\n]+)\n([^\n#])/g;
	converted = converted.replace(headingStart, "$1\n\n$2");
	converted = converted.replace(headingEnd, "$1\n\n$2");

	// 2. 处理粗体格式
	// 思源笔记通过 updateBlock API 传入标准 Markdown 粗体语法 **text** 可正确渲染
	// 无需移除粗体标记

	// 3. 处理斜体格式（同样可能有显示问题，暂时保留）
	// converted = converted.replace(/\*([^*]+?)\*/g, '$1'); // 如需移除斜体，取消注释

	// 4. 确保代码块前后有空行
	const codeBlockStart = /([^\n])\n```/g;
	const codeBlockEnd = /```\n([^\n])/g;
	converted = converted.replace(codeBlockStart, "$1\n\n```");
	converted = converted.replace(codeBlockEnd, "```\n\n$1");

	// 5. 确保列表前后有空行
	const listUnordered = /([^\n])\n([-*+]\s)/g;
	const listOrdered = /([^\n])\n(\d+\.\s)/g;
	converted = converted.replace(listUnordered, "$1\n\n$2");
	converted = converted.replace(listOrdered, "$1\n\n$2");

	// 6. 清理多余的连续空行（最多保留两个换行符）
	converted = converted.replace(/\n{3,}/g, "\n\n");

	return converted;
};

// 复制内容
const copyContent = async () => {
	if (!generatedContent.value) return;

	try {
		// 转换为思源兼容的 Markdown 格式
		const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);
		await navigator.clipboard.writeText(siyuanContent);
		// showMessage('✓ 已复制Markdown到剪贴板', 2000, 'info');
	} catch (error) {
		console.error("复制失败:", error);
		showMessage("复制失败", 2000, "error");
	}
};

// 清除内容
const clearContent = () => {
	generatedContent.value = "";
	displayedContent.value = "";
	errorMessage.value = "";
};

// 选择目标文档
const selectTargetDocument = async () => {
	try {
		// 优先使用激活窗口的文档ID，而不是依赖光标位置
		// 这样可以确保选择的是用户当前正在查看的文档
		const protyle = document.querySelector(
			".layout__wnd--active .protyle:not(.fn__none)",
		);
		let docId =
			protyle
				?.querySelector(".protyle-background")
				?.getAttribute("data-node-id") || null;

		// 如果激活窗口方法失败，再通过光标位置获取
		if (!docId) {
			const currentBlockId = getCurrentBlockId();
			if (currentBlockId) {
				docId = await getDocIdByBlockId(currentBlockId);
			}
		}

		if (!docId) {
			showMessage("无法获取当前文档，请将光标放在文档中", 2000, "error");
			return;
		}

		await loadTargetDocument(docId);
	} catch (error) {
		console.error("选择文档失败:", error);
	}
};

/**
 * 设置目标文档状态
 */
const setTargetDocState = (doc: TargetDoc, content: string) => {
	editTargetDoc.value = doc;
	originalContent.value = content;
	generatedContent.value = content;
	displayedContent.value = content;
	editCustomInput.value = "";
	lastEditHistory.value = null;
};

// 加载目标文档
const loadTargetDocument = async (docId: string) => {
	const result = await loadDocument(docId);
	if (!result) return;

	// 移除frontmatter，获取纯净的Markdown内容
	const cleanContent = removeFrontmatter(result.content);

	// 设置目标文档状态
	setTargetDocState(
		{
			id: docId,
			title: result.title,
			content: cleanContent,
			isBlock: false,
		},
		cleanContent,
	);
};

// 清除目标文档
const clearTargetDocument = () => {
	clearEditState();
	clearContent();
	// showMessage('✓ 已清除目标文档', 1500, 'info');
};

// 应用编辑
const applyEdit = async () => {
	if (!editTargetDoc.value) return;

	isApplying.value = true;
	try {
		// 保存编辑历史（用于撤回）
		lastEditHistory.value = {
			docId: editTargetDoc.value.id,
			docTitle: editTargetDoc.value.title,
			originalContent: originalContent.value,
			timestamp: Date.now(),
		};

		// 区分文档和块的处理
		const siyuanContent = processContentByType(
			generatedContent.value,
			editTargetDoc.value.isBlock,
		);

		// 使用updateBlock API更新文档内容
		await api.updateBlock("markdown", siyuanContent, editTargetDoc.value.id);

		// 更新原始内容为当前内容
		originalContent.value = generatedContent.value;
		editTargetDoc.value.content = generatedContent.value;
	} catch (error) {
		console.error("应用编辑失败:", error);
	} finally {
		isApplying.value = false;
	}
};

// 撤回编辑
const undoEdit = async () => {
	if (!lastEditHistory.value) return;

	isUndoing.value = true;
	try {
		// 恢复原始内容
		await api.updateBlock(
			"markdown",
			lastEditHistory.value.originalContent,
			lastEditHistory.value.docId,
		);

		showMessage(
			`✓ 已撤回对文档的编辑: ${lastEditHistory.value.docTitle}`,
			2000,
			"info",
		);

		// 如果当前编辑的是同一个文档，更新界面
		if (
			editTargetDoc.value &&
			editTargetDoc.value.id === lastEditHistory.value.docId
		) {
			generatedContent.value = lastEditHistory.value.originalContent;
			displayedContent.value = lastEditHistory.value.originalContent;
			originalContent.value = lastEditHistory.value.originalContent;
			editTargetDoc.value.content = lastEditHistory.value.originalContent;
		}

		// 清除历史记录
		lastEditHistory.value = null;
	} catch (error) {
		console.error("撤回编辑失败:", error);
	} finally {
		isUndoing.value = false;
	}
};

/**
 * AI智能编辑功能
 */
const aiEditAction = async (
	action:
		| "polish"
		| "expand"
		| "condense"
		| "fix"
		| "rewrite"
		| "summary",
) => {
	if (!editTargetDoc.value) {
		showMessage("请先选择要编辑的文档", 2000, "info");
		return;
	}

	showSettings.value = false;

	const actionPrompts = {
		polish:
			"请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：",
		expand:
			"请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：",
		condense:
			"请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：",
		fix: "请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：",
		rewrite:
			"请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：",
		summary:
			"请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：",
	};

	startGeneration();

	try {
		const options: GenerateOptions = {
			userInput: `${actionPrompts[action]}\n\n${editTargetDoc.value.content}`,
			systemPrompt:
				"你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。",
			temperature: 0.3,
			maxTokens: maxTokens.value,
			signal: abortController.value?.signal,
			onChunk: defaultOnChunk,
		};

		await props.onGenerate(options);
	} catch (error) {
		if (handleGenerationError(error as Error, "AI编辑")) return;
	} finally {
		resetAllGenerationStates();
	}
};

/**
 * 编辑模式：自定义提问处理
 */
const handleCustomEdit = async () => {
	if (!editTargetDoc.value) {
		showMessage("请先选择要编辑的文档", 2000, "info");
		return;
	}

	// 如果既没有自定义输入，又没有选择提示词，则提示用户
	if (!editCustomInput.value.trim() && !currentPromptName.value) {
		showMessage("请输入编辑指令或选择提示词", 2000, "info");
		return;
	}

	showSettings.value = false;
	startGeneration();

	try {
		// 根据是否选择提示词来决定系统提示词
		let finalSystemPrompt =
			"你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。";
		let userInput: string;

		if (editCustomInput.value.trim()) {
			// 用户有自定义输入，使用自定义输入
			if (currentPromptName.value) {
				// 同时选择了提示词，使用选中的提示词配置
				finalSystemPrompt = systemPrompt.value;
			}

			userInput = `请根据以下指令对文档进行编辑。保持Markdown格式，直接输出编辑后的完整文档内容：

编辑指令：${editCustomInput.value}

原文档：
${editTargetDoc.value.content}`;
		} else {
			// 没有自定义输入，但选择了提示词，使用提示词配置直接生成
			finalSystemPrompt = systemPrompt.value;
			userInput = `${editTargetDoc.value.content}`;
		}

		const options: GenerateOptions = {
			userInput,
			systemPrompt: finalSystemPrompt,
			temperature: temperature.value,
			maxTokens: maxTokens.value,
			signal: abortController.value?.signal,
			onChunk: defaultOnChunk,
		};

		await props.onGenerate(options);

		editCustomInput.value = "";
	} catch (error) {
		if (handleGenerationError(error as Error, "自定义编辑")) return;
	} finally {
		resetAllGenerationStates();
	}
};

/**
 * 插入子文档功能
 */
const insertSubDocument = async () => {
	if (!editTargetDoc.value || !generatedContent.value) {
		showMessage("请先选择文档并生成内容", 2000, "info");
		return;
	}

	// 获取父文档的人性化路径，提取文档名
	const parentHPath = await api.getHPathByID(editTargetDoc.value.id);
	const parentDocName = parentHPath
		? parentHPath.split("/").pop() || "文档"
		: "文档";

	// 生成子文档名称：父文档名 + 总结
	const subDocTitle = `${parentDocName}总结`;

	// 添加时间戳以避免重复
	const timestamp = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-");
	const finalSubDocTitle = `${subDocTitle}_${timestamp}`;

	isInsertingSubDoc.value = true;

	try {
		// 使用统一的内容处理函数
		const siyuanContent = processContent(generatedContent.value);

		// 获取父文档信息
		const parentDoc = await api.getBlockByID(editTargetDoc.value.id);
		if (!parentDoc || !parentDoc.box) {
			throw new Error("无法获取父文档信息");
		}

		const notebookId = parentDoc.box;

		// 构建子文档路径：在父文档下创建子文档
		// 思源的路径格式：/笔记本/父文档路径/子文档名
		const subDocPath = `${parentHPath}/${finalSubDocTitle}`;

		// 创建子文档
		const subDocId = await api.createDocWithMd(
			notebookId,
			subDocPath,
			siyuanContent,
		);

		if (subDocId) {
			showMessage(
				`✓ 已在文档"${parentDoc.content || editTargetDoc.value.title}"下创建子文档: ${finalSubDocTitle}`,
				3000,
				"info",
			);
		} else {
			throw new Error("创建子文档失败");
		}
	} catch (error) {
		console.error("插入子文档失败:", error);
		showMessage("插入子文档失败: " + (error as Error).message, 3000, "error");
	} finally {
		isInsertingSubDoc.value = false;
	}
};

// 当聚焦配置名称输入框时，自动填充当前配置名称
const onPromptNameFocus = () => {
	if (currentPromptName.value && !newPromptName.value) {
		newPromptName.value = currentPromptName.value;
	}
};

// 保存当前提示词配置
const saveCurrentPrompt = async () => {
	// 如果输入框为空但有当前配置名称，使用当前配置名称
	const promptName = newPromptName.value.trim() || currentPromptName.value;

	if (!promptName) {
		showMessage("请输入配置名称", 2000, "info");
		return;
	}

	// 检查是否已存在同名配置（更新模式）
	const existingIndex = savedPrompts.value.findIndex(
		(p) => p.name === promptName,
	);

	const promptConfig: SavedPrompt = {
		id:
			existingIndex >= 0
				? savedPrompts.value[existingIndex].id
				: Date.now().toString(),
		name: promptName,
		systemPrompt: systemPrompt.value,
		temperature: temperature.value,
		maxTokens: maxTokens.value,
		contextMessageLimit: contextMessageLimit.value,
		createdAt:
			existingIndex >= 0
				? savedPrompts.value[existingIndex].createdAt
				: Date.now(),
	};

	if (existingIndex >= 0) {
		// 更新现有配置
		savedPrompts.value[existingIndex] = promptConfig;
	} else {
		// 添加新配置
		savedPrompts.value.push(promptConfig);
	}

	await safeStorageOperation(
		() => storage!.savePrompts(savedPrompts.value),
		"保存提示词配置失败:",
	);

	newPromptName.value = "";
	currentPromptName.value = promptName;
};

// 清除当前提示词选择
const clearCurrentPrompt = async () => {
	currentPromptName.value = "";
	await safeStorageOperation(
		() => storage!.clearCurrentPrompt(),
		"清除当前提示词失败:",
	);
};

/**
 * 获取当前光标所在的块ID
 */
function getCurrentBlockId(): string | null {
	// 方法1: 获取当前选中的块
	const selectedBlock = document.querySelector(".protyle-wysiwyg--select");
	if (selectedBlock) {
		return selectedBlock.getAttribute("data-node-id");
	}

	// 方法2: 获取光标所在的块（聚焦的块）
	const focusedBlock = document.querySelector(
		".protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus",
	);
	if (focusedBlock) {
		return focusedBlock.getAttribute("data-node-id");
	}

	// 方法3: 通过 window.getSelection() 精确获取光标位置
	const selection = window.getSelection();
	if (selection && selection.rangeCount > 0) {
		const range = selection.getRangeAt(0);
		let node: Node | null = range.startContainer;

		// 向上查找直到找到带有 data-node-id 和 data-type 的元素
		while (node) {
			if (node instanceof Element) {
				const nodeId = node.getAttribute("data-node-id");
				const dataType = node.getAttribute("data-type");

				// 必须同时有 data-node-id 和 data-type 才是有效的块
				if (nodeId && dataType) {
					return nodeId;
				}
			}
			node = node.parentNode;
		}
	}

	return null;
}

/**
 * 通过块ID获取其所属的文档ID
 */
async function getDocIdByBlockId(blockId: string): Promise<string | null> {
	try {
		const block = await api.getBlockByID(blockId);
		return block?.root_id || null;
	} catch (error) {
		console.error("获取文档ID失败:", error);
		return null;
	}
}

/**
 * 应用提示词配置到当前状态
 */
const applyPromptConfig = (prompt: SavedPrompt) => {
	systemPrompt.value = prompt.systemPrompt;
	temperature.value = prompt.temperature;
	maxTokens.value = prompt.maxTokens;
	contextMessageLimit.value = prompt.contextMessageLimit || 1;
	currentPromptName.value = prompt.name;
};

// 加载提示词配置
const loadPrompt = async (index: number) => {
	const prompt = savedPrompts.value[index];
	if (!prompt) return;

	applyPromptConfig(prompt);
	showPromptSelector.value = false;

	// 保存当前选中的提示词到存储
	await safeStorageOperation(
		() => storage!.saveCurrentPrompt(prompt.name),
		"保存当前提示词失败:",
	);
};

// 编辑提示词配置
const editPrompt = (index: number) => {
	const prompt = savedPrompts.value[index];
	if (!prompt) return;

	applyPromptConfig(prompt);

	// 打开设置面板以便编辑
	showSettings.value = true;
	showPromptSelector.value = false;
};

// 删除提示词配置
const deletePrompt = (index: number) => {
	const prompt = savedPrompts.value[index];
	if (!prompt) return;

	if (confirm(`确定删除配置: ${prompt.name}?`)) {
		savedPrompts.value.splice(index, 1);
		savePromptsToStorage();
	}
};

// 保存提示词到存储
const savePromptsToStorage = async () => {
	await safeStorageOperation(
		() => storage!.savePrompts(savedPrompts.value),
		"保存提示词配置失败:",
	);
};

// 从存储加载提示词配置
const loadPromptsFromStorage = async () => {
	if (!storage) return;

	try {
		const prompts = await storage.loadPrompts();
		if (prompts) {
			savedPrompts.value = prompts;
		}

		const loadedCurrentPromptName = await storage.loadCurrentPrompt();
		if (loadedCurrentPromptName) {
			const promptIndex = savedPrompts.value.findIndex(
				(p) => p.name === loadedCurrentPromptName,
			);
			if (promptIndex !== -1) {
				loadPrompt(promptIndex);
			}
		}
	} catch (error) {
		console.error("从插件存储加载提示词配置失败:", error);
	}
};

// 组件挂载时加载保存的提示词
onMounted(async () => {
	// 初始化存储实例
	if (props.plugin) {
		storage = new AIGeneratorStorage(props.plugin);
		await storage.init();
		await loadPromptsFromStorage();
		await loadSettings();
	}
});

// 是否已完成初始设置加载（用于避免初始加载时触发保存）
let isSettingsLoaded = false;

// 保存设置到存储
const saveSettings = async () => {
	if (!storage || !isSettingsLoaded) return;

	const settings = {
		systemPrompt: systemPrompt.value,
		temperature: temperature.value,
		maxTokens: maxTokens.value,
		contextMessageLimit: contextMessageLimit.value,
	};

	await safeStorageOperation(
		() => storage!.saveSettings(settings),
		"保存设置失败:",
	);
};

// 加载设置
const loadSettings = async () => {
	if (!storage) return;

	try {
		const settings = await storage.loadSettings();
		if (settings) {
			systemPrompt.value = settings.systemPrompt || systemPrompt.value;
			temperature.value = settings.temperature ?? temperature.value;
			maxTokens.value = settings.maxTokens || maxTokens.value;
			contextMessageLimit.value =
				settings.contextMessageLimit ?? contextMessageLimit.value;
		}
		isSettingsLoaded = true;
	} catch (error) {
		console.error("从插件存储加载设置失败:", error);
	}
};

// 监听设置变化（使用 debounce 避免频繁保存）
let settingsSaveTimer: number | null = null;
watch([systemPrompt, temperature, maxTokens, contextMessageLimit], () => {
	if (settingsSaveTimer) {
		clearTimeout(settingsSaveTimer);
	}
	settingsSaveTimer = window.setTimeout(() => {
		saveSettings();
	}, SETTINGS_SAVE_DEBOUNCE_MS);
});
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
