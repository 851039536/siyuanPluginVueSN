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
                <IconWrapper
                  class="sv-header-icon"
                  name="sparkles"
                  :size="16"
                />
                <span class="sv-header-title">{{ i18n.skillsViewerTitle || 'Skills 查看器' }}</span>
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
                {{ i18n.skillsViewerDesc || '查看和管理 AI 编程工具的 Skills 配置文件，兼容 Claude、CodeBuddy、Qoder、Trae、Opencode' }}
              </p>

              <div
                v-if="!managerAvailable"
                class="sv-unsupported"
              >
                <div class="sv-unsupported-icon">
                  <IconWrapper
                    name="warning"
                    :size="16"
                  />
                </div>
                <div class="sv-unsupported-text">
                  {{ i18n.skillsViewerUnsupported || 'Skills 查看器需要桌面端 Electron 环境支持，当前环境不可用' }}
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
                          {{ i18n.skillsUnit || '个' }}
                        </span>
                        <span
                          v-else
                          class="sv-tool-empty"
                        >{{ i18n.noSkillsFound || '无' }}</span>
                      </template>
                      <span
                        v-else
                        class="sv-tool-checking"
                      >{{ i18n.checking || '检测中...' }}</span>
                    </div>
                  </div>
                </div>

                <div class="sv-project-path">
                  <div class="sv-path-label">
                    <IconWrapper
                      name="folder"
                      :size="14"
                    />
                    {{ i18n.projectPath || '项目路径' }}
                  </div>
                  <div class="sv-path-input-row">
                    <input
                      v-model="projectPath"
                      type="text"
                      class="sv-path-input"
                      :placeholder="i18n.projectPathPlaceholder || '输入项目根目录路径，用于扫描项目级 Skills'"
                      @change="handlePathChange"
                    />
                  </div>
                </div>

                <div class="sv-actions">
                  <SiButton
                    variant="primary"
                    size="xsmall"
                    :loading="loading"
                    @click="refreshSkills"
                  >
                    {{ i18n.refresh || '刷新扫描' }}
                  </SiButton>
                  <SiButton
                    variant="ghost"
                    size="xsmall"
                    @click="openCurrentToolDir"
                  >
                    {{ i18n.openDir || '打开目录' }}
                  </SiButton>
                </div>

                <div
                  v-if="loading"
                  class="sv-loading"
                >
                  <div class="sv-loading-spinner"></div>
                  <span class="sv-loading-text">{{ i18n.scanning || '正在扫描...' }}</span>
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
                          :title="i18n.editSkill || '编辑'"
                          @click="startEdit(index)"
                        >
                          <IconWrapper
                            name="edit"
                            :size="14"
                          />
                        </button>
                        <button
                          v-if="editingSkill !== index"
                          class="sv-skill-action-btn sv-skill-action-btn--copy"
                          :title="i18n.copySkill || '复制到其他工具'"
                          @click="confirmCopySkill(index)"
                        >
                          <IconWrapper
                            name="list"
                            :size="14"
                          />
                        </button>
                        <template v-if="editingSkill === index">
                          <button
                            class="sv-skill-action-btn sv-skill-action-btn--save"
                            :title="i18n.saveSkill || '保存'"
                            :disabled="savingSkill"
                            @click="saveEdit(index)"
                          >
                            <IconWrapper
                              v-if="!savingSkill"
                              name="save"
                              :size="14"
                            />
                            <span v-else>...</span>
                          </button>
                          <button
                            class="sv-skill-action-btn sv-skill-action-btn--cancel"
                            :title="i18n.cancelEdit || '取消'"
                            @click="cancelEdit"
                          >
                            ✖
                          </button>
                        </template>
                        <button
                          v-if="editingSkill !== index"
                          class="sv-skill-action-btn sv-skill-action-btn--delete"
                          :title="i18n.deleteSkill || '删除'"
                          @click="confirmDeleteSkill(index)"
                        >
                          <IconWrapper
                            name="delete"
                            :size="14"
                          />
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
                          :placeholder="i18n.editSkillPlaceholder || '编辑 Skill 内容...'"
                          spellcheck="false"
                        ></textarea>
                        <div class="sv-skill-editor-footer">
                          <span class="sv-skill-editor-hint">{{ i18n.editSkillHint || '修改完成后点击保存按钮写入文件' }}</span>
                        </div>
                      </div>
                    </template>

                    <template v-else>
                      <button
                        class="sv-skill-expand-btn"
                        @click="toggleExpand(index)"
                      >
                        {{ i18n.expand || '展开' }}
                        <span class="sv-expand-arrow">{{ expandedSkills.has(index) ? '▾' : '▸' }}</span>
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
                    <IconWrapper
                      name="search"
                      :size="16"
                    />
                  </div>
                  <div class="sv-empty-text">
                    {{ selectedTool === 'all'
                      ? (i18n.noSkillsAllTools || '未发现任何 AI 工具的 Skills 文件')
                      : (i18n.noSkillsForTool || '该工具下未发现 Skills 文件')
                    }}
                  </div>
                  <div class="sv-empty-hint">
                    {{ i18n.skillsPathHint || 'Skills 通常存放在 ~/.claude/skills/ 或项目目录下的 .claude/skills/' }}
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
          <IconWrapper
            class="sv-modal-icon"
            name="warning"
            :size="16"
          />
          <span class="sv-modal-title">{{ i18n.deleteSkillTitle || '确认删除 Skill' }}</span>
        </div>
        <div class="sv-modal-body">
          <p>{{ i18n.deleteSkillConfirm || '确定要删除以下 Skill 吗？此操作不可恢复。' }}</p>
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
            size="xsmall"
            @click="cancelDeleteSkill"
          >
            {{ i18n.cancel || '取消' }}
          </SiButton>
          <SiButton
            variant="danger"
            size="xsmall"
            :loading="deletingSkill"
            @click="executeDeleteSkill"
          >
            {{ i18n.confirmDelete || '确认删除' }}
          </SiButton>
        </div>
      </div>
    </div>

    <div
      v-if="copyConfirmVisible"
      class="sv-modal-overlay"
      @click.self="cancelCopySkill"
    >
      <div class="sv-modal">
        <div class="sv-modal-header">
          <IconWrapper
            class="sv-modal-icon"
            name="list"
            :size="16"
          />
          <span class="sv-modal-title">{{ i18n.copySkillTitle || '复制 Skill 到其他工具' }}</span>
        </div>
        <div class="sv-modal-body">
          <p>{{ i18n.copySkillConfirm || '选择目标 AI 编程工具，将当前 Skill 复制到对应 skills 目录' }}</p>
          <p class="sv-modal-skill-name">
            {{ copySourceSkill?.name }}
          </p>
          <div class="sv-modal-tool-select">
            <div
              v-for="tool in copyTargetTools"
              :key="tool.id"
              class="sv-modal-tool-option"
              :class="{ active: copyTargetToolId === tool.id }"
              :style="{ '--tool-color': tool.color }"
              @click="copyTargetToolId = tool.id"
            >
              <span class="sv-modal-tool-option-icon">{{ tool.icon }}</span>
              <span class="sv-modal-tool-option-name">{{ tool.name }}</span>
            </div>
          </div>
        </div>
        <div class="sv-modal-footer">
          <SiButton
            variant="ghost"
            size="xsmall"
            @click="cancelCopySkill"
          >
            {{ i18n.cancel || '取消' }}
          </SiButton>
          <SiButton
            variant="primary"
            size="xsmall"
            :loading="copyingSkill"
            :disabled="!copyTargetToolId"
            @click="executeCopySkill"
          >
            {{ i18n.copyTo || '复制到' }} {{ copyTargetToolId && getToolName(copyTargetToolId as AIToolType) }}
          </SiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  AIToolType,
  SkillInfo,
} from "./modules/SkillsViewerManager"
import { parseMarkdown } from "@/utils/mdRenderer"
import { showMessage } from "siyuan"
import {
  computed,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue"
import SiButton from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  AI_TOOLS,
  SkillsViewerManager,
} from "./modules/SkillsViewerManager"

interface Props {
  visible: boolean
  plugin?: Plugin | null
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

const i18n = computed(() => props.plugin?.i18n?.skillsViewer || {})

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

const copyConfirmVisible = ref(false)
const copySourceIndex = ref<number | null>(null)
const copyTargetToolId = ref<AIToolType | null>(null)
const copyingSkill = ref(false)

const deleteTargetSkill = computed(() => {
  if (deleteTargetIndex.value === null) return null
  return filteredSkills.value[deleteTargetIndex.value] || null
})

const copySourceSkill = computed(() => {
  if (copySourceIndex.value === null) return null
  return filteredSkills.value[copySourceIndex.value] || null
})

const copyTargetTools = computed(() =>
  AI_TOOLS.filter((t) => t.id !== copySourceSkill.value?.tool),
)

const toolStatuses = reactive<Record<string, {
  global: boolean
  project: boolean
  globalCount: number
  projectCount: number
}>>({})

const toolColorMap = new Map<AIToolType, string>(
  AI_TOOLS.map((t) => [t.id, t.color]),
)
const toolNameMap = new Map<AIToolType, string>(
  AI_TOOLS.map((t) => [t.id, t.name]),
)

const filteredSkills = computed(() => {
  if (selectedTool.value === "all") return skills.value
  return skills.value.filter((s) => s.tool === selectedTool.value)
})

function renderMarkdown(content: string): string {
  try {
    return parseMarkdown(content)
  } catch {
    return content
  }
}

function selectTool(toolId: string) {
  selectedTool.value = toolId
}

function getToolColor(toolId: AIToolType): string {
  return toolColorMap.get(toolId) || "#999"
}

function getToolName(toolId: AIToolType): string {
  return toolNameMap.get(toolId) || toolId
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
      showMessage(i18n.value.saveSkillSuccess || "保存成功", 2000, "info")
    } else {
      showMessage(i18n.value.saveSkillFailed || "保存失败", 2000, "error")
    }
  } catch (e) {
    console.error("保存 Skill 失败:", e)
    showMessage(i18n.value.saveSkillFailed || "保存失败", 2000, "error")
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

function confirmCopySkill(index: number) {
  copySourceIndex.value = index
  copyTargetToolId.value = null
  copyConfirmVisible.value = true
}

function cancelCopySkill() {
  copyConfirmVisible.value = false
  copySourceIndex.value = null
  copyTargetToolId.value = null
}

async function executeCopySkill() {
  if (copySourceIndex.value === null || !copyTargetToolId.value) return
  const skill = filteredSkills.value[copySourceIndex.value]
  if (!skill || copyingSkill.value) return

  const targetTool = AI_TOOLS.find((t) => t.id === copyTargetToolId.value)
  if (!targetTool) return

  copyingSkill.value = true
  try {
    const nodePath = window.require("path")
    const skillDir = nodePath.dirname(skill.filePath)
    const isGlobal = skill.filePath.startsWith(manager.getHomeDir())
    const targetBase = isGlobal ? manager.getHomeDir() : (projectPath.value || "")
    const targetPaths = isGlobal ? targetTool.skillPaths : targetTool.projectPaths

    let copied = false
    for (const relPath of targetPaths) {
      const targetDir = nodePath.join(targetBase, relPath)
      const success = await manager.copySkill(skillDir, targetDir)
      if (success) {
        copied = true
        break
      }
    }

    if (copied) {
      copyConfirmVisible.value = false
      copySourceIndex.value = null
      copyTargetToolId.value = null
      await checkAllToolStatuses()
      showMessage(
        `${i18n.value.copySkillSuccess || '已复制到'} ${targetTool.name}`,
        2000,
        "info",
      )
    } else {
      showMessage(i18n.value.copySkillFailed || '复制失败（目标已存在或权限不足）', 2000, "error")
    }
  } catch (e) {
    console.error("复制 Skill 失败:", e)
    showMessage(i18n.value.copySkillFailed || '复制失败', 2000, "error")
  } finally {
    copyingSkill.value = false
  }
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
      showMessage(i18n.value.deleteSkillSuccess || "删除成功", 2000, "info")
    } else {
      showMessage(i18n.value.deleteSkillFailed || "删除失败", 2000, "error")
    }
  } catch (e) {
    console.error("删除 Skill 失败:", e)
    showMessage(i18n.value.deleteSkillFailed || "删除失败", 2000, "error")
  } finally {
    deletingSkill.value = false
  }
}

async function checkAllToolStatuses() {
  const results = await Promise.all(
    AI_TOOLS.map(async (tool) => {
      const status = await manager.checkToolExists(
        tool,
        projectPath.value || undefined,
      )
      return {
        id: tool.id,
        status,
      }
    }),
  )
  for (const {
    id,
    status,
  } of results) {
    toolStatuses[id] = status
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
        ? `${i18n.value.scanComplete || '扫描完成'}：${skills.value.length} ${i18n.value.skillsUnit || '个 Skills'}`
        : (i18n.value.noSkillsFound || '未发现 Skills 文件'),
      2000,
      "info",
    )
  } catch (e) {
    console.error("扫描 Skills 失败:", e)
    showMessage(i18n.value.scanFailed || "扫描失败", 2000, "error")
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
      showMessage(i18n.value.openDirFailed || "打开目录失败", 2000, "error")
    }
  }
}

let pathChangeTimer: ReturnType<typeof setTimeout> | null = null

async function handlePathChange() {
  if (!managerAvailable) return
  if (pathChangeTimer) clearTimeout(pathChangeTimer)
  pathChangeTimer = setTimeout(async () => {
    await refreshSkills()
    pathChangeTimer = null
  }, 500)
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
