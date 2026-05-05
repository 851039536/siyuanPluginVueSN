<template>
  <div class="chat-view">
    <!-- 顶部操作栏 -->
    <div class="chat-toolbar">
      <div class="skill-selector">
        <select v-model="currentSkillId" class="skill-select" @change="onSkillChange">
          <option
            v-for="skill in skills"
            :key="skill.id"
            :value="skill.id"
          >
            {{ skill.name }} ({{ getToolName(skill.tool) }})
          </option>
        </select>
      </div>
      <button class="new-chat-btn" title="新建对话" @click="startNewConversation">
        <svg width="14" height="14"><use xlink:href="#iconAdd" /></svg>
        <span>新建</span>
      </button>
    </div>

    <!-- 消息列表 -->
    <div ref="messageListRef" class="message-list">
      <!-- 环境不兼容 -->
      <div v-if="!managerAvailable" class="chat-empty-state">
        <div class="chat-empty-icon">
          <svg width="48" height="48"><use xlink:href="#iconWarn" /></svg>
        </div>
        <p class="chat-empty-title">当前环境不支持</p>
        <p class="chat-empty-desc">技能问答需要桌面端 Electron 环境支持（需要扫描 .claude/skills、.codebuddy/skills 等目录）。</p>
      </div>

      <!-- 无技能提示 -->
      <div v-else-if="skills.length === 0" class="chat-empty-state">
        <div class="chat-empty-icon">
          <svg width="48" height="48"><use xlink:href="#iconStar" /></svg>
        </div>
        <p class="chat-empty-title">未发现技能</p>
        <p class="chat-empty-desc">未扫描到 AI 编程工具的技能文件。请在 Claude、CodeBuddy 等工具的 skills 目录下创建 skill.md 文件。</p>
      </div>

      <!-- 空状态（有技能但未开始对话） -->
      <div v-else-if="messages.length === 0" class="chat-empty-state">
        <div class="chat-empty-icon">
          <svg width="48" height="48"><use xlink:href="#iconSparkles" /></svg>
        </div>
        <p class="chat-empty-title">{{ currentSkill ? currentSkill.description || '准备就绪' : '选择技能开始对话' }}</p>
        <p class="chat-empty-desc">技能 "{{ currentSkill?.name }}"（来源：{{ currentSkill ? getToolName(currentSkill.tool) : '' }}）的内容将作为 AI 指令。开始提问吧！</p>
      </div>

      <!-- 消息气泡 -->
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="message-bubble"
        :class="[msg.role === 'user' ? 'user-message' : 'ai-message', { 'streaming': msg.isStreaming }]"
      >
        <div class="message-avatar">
          <svg v-if="msg.role === 'assistant'" width="18" height="18"><use xlink:href="#iconSparkles" /></svg>
          <svg v-else width="18" height="18"><use xlink:href="#iconUser" /></svg>
        </div>
        <div class="message-content-wrapper">
          <div class="message-role-label">{{ msg.role === 'user' ? '你' : (currentSkill?.name || 'AI') }}</div>
          <div class="message-content markdown-body" v-html="renderMessage(msg.content)"></div>
          <div v-if="msg.role === 'assistant' && index === messages.length - 1" class="message-actions">
            <button
              v-if="msg.isStreaming"
              class="stop-btn"
              title="停止生成"
              @click="$emit('stop-generation')"
            >
              <svg width="14" height="14"><use xlink:href="#iconClose" /></svg>
              停止
            </button>
            <button
              v-else-if="msg.content"
              class="copy-btn"
              title="复制"
              @click="copyMessage(msg.content)"
            >
              <svg width="14" height="14"><use xlink:href="#iconCopy" /></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="chat-error">
        <svg width="14" height="14"><use xlink:href="#iconCloseRound" /></svg>
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- 底部输入区 -->
    <div class="chat-input-area">
      <div class="chat-input-row">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-input"
          placeholder="输入消息..."
          :rows="1"
          :disabled="isStreaming || skills.length === 0 || !managerAvailable"
          @keydown.enter.exact.prevent="onSendClick"
          @input="autoResizeTextarea"
        />
        <button
          v-if="!isStreaming"
          class="send-btn"
          :disabled="!inputText.trim() || skills.length === 0 || !managerAvailable"
          title="发送"
          @click="onSendClick"
        >
          <svg width="16" height="16"><use xlink:href="#iconSparkles" /></svg>
        </button>
        <button
          v-else
          class="stop-btn send-btn"
          title="停止生成"
          @click="$emit('stop-generation')"
        >
          <svg width="16" height="16"><use xlink:href="#iconClose" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue"
import { marked } from "marked"
import type { ChatMessage, ChatOptions } from "@/types/ai"
import { SkillsViewerManager, AI_TOOLS } from "@/features/generalSettings/modules/SkillsViewerManager"
import type { SkillInfo, AIToolType } from "@/features/generalSettings/modules/SkillsViewerManager"
import { showMessage } from "siyuan"

/** 本地技能展示类型 */
interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  tool: AIToolType
}

interface Props {
  plugin: any
  onChat?: (messages: Array<{ role: string; content: string }>, options: ChatOptions) => Promise<string>
}

const props = defineProps<Props>()

defineEmits<{
  (e: "stop-generation"): void
}>()

/** 获取工具显示名称 */
function getToolName(toolId: AIToolType): string {
  return AI_TOOLS.find((t) => t.id === toolId)?.name || toolId
}

// ============ 状态 ============
const skills = ref<SkillItem[]>([])
const currentSkillId = ref("")
const managerAvailable = ref(true)
const messages = ref<ChatMessage[]>([])
const inputText = ref("")
const isStreaming = ref(false)
const error = ref("")
const messageListRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
let abortController: AbortController | null = null

// ============ 计算属性 ============
const currentSkill = computed(() => {
  return skills.value.find((s) => s.id === currentSkillId.value) || null
})

// ============ 加载技能（从 AI 工具目录扫描） ============
async function loadSkills() {
  try {
    const manager = new SkillsViewerManager()
    if (!manager.isAvailable()) {
      managerAvailable.value = false
      return
    }

    // 尝试从插件获取工作区根路径（用于扫描项目级技能）
    let projectPath = ""
    try {
      if (props.plugin?.dataPath) {
        // SiYuan 的 dataPath 是 workspace/data/，/data 截掉即为工作区根目录
        projectPath = props.plugin.dataPath.replace(/\/data$/, "").replace(/\\data$/, "")
      }
    } catch {
      // 忽略，只扫全局
    }

    const skillInfos = await manager.scanAllSkills(projectPath || undefined)
    skills.value = skillInfos.map((s: SkillInfo) => ({
      id: s.filePath,
      name: s.name,
      description: s.description,
      content: s.content,
      tool: s.tool,
    }))

    if (skills.value.length > 0 && !currentSkillId.value) {
      currentSkillId.value = skills.value[0].id
    }
  } catch (err) {
    console.error("扫描技能失败:", err)
    managerAvailable.value = false
  }
}

// ============ 方法 ============

/** 切换技能时重置对话 */
const onSkillChange = () => {
  startNewConversation()
}

/** 新建对话 */
const startNewConversation = () => {
  messages.value = []
  error.value = ""
  inputText.value = ""
  isStreaming.value = false
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

/** 渲染 Markdown */
const renderMessage = (content: string): string => {
  if (!content) return ""
  try {
    return marked.parse(content, { breaks: true }) as string
  } catch {
    return `<pre>${content}</pre>`
  }
}

/** 复制消息内容 */
const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    showMessage("已复制", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
}

/** 自动调整 textarea 高度 */
const autoResizeTextarea = () => {
  const el = inputRef.value
  if (!el) return
  el.style.height = "auto"
  el.style.height = el.scrollHeight + "px"
}

/** 发送消息 */
const onSendClick = () => {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  sendMessage(text)
}

const sendMessage = async (text: string) => {
  if (isStreaming.value) return
  if (!text.trim()) return

  const skill = currentSkill.value
  if (!skill) return

  inputText.value = ""
  error.value = ""

  // 重置 textarea 高度
  if (inputRef.value) {
    inputRef.value.style.height = "auto"
  }

  // 添加用户消息
  const userMsg: ChatMessage = {
    role: "user",
    content: text,
    timestamp: Date.now(),
  }
  messages.value.push(userMsg)

  // 添加空的 AI 消息（用于流式输出）
  const aiMsg: ChatMessage = {
    role: "assistant",
    content: "",
    timestamp: Date.now(),
    isStreaming: true,
  }
  messages.value.push(aiMsg)
  isStreaming.value = true

  // 滚动到底部
  await scrollToBottom()

  // 构建 messages 数组：system(技能内容) + 对话历史
  const chatMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: skill.content },
    ...messages.value
      .slice(0, -1) // 排除当前正在流的 AI 消息
      .map((m) => ({ role: m.role, content: m.content })),
  ]

  abortController = new AbortController()

  try {
    const result = await props.onChat!(chatMessages, {
      temperature: 0.7,
      maxTokens: 4000,
      signal: abortController.signal,
      onChunk: (chunk) => {
        // 更新最后一条 AI 消息的内容
        const lastMsg = messages.value[messages.value.length - 1]
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content += chunk
        }
      },
    })

    // 流式完成
    const finalMsg = messages.value[messages.value.length - 1]
    if (finalMsg) {
      finalMsg.isStreaming = false
    }
  } catch (err: any) {
    // 处理错误
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === "assistant") {
      lastMsg.isStreaming = false
    }

    if (err.name === "AbortError") {
      // 用户取消，保留已生成的部分
    } else {
      error.value = err.message || "生成失败"
      console.error("Chat 生成失败:", err)
    }
  } finally {
    isStreaming.value = false
    abortController = null
    await scrollToBottom()
  }
}

/** 停止生成（由父组件或其他来源调用） */
const stopGeneration = () => {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  isStreaming.value = false
  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg) {
    lastMsg.isStreaming = false
  }
}

/** 滚动到底部 */
const scrollToBottom = async () => {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

// ============ 生命周期 ============

// 加载技能并监听消息变化自动滚动
watch(messages, scrollToBottom, { deep: true })

onMounted(async () => {
  await loadSkills()
  inputRef.value?.focus()
})

onUnmounted(() => {
  if (abortController) {
    abortController.abort()
  }
})

// 暴露方法给父组件
defineExpose({
  stopGeneration,
  startNewConversation,
})
</script>

<style scoped lang="scss">
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ========== 顶部操作栏 ==========
.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  gap: 6px;
  flex-shrink: 0;
}

.skill-selector {
  flex: 1;
  min-width: 0;
}

.skill-select {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 5px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.new-chat-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  svg { color: var(--b3-theme-primary); }

  &:hover {
    background: var(--b3-theme-surface-light);
    border-color: var(--b3-theme-primary);
  }
}

// ========== 消息列表 ==========
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

// 空状态
.chat-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 20px 16px;
}

.chat-empty-icon {
  svg { color: var(--b3-theme-primary); opacity: 0.35; }
}

.chat-empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.chat-empty-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  max-width: 280px;
  line-height: 1.5;
}

// 消息气泡
.message-bubble {
  display: flex;
  gap: 8px;
  max-width: 100%;

  &.user-message {
    flex-direction: row-reverse;

    .message-content-wrapper {
      align-items: flex-end;
    }

    .message-content {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border-radius: 12px 4px 12px 12px;
    }

    .message-role-label {
      text-align: right;
    }
  }

  &.ai-message {
    .message-content {
      background: var(--b3-theme-surface);
      border: 1px solid var(--b3-theme-surface-lighter);
      border-radius: 4px 12px 12px 12px;
    }
  }

  &.streaming {
    .message-content {
      border-color: var(--b3-theme-primary);
      opacity: 0.85;
    }
  }
}

.message-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--b3-theme-surface-light);
  flex-shrink: 0;

  svg { color: var(--b3-theme-primary); opacity: 0.7; }
}

.user-message .message-avatar {
  background: var(--b3-theme-primary);
  svg { color: var(--b3-theme-on-primary); }
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: calc(100% - 36px);
  min-width: 0;
}

.message-role-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  padding: 0 2px;
}

.message-content {
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: break-word;
  user-select: text;
  cursor: text;
  min-width: 40px;

  :deep(p) { margin: 0.3em 0; &:first-child { margin-top: 0; } &:last-child { margin-bottom: 0; } }
  :deep(h1), :deep(h2), :deep(h3), :deep(h4) { margin: 0.5em 0 0.25em; font-weight: 500; }
  :deep(h1) { font-size: 1.2em; }
  :deep(h2) { font-size: 1.1em; }
  :deep(h3) { font-size: 1.05em; }
  :deep(ul), :deep(ol) { margin: 0.3em 0; padding-left: 1.3em; }
  :deep(li) { margin: 0.15em 0; }
  :deep(code) {
    padding: 1px 4px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 2px;
    font-size: 0.85em;
  }
  :deep(pre) {
    padding: 8px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 4px;
    overflow-x: auto;
    margin: 0.4em 0;
    code { padding: 0; background: transparent; }
  }
  :deep(blockquote) {
    margin: 0.3em 0;
    padding-left: 0.5em;
    border-left: 2px solid var(--b3-theme-primary);
    opacity: 0.8;
  }
  :deep(a) { color: var(--b3-theme-primary); text-decoration: none; }
  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.3em 0;
    th, td { border: 1px solid var(--b3-theme-surface-lighter); padding: 3px 5px; }
  }
  :deep(hr) { margin: 0.5em 0; border: none; border-top: 1px solid var(--b3-theme-surface-lighter); }
}

.message-actions {
  display: flex;
  gap: 4px;
  padding: 2px 0;
}

.copy-btn, .stop-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  background: transparent;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;

  svg { color: var(--b3-theme-primary); opacity: 0.7; }

  &:hover {
    background: var(--b3-theme-surface-light);
    opacity: 1;
  }
}

.message-bubble:hover .copy-btn,
.message-bubble:hover .stop-btn {
  opacity: 0.8;
}

.stop-btn {
  color: var(--b3-theme-error);
  border-color: var(--b3-theme-error);
  opacity: 1;

  svg { color: var(--b3-theme-error); }
}

// 错误提示
.chat-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--b3-theme-error);
  background: rgba(239, 68, 68, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.15);

  svg { flex-shrink: 0; }
}

// ========== 底部输入区 ==========
.chat-input-area {
  padding: 6px 8px 8px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.chat-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  outline: none;
  resize: none;
  max-height: 120px;
  font-family: inherit;

  &:focus {
    border-color: var(--b3-theme-primary);
  }

  &:disabled {
    opacity: 0.6;
  }

  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--b3-theme-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;

  svg { color: var(--b3-theme-on-primary); }

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.stop-btn {
    background: var(--b3-theme-error);
    svg { color: var(--b3-theme-on-primary); }
  }
}
</style>
