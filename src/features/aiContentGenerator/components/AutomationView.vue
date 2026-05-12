<template>
  <div class="automation-view">
    <!-- 任务列表 -->
    <div class="automation-list">
      <div class="list-header">
        <span class="list-title">自动化任务</span>
        <button class="add-task-btn" @click="openEditor(null)">
          <svg width="14" height="14" viewBox="0 0 24 24"><use xlink:href="#iconAdd" /></svg>
          <span>新建任务</span>
        </button>
      </div>

      <!-- 空状态 -->
      <div v-if="tasks.length === 0" class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" class="empty-icon">
          <use xlink:href="#iconRefresh" />
        </svg>
        <p class="empty-text">暂无自动化任务</p>
        <p class="empty-hint">点击上方「新建任务」创建定时执行的 AI 任务</p>
      </div>

      <!-- 任务卡片列表 -->
      <div v-else class="task-cards">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-card"
          :class="{ disabled: !task.enabled }"
        >
          <div class="task-card-header">
            <div class="task-card-info">
              <span class="task-name">{{ task.name }}</span>
              <span class="task-frequency-badge">{{ frequencyLabel(task) }}</span>
            </div>
            <label class="toggle-switch" @click.stop>
              <input
                type="checkbox"
                :checked="task.enabled"
                @change="toggleTask(task)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="task-card-body">
            <p class="task-prompt-preview">{{ task.prompt }}</p>
          </div>
          <div class="task-card-footer">
            <span v-if="task.lastExecutedAt" class="task-last-run">
              上次执行: {{ formatTime(task.lastExecutedAt) }}
            </span>
            <span v-else class="task-last-run never">未执行</span>
            <div class="task-actions">
              <button class="task-action-btn" title="立即执行" @click="runTaskNow(task)">
                <svg width="14" height="14" viewBox="0 0 24 24"><use xlink:href="#iconRefresh" /></svg>
              </button>
              <button class="task-action-btn" title="编辑" @click="openEditor(task)">
                <svg width="14" height="14" viewBox="0 0 24 24"><use xlink:href="#iconEdit" /></svg>
              </button>
              <button class="task-action-btn danger" title="删除" @click="deleteTask(task)">
                <svg width="14" height="14" viewBox="0 0 24 24"><use xlink:href="#iconTrashcan" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑/新建弹窗 -->
    <Teleport to="body">
      <div v-if="showEditor" class="automation-modal-overlay" @click.self="closeEditor">
        <div class="automation-modal">
          <div class="modal-header">
            <span class="modal-title">{{ editingTask ? '编辑任务' : '新建自动化任务' }}</span>
            <button class="modal-close-btn" @click="closeEditor">
              <svg width="16" height="16" viewBox="0 0 24 24"><use xlink:href="#iconClose" /></svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- 任务名称 -->
            <div class="form-group">
              <label class="form-label">任务名称</label>
              <input
                v-model="form.name"
                class="form-input"
                placeholder="输入任务名称"
              />
            </div>

            <!-- 自定义提示词 -->
            <div class="form-group">
              <label class="form-label">自定义提示词</label>
              <textarea
                v-model="form.prompt"
                class="form-textarea"
                rows="4"
                placeholder="输入 AI 提示词，例如：请总结今日待办事项并生成报告"
              ></textarea>
            </div>

            <!-- 系统提示词 -->
            <div class="form-group">
              <label class="form-label">系统提示词</label>
              <textarea
                v-model="form.systemPrompt"
                class="form-textarea"
                rows="2"
                placeholder="设定 AI 的角色和行为约束（可选）"
              ></textarea>
            </div>

            <!-- 执行频率 -->
            <div class="form-group">
              <label class="form-label">执行频率</label>
              <div class="frequency-options">
                <button
                  v-for="opt in frequencyOptions"
                  :key="opt.value"
                  class="frequency-btn"
                  :class="{ active: form.frequency === opt.value }"
                  @click="form.frequency = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- 频率相关参数 -->
            <div v-if="form.frequency === 'hourly'" class="form-group">
              <label class="form-label">间隔时间（分钟）</label>
              <input
                v-model.number="form.intervalMinutes"
                class="form-input"
                type="number"
                min="1"
                max="1440"
                placeholder="60"
              />
            </div>

            <div v-if="form.frequency === 'daily'" class="form-group">
              <label class="form-label">执行时间</label>
              <input
                v-model="form.executeTime"
                class="form-input"
                type="time"
              />
            </div>

            <div v-if="form.frequency === 'weekly'" class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">执行日</label>
                <select v-model.number="form.weekDay" class="form-select">
                  <option :value="0">周日</option>
                  <option :value="1">周一</option>
                  <option :value="2">周二</option>
                  <option :value="3">周三</option>
                  <option :value="4">周四</option>
                  <option :value="5">周五</option>
                  <option :value="6">周六</option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">执行时间</label>
                <input
                  v-model="form.executeTime"
                  class="form-input"
                  type="time"
                />
              </div>
            </div>

            <div v-if="form.frequency === 'monthly'" class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">每月几号</label>
                <input
                  v-model.number="form.monthDay"
                  class="form-input"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="1"
                />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">执行时间</label>
                <input
                  v-model="form.executeTime"
                  class="form-input"
                  type="time"
                />
              </div>
            </div>

            <div v-if="form.frequency === 'custom'" class="form-group">
              <label class="form-label">Cron 表达式</label>
              <input
                v-model="form.customCron"
                class="form-input"
                placeholder="0 */2 * * *（每2小时执行一次）"
              />
              <span class="form-hint">格式：分 时 日 月 星期</span>
            </div>

            <!-- 高级参数 -->
            <details class="advanced-section">
              <summary class="advanced-toggle">高级参数</summary>
              <div class="advanced-body">
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label class="form-label">Temperature</label>
                    <input
                      v-model.number="form.temperature"
                      class="form-input"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                    />
                  </div>
                  <div class="form-group flex-1">
                    <label class="form-label">Max Tokens</label>
                    <input
                      v-model.number="form.maxTokens"
                      class="form-input"
                      type="number"
                      min="100"
                      max="100000"
                      step="100"
                    />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">目标文档ID（可选，留空则仅生成不写入）</label>
                  <input
                    v-model="form.targetDocId"
                    class="form-input"
                    placeholder="思源文档ID"
                  />
                </div>
              </div>
            </details>
          </div>

          <div class="modal-footer">
            <button class="modal-btn cancel" @click="closeEditor">取消</button>
            <button class="modal-btn confirm" @click="saveTask">
              {{ editingTask ? '保存' : '创建' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 执行结果弹窗 -->
      <div v-if="showResult" class="automation-modal-overlay" @click.self="closeResult">
        <div class="automation-modal result-modal">
          <div class="modal-header">
            <span class="modal-title">执行结果: {{ resultTaskName }}</span>
            <button class="modal-close-btn" @click="closeResult">
              <svg width="16" height="16" viewBox="0 0 24 24"><use xlink:href="#iconClose" /></svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- 加载中 -->
            <div v-if="isRunning" class="result-loading">
              <div class="loading-spinner-small"></div>
              <span>正在生成中...</span>
            </div>
            <!-- 结果内容 -->
            <div v-else class="result-content markdown-preview" v-html="renderedResult"></div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn cancel" @click="closeResult">关闭</button>
            <button
              v-if="resultContent && !isRunning"
              class="modal-btn confirm"
              @click="copyResult"
            >
              复制结果
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import { showMessage } from "siyuan"
import type { AutomationTask, AutomationFrequency } from "@/types/ai"
import type { GenerateOptions } from "@/types/ai"
import { AIGeneratorStorage } from "../types/storage"
import { renderMarkdown } from "../utils"
import * as api from "@/api"

interface Props {
  plugin: any
  onGenerate: (options: GenerateOptions) => Promise<string>
}

const props = defineProps<Props>()

let storage: AIGeneratorStorage | null = null

const tasks = ref<AutomationTask[]>([])
const showEditor = ref(false)
const editingTask = ref<AutomationTask | null>(null)

// ============ 执行结果 ============
const showResult = ref(false)
const resultTaskName = ref("")
const resultContent = ref("")
const isRunning = ref(false)

const renderedResult = computed(() => renderMarkdown(resultContent.value))

const frequencyOptions: { value: AutomationFrequency; label: string }[] = [
  { value: "hourly", label: "每小时" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "custom", label: "自定义" },
]

const defaultForm = (): Omit<AutomationTask, "id" | "createdAt"> => ({
  name: "",
  prompt: "",
  systemPrompt: "你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。",
  frequency: "daily",
  customCron: "",
  intervalMinutes: 60,
  weekDay: 1,
  monthDay: 1,
  executeTime: "09:00",
  enabled: true,
  targetDocId: "",
  temperature: 0.7,
  maxTokens: 10000,
})

const form = ref(defaultForm())

const frequencyLabel = (task: AutomationTask): string => {
  const map: Record<AutomationFrequency, string> = {
    hourly: task.intervalMinutes ? `每${task.intervalMinutes}分钟` : "每小时",
    daily: task.executeTime ? `每天 ${task.executeTime}` : "每天",
    weekly: `每周${["日", "一", "二", "三", "四", "五", "六"][task.weekDay ?? 0]}`,
    monthly: `每月${task.monthDay}日`,
    custom: task.customCron || "自定义",
  }
  return map[task.frequency] || "未知"
}

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const openEditor = (task: AutomationTask | null) => {
  editingTask.value = task
  if (task) {
    form.value = {
      name: task.name,
      prompt: task.prompt,
      systemPrompt: task.systemPrompt,
      frequency: task.frequency,
      customCron: task.customCron || "",
      intervalMinutes: task.intervalMinutes ?? 60,
      weekDay: task.weekDay ?? 1,
      monthDay: task.monthDay ?? 1,
      executeTime: task.executeTime || "09:00",
      enabled: task.enabled,
      targetDocId: task.targetDocId || "",
      temperature: task.temperature,
      maxTokens: task.maxTokens,
    }
  } else {
    form.value = defaultForm()
  }
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
  editingTask.value = null
}

const saveTask = async () => {
  if (!form.value.name.trim()) {
    showMessage("请输入任务名称", 2000, "info")
    return
  }
  if (!form.value.prompt.trim()) {
    showMessage("请输入自定义提示词", 2000, "info")
    return
  }

  if (editingTask.value) {
    const idx = tasks.value.findIndex((t: AutomationTask) => t.id === editingTask.value!.id)
    if (idx !== -1) {
      tasks.value[idx] = {
        ...editingTask.value,
        ...form.value,
        customCron: form.value.frequency === "custom" ? form.value.customCron : undefined,
        targetDocId: form.value.targetDocId || undefined,
      }
    }
  } else {
    const newTask: AutomationTask = {
      id: Date.now().toString(),
      createdAt: Date.now(),
      ...form.value,
      customCron: form.value.frequency === "custom" ? form.value.customCron : undefined,
      targetDocId: form.value.targetDocId || undefined,
    }
    tasks.value.push(newTask)
  }

  await saveTasksToStorage()
  showMessage(editingTask.value ? "任务已更新" : "任务已创建", 2000, "info")
  closeEditor()
}

const toggleTask = async (task: AutomationTask) => {
  task.enabled = !task.enabled
  await saveTasksToStorage()
}

const deleteTask = async (task: AutomationTask) => {
  if (!confirm(`确定删除任务「${task.name}」？`)) return
  tasks.value = tasks.value.filter((t: AutomationTask) => t.id !== task.id)
  await saveTasksToStorage()
}

const runTaskNow = async (task: AutomationTask) => {
  isRunning.value = true
  resultTaskName.value = task.name
  resultContent.value = ""
  showResult.value = true

  try {
    const options: GenerateOptions = {
      userInput: task.prompt,
      systemPrompt: task.systemPrompt,
      temperature: task.temperature,
      maxTokens: task.maxTokens,
    }

    const result = await props.onGenerate(options)

    if (result) {
      resultContent.value = result

      // 如果有目标文档ID，自动写入
      if (task.targetDocId) {
        await writeResultToDoc(task.targetDocId, result)
      }

      task.lastExecutedAt = Date.now()
      await saveTasksToStorage()
      showMessage(`任务「${task.name}」执行完成`, 2000, "info")
    } else {
      resultContent.value = "（执行完成，但未返回内容）"
      showMessage(`任务「${task.name}」未返回内容`, 2000, "info")
    }
  } catch (error) {
    console.error("执行任务失败:", error)
    resultContent.value = `执行失败: ${(error as Error).message}`
    showMessage("执行任务失败: " + (error as Error).message, 3000, "error")
  } finally {
    isRunning.value = false
  }
}

const writeResultToDoc = async (docId: string, content: string) => {
  try {
    await api.updateBlock("markdown", content, docId)
    showMessage(`已写入目标文档`, 2000, "info")
  } catch (error) {
    console.error("写入文档失败:", error)
    showMessage("写入文档失败: " + (error as Error).message, 3000, "error")
  }
}

const copyResult = async () => {
  if (!resultContent.value) return
  try {
    await navigator.clipboard.writeText(resultContent.value)
    showMessage("已复制到剪贴板", 2000, "info")
  } catch (error) {
    showMessage("复制失败", 2000, "error")
  }
}

const closeResult = () => {
  showResult.value = false
  resultContent.value = ""
  resultTaskName.value = ""
}

const saveTasksToStorage = async () => {
  if (!storage) return
  try {
    await storage.automationTasks.save(tasks.value)
  } catch (error) {
    console.error("保存自动化任务失败:", error)
  }
}

const loadTasksFromStorage = async () => {
  if (!storage) return
  try {
    const loaded = await storage.automationTasks.loadOrDefault()
    if (loaded) {
      tasks.value = loaded
    }
  } catch (error) {
    console.error("加载自动化任务失败:", error)
  }
}

onMounted(async () => {
  if (props.plugin) {
    storage = new AIGeneratorStorage(props.plugin)
    await storage.init()
    await loadTasksFromStorage()
  }
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss";

.automation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ============ 任务列表 ============
.automation-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.add-task-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-primary);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-primary);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.9;

  svg { flex-shrink: 0; }

  &:hover {
    opacity: 1;
    background: rgba(var(--b3-theme-primary-rgb), 0.08);
  }
}

// ============ 空状态 ============
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
}

.empty-icon {
  color: var(--b3-theme-primary);
  opacity: 0.3;
}

.empty-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.empty-hint {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

// ============ 任务卡片 ============
.task-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  padding: 10px;
  transition: opacity 0.2s;

  &.disabled {
    opacity: 0.55;
  }
}

.task-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.task-card-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.task-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-frequency-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

// ============ 开关 ============
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--b3-theme-surface-lighter);
  border-radius: 9px;
  transition: background 0.2s;

  &::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 2px;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--b3-theme-primary);

  &::before {
    transform: translateX(14px);
  }
}

.task-card-body {
  margin-bottom: 6px;
}

.task-prompt-preview {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-last-run {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;

  &.never {
    font-style: italic;
  }
}

.task-actions {
  display: flex;
  gap: 2px;
}

.task-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  opacity: 0.5;

  &:hover {
    opacity: 1;
    background: var(--b3-theme-surface-lighter);
  }

  &.danger:hover {
    color: var(--b3-theme-error);
    background: rgba(239, 68, 68, 0.1);
  }
}

// ============ 弹窗 ============
.automation-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.automation-modal {
  width: 400px;
  max-height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.modal-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.modal-btn {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;

  &.cancel {
    color: var(--b3-theme-on-surface);
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-surface-lighter);

    &:hover {
      background: var(--b3-theme-surface-light);
    }
  }

  &.confirm {
    color: var(--b3-theme-on-primary);
    background: var(--b3-theme-primary);

    &:hover {
      filter: brightness(1.1);
    }
  }
}

// ============ 表单 ============
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row {
  display: flex;
  gap: 10px;

  .flex-1 { flex: 1; min-width: 0; }
}

.form-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.form-input,
.form-textarea,
.form-select {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  outline: none;
  font-family: inherit;

  &:focus {
    border-color: var(--b3-theme-primary);
  }

  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.form-hint {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

// ============ 频率选择 ============
.frequency-options {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.frequency-btn {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    color: var(--b3-theme-primary);
    background: rgba(var(--b3-theme-primary-rgb), 0.1);
    border-color: var(--b3-theme-primary);
  }
}

// ============ 高级设置 ============
.advanced-section {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  overflow: hidden;
}

.advanced-toggle {
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var(--b3-theme-surface-light);
  }
}

.advanced-body {
  padding: 10px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// ============ 执行结果弹窗 ============
.result-modal {
  width: 480px;
  max-height: 80vh;
}

.result-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  font-size: 13px;
  color: var(--b3-theme-primary);
}

.result-content {
  flex: 1;
  min-height: 120px;
  max-height: 55vh;
  overflow-y: auto;
  padding: 10px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  user-select: text;
  cursor: text;

  :deep(h1), :deep(h2), :deep(h3) { margin-top: 0.5em; margin-bottom: 0.3em; font-weight: 500; }
  :deep(p) { margin: 0.3em 0; }
  :deep(code) { padding: 1px 4px; background: var(--b3-theme-surface-lighter); border-radius: 2px; font-size: 0.85em; }
  :deep(pre) { padding: 8px; background: var(--b3-theme-surface-lighter); border-radius: 4px; overflow-x: auto; margin: 0.4em 0;
    code { padding: 0; background: transparent; }
  }
  :deep(ul), :deep(ol) { margin: 0.3em 0; padding-left: 1.4em; }
  :deep(blockquote) { margin: 0.4em 0; padding-left: 0.5em; border-left: 2px solid var(--b3-theme-primary); opacity: 0.8; }
}

.loading-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
