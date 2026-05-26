<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="skills-viewer-overlay"
        @click.self="closeDialog"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="skills-viewer-dialog"
          >
            <div class="skills-viewer-header">
              <div class="sv-header-left">
                <span class="sv-header-icon">🧩</span>
                <span class="sv-header-title">{{ i18n?.skillsViewerTitle || 'Skills 查看器' }}</span>
                <span
                  v-if="skills.length > 0"
                  class="sv-header-badge"
                >{{ skills.length }} Skills</span>
              </div>
              <button
                class="sv-close-btn"
                @click="closeDialog"
              >
                ✕
              </button>
            </div>

            <div class="skills-viewer-body">
              <p class="sv-description">
                {{ i18n?.skillsViewerDesc || '查看和管理 AI 编程工具的 Skills 配置文件，兼容 Claude、CodeBuddy、Qoder、Trae' }}
              </p>

              <div
                v-if="!managerAvailable"
                class="sv-unsupported"
              >
                <div class="sv-unsupported-icon">
                  ⚠️
                </div>
                <div class="sv-unsupported-text">
                  {{ i18n?.skillsViewerUnsupported || 'Skills 查看器需要桌面端 Electron 环境支持，当前环境不可用' }}
                </div>
              </div>

              <template v-if="managerAvailable">
                <div class="sv-tools-grid">
                  <div
                    v-for="tool in aiTools"
                    :key="tool.id"
                    class="sv-tool-card"
                    :class="{ active: selectedTool === tool.id }"
                    :style="{ '--tool-color': tool.color }"
                    @click="selectTool(tool.id)"
                  >
                    <div class="sv-tool-header">
                      <span class="sv-tool-icon">{{ tool.icon }}</span>
                      <span class="sv-tool-name">{{ tool.name }}</span>
                    </div>
                    <div class="sv-tool-status">
                      <template v-if="toolStatuses[tool.id]">
                        <span v-if="toolStatuses[tool.id].global || toolStatuses[tool.id].project">
                          <span class="sv-count">{{ (toolStatuses[tool.id].globalCount || 0) + (toolStatuses[tool.id].projectCount || 0) }}</span>
                          {{ i18n?.skillsUnit || '个 Skills' }}
                        </span>
                        <span v-else>{{ i18n?.noSkillsFound || '未发现 Skills' }}</span>
                      </template>
                      <span v-else>{{ i18n?.checking || '检测中...' }}</span>
                    </div>
                  </div>
                </div>

                <div class="sv-project-path">
                  <div class="sv-path-label">
                    <span>📁</span>
                    {{ i18n?.projectPath || '项目路径' }}
                  </div>
                  <div class="sv-path-input-row">
                    <input
                      v-model="projectPath"
                      type="text"
                      class="sv-path-input"
                      :placeholder="i18n?.projectPathPlaceholder || '输入项目根目录路径，用于扫描项目级 Skills'"
                      @change="handlePathChange"
                    />
                  </div>
                </div>

                <div class="sv-actions">
                  <SiButton
                    variant="primary"
                    size="small"
                    :loading="loading"
                    @click="refreshSkills"
                  >
                    {{ i18n?.refresh || '刷新扫描' }}
                  </SiButton>
                  <SiButton
                    variant="ghost"
                    size="small"
                    @click="openCurrentToolDir"
                  >
                    {{ i18n?.openDir || '打开目录' }}
                  </SiButton>
                </div>

                <div
                  v-if="loading"
                  class="sv-loading"
                >
                  <div class="sv-loading-spinner"></div>
                  <span class="sv-loading-text">{{ i18n?.scanning || '正在扫描...' }}</span>
                </div>

                <div
                  v-else-if="filteredSkills.length > 0"
                  class="sv-skills-list"
                >
                  <div
                    v-for="(skill, index) in filteredSkills"
                    :key="index"
                    class="sv-skill-card"
                    :class="{ 'sv-skill-card--editing': editingSkill === index }"
                    :style="{ '--tool-color': getToolColor(skill.tool) }"
                  >
                    <div class="sv-skill-header">
                      <div class="sv-skill-header-left">
                        <span class="sv-skill-name">{{ skill.name }}</span>
                        <span
                          class="sv-skill-tool-badge"
                          :style="{
                            background: `${getToolColor(skill.tool)}15`,
                            color: getToolColor(skill.tool),
                          }"
                        >
                          {{ getToolName(skill.tool) }}
                        </span>
                        <span class="sv-skill-size">{{ manager.formatFileSize(skill.fileSize) }}</span>
                      </div>
                      <div class="sv-skill-header-actions">
                        <button
                          v-if="editingSkill !== index"
                          class="sv-skill-action-btn sv-skill-action-btn--edit"
                          :title="i18n?.editSkill || '编辑'"
                          @click="startEdit(index)"
                        >
                          ✏️
                        </button>
                        <template v-if="editingSkill === index">
                          <button
                            class="sv-skill-action-btn sv-skill-action-btn--save"
                            :title="i18n?.saveSkill || '保存'"
                            :disabled="savingSkill"
                            @click="saveEdit(index)"
                          >
                            {{ savingSkill ? '...' : '💾' }}
                          </button>
                          <button
                            class="sv-skill-action-btn sv-skill-action-btn--cancel"
                            :title="i18n?.cancelEdit || '取消'"
                            @click="cancelEdit"
                          >
                            ✖
                          </button>
                        </template>
                        <button
                          v-if="editingSkill !== index"
                          class="sv-skill-action-btn sv-skill-action-btn--delete"
                          :title="i18n?.deleteSkill || '删除'"
                          @click="confirmDeleteSkill(index)"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div
                      v-if="skill.description"
                      class="sv-skill-desc"
                    >
                      {{ skill.description }}
                    </div>
                    <div
                      class="sv-skill-path"
                      :title="skill.filePath"
                    >
                      {{ skill.filePath }}
                    </div>

                    <template v-if="editingSkill === index">
                      <div class="sv-skill-editor">
                        <textarea
                          v-model="editContent"
                          class="sv-skill-editor-textarea"
                          :placeholder="i18n?.editSkillPlaceholder || '编辑 Skill 内容...'"
                          spellcheck="false"
                        ></textarea>
                        <div class="sv-skill-editor-footer">
                          <span class="sv-skill-editor-hint">{{ i18n?.editSkillHint || '修改完成后点击保存按钮写入文件' }}</span>
                        </div>
                      </div>
                    </template>

                    <template v-else>
                      <button
                        class="sv-skill-expand-btn"
                        @click="toggleExpand(index)"
                      >
                        {{ expandedSkills.has(index) ? (i18n?.collapse || '收起') : (i18n?.expand || '展开内容') }}
                        {{ expandedSkills.has(index) ? '▲' : '▼' }}
                      </button>
                      <div
                        v-if="expandedSkills.has(index)"
                        class="sv-skill-content"
                        v-html="renderMarkdown(skill.content)"
                      ></div>
                    </template>
                  </div>
                </div>

                <div
                  v-else
                  class="sv-empty"
                >
                  <div class="sv-empty-icon">
                    🔍
                  </div>
                  <div class="sv-empty-text">
                    {{ selectedTool === 'all'
                      ? (i18n?.noSkillsAllTools || '未发现任何 AI 工具的 Skills 文件')
                      : (i18n?.noSkillsForTool || '该工具下未发现 Skills 文件')
                    }}
                  </div>
                  <div class="sv-empty-hint">
                    {{ i18n?.skillsPathHint || 'Skills 通常存放在 ~/.claude/skills/ 或项目目录下的 .claude/skills/' }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <div
      v-if="deleteConfirmVisible"
      class="sv-modal-overlay"
      @click.self="cancelDeleteSkill"
    >
      <div class="sv-modal">
        <div class="sv-modal-header">
          <span class="sv-modal-icon">⚠️</span>
          <span class="sv-modal-title">{{ i18n?.deleteSkillTitle || '确认删除 Skill' }}</span>
        </div>
        <div class="sv-modal-body">
          <p>{{ i18n?.deleteSkillConfirm || '确定要删除以下 Skill 吗？此操作不可恢复。' }}</p>
          <p class="sv-modal-skill-name">
            {{ deleteTargetSkill?.name }}
          </p>
          <p class="sv-modal-skill-path">
            {{ deleteTargetSkill?.filePath }}
          </p>
        </div>
        <div class="sv-modal-footer">
          <SiButton
            variant="ghost"
            size="small"
            @click="cancelDeleteSkill"
          >
            {{ i18n?.cancel || '取消' }}
          </SiButton>
          <SiButton
            variant="danger"
            size="small"
            :loading="deletingSkill"
            @click="executeDeleteSkill"
          >
            {{ i18n?.confirmDelete || '确认删除' }}
          </SiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  AIToolType,
  SkillInfo,
} from "./modules/SkillsViewerManager"
import { marked } from "marked"
import { showMessage } from "siyuan"
import {
  computed,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue"
import SiButton from "@/components/Button.vue"
import {
  AI_TOOLS,
  SkillsViewerManager,
} from "./modules/SkillsViewerManager"

interface Props {
  visible: boolean
  plugin?: any
}

interface Emits {
  (e: "update:visible", v: boolean): void
  (e: "close"): void
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  plugin: null,
})

const emit = defineEmits<Emits>()

const i18n = () => props.plugin?.i18n?.skillsViewer || {}

const manager = new SkillsViewerManager()
const managerAvailable = manager.isAvailable()
const aiTools = AI_TOOLS

const selectedTool = ref<string>("all")
const projectPath = ref("")
const skills = ref<SkillInfo[]>([])
const loading = ref(false)
const expandedSkills = reactive(new Set<number>())

const editingSkill = ref<number | null>(null)
const editContent = ref("")
const savingSkill = ref(false)

const deleteConfirmVisible = ref(false)
const deleteTargetIndex = ref<number | null>(null)
const deletingSkill = ref(false)

const deleteTargetSkill = computed(() => {
  if (deleteTargetIndex.value === null) return null
  return filteredSkills.value[deleteTargetIndex.value] || null
})

const toolStatuses = reactive<Record<string, {
  global: boolean
  project: boolean
  globalCount: number
  projectCount: number
}>>({})

const filteredSkills = computed(() => {
  if (selectedTool.value === "all") return skills.value
  return skills.value.filter((s) => s.tool === selectedTool.value)
})

marked.use({
  breaks: true,
  gfm: true,
})

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string
  } catch {
    return content
  }
}

function selectTool(toolId: string) {
  selectedTool.value = toolId
}

function getToolColor(toolId: AIToolType): string {
  return AI_TOOLS.find((t) => t.id === toolId)?.color || "#999"
}

function getToolName(toolId: AIToolType): string {
  return AI_TOOLS.find((t) => t.id === toolId)?.name || toolId
}

function toggleExpand(index: number) {
  if (expandedSkills.has(index)) {
    expandedSkills.delete(index)
  } else {
    expandedSkills.add(index)
  }
}

function startEdit(index: number) {
  editingSkill.value = index
  editContent.value = filteredSkills.value[index].content
}

function cancelEdit() {
  editingSkill.value = null
  editContent.value = ""
}

async function saveEdit(index: number) {
  const skill = filteredSkills.value[index]
  if (!skill || savingSkill.value) return

  savingSkill.value = true
  try {
    const success = await manager.saveSkillContent(skill.filePath, editContent.value)
    if (success) {
      const originalIndex = skills.value.findIndex((s) => s.filePath === skill.filePath)
      if (originalIndex !== -1) {
        skills.value[originalIndex].content = editContent.value
        const dirName = skill.filePath.split(/[\\/]/).slice(-2, -1)[0]
        const parsed = manager.parseSkillMd(editContent.value, dirName)
        skills.value[originalIndex].name = parsed.name
        skills.value[originalIndex].description = parsed.description
      }
      editingSkill.value = null
      editContent.value = ""
      showMessage((i18n() as any)?.saveSkillSuccess || "保存成功", 2000, "info")
    } else {
      showMessage((i18n() as any)?.saveSkillFailed || "保存失败", 2000, "error")
    }
  } catch (e) {
    console.error("保存 Skill 失败:", e)
    showMessage((i18n() as any)?.saveSkillFailed || "保存失败", 2000, "error")
  } finally {
    savingSkill.value = false
  }
}

function confirmDeleteSkill(index: number) {
  deleteTargetIndex.value = index
  deleteConfirmVisible.value = true
}

function cancelDeleteSkill() {
  deleteConfirmVisible.value = false
  deleteTargetIndex.value = null
}

async function executeDeleteSkill() {
  if (deleteTargetIndex.value === null) return
  const skill = filteredSkills.value[deleteTargetIndex.value]
  if (!skill || deletingSkill.value) return

  deletingSkill.value = true
  try {
    const nodePath = window.require("path")
    const skillDir = nodePath.dirname(skill.filePath)
    const success = await manager.deleteSkill(skillDir)
    if (success) {
      const originalIndex = skills.value.findIndex((s) => s.filePath === skill.filePath)
      if (originalIndex !== -1) {
        skills.value.splice(originalIndex, 1)
      }
      deleteConfirmVisible.value = false
      deleteTargetIndex.value = null
      showMessage((i18n() as any)?.deleteSkillSuccess || "删除成功", 2000, "info")
    } else {
      showMessage((i18n() as any)?.deleteSkillFailed || "删除失败", 2000, "error")
    }
  } catch (e) {
    console.error("删除 Skill 失败:", e)
    showMessage((i18n() as any)?.deleteSkillFailed || "删除失败", 2000, "error")
  } finally {
    deletingSkill.value = false
  }
}

async function checkAllToolStatuses() {
  for (const tool of AI_TOOLS) {
    toolStatuses[tool.id] = await manager.checkToolExists(tool, projectPath.value || undefined)
  }
}

async function refreshSkills() {
  if (!managerAvailable) return
  loading.value = true
  expandedSkills.clear()
  editingSkill.value = null

  try {
    skills.value = await manager.scanAllSkills(projectPath.value || undefined)
    await checkAllToolStatuses()
    showMessage(
      skills.value.length > 0
        ? `${(i18n() as any)?.scanComplete || '扫描完成'}：${skills.value.length} ${(i18n() as any)?.skillsUnit || '个 Skills'}`
        : ((i18n() as any)?.noSkillsFound || '未发现 Skills 文件'),
      2000,
      "info",
    )
  } catch (e) {
    console.error("扫描 Skills 失败:", e)
    showMessage((i18n() as any)?.scanFailed || "扫描失败", 2000, "error")
  } finally {
    loading.value = false
  }
}

async function openCurrentToolDir() {
  if (!managerAvailable) return

  let dirPath = ""
  if (selectedTool.value === "all") {
    dirPath = manager.getHomeDir()
  } else {
    const tool = AI_TOOLS.find((t) => t.id === selectedTool.value)
    if (tool && tool.skillPaths.length > 0) {
      const nodePath = window.require("path")
      dirPath = nodePath.join(manager.getHomeDir(), tool.skillPaths[0])
    }
  }

  if (dirPath) {
    const success = await manager.openInFileManager(dirPath)
    if (!success) {
      showMessage((i18n() as any)?.openDirFailed || "打开目录失败", 2000, "error")
    }
  }
}

async function handlePathChange() {
  await refreshSkills()
}

function closeDialog() {
  emit("update:visible", false)
  emit("close")
}

let hasInitialized = false

watch(() => props.visible, async (v) => {
  if (v && !hasInitialized && managerAvailable) {
    hasInitialized = true
    await checkAllToolStatuses()
    await refreshSkills()
  }
})

onBeforeUnmount(() => {
  manager.destroy()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
