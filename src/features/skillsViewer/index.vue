<!-- Skills 查看器 — 查看和管理 AI 编程工具的 Skills 配置文件（逻辑位于 useSkillsViewer） -->
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
                <!-- 弹窗标题："Skills 查看器" -->
                <span class="sv-header-title">{{ i18n.title }}</span>
                <span
                  v-if="skills.length > 0"
                  class="sv-header-badge"
                >{{ skills.length }} Skills</span>
              </div>
              <!-- 关闭按钮 -->
              <button
                class="sv-close-btn"
                @click="closeDialog"
              >
                <IconWrapper name="close" :size="13" />
              </button>
            </div>
            <div class="skills-viewer-body">
              <!-- 顶部说明文案 -->
              <p class="sv-description">
                {{ i18n.desc }}
              </p>
              <div
                v-if="!managerAvailable"
                class="sv-unsupported"
              >
                <div class="sv-unsupported-icon">
                  <IconWrapper
                    name="warning"
                    :size="32"
                  />
                </div>
                <!-- 不支持提示文案 -->
                <div class="sv-unsupported-text">
                  {{ i18n.unsupported }}
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
                      <span class="sv-tool-icon"><IconWrapper :name="tool.icon" :size="14" /></span>
                      <span class="sv-tool-name">{{ tool.name }}</span>
                    </div>
                    <div class="sv-tool-status">
                      <template v-if="toolStatuses[tool.id]">
                        <span v-if="toolStatuses[tool.id].global || toolStatuses[tool.id].project">
                          <span class="sv-count">{{ (toolStatuses[tool.id].globalCount || 0) + (toolStatuses[tool.id].projectCount || 0) }}</span>
                          <!-- 数量单位 -->
                          {{ i18n.unit }}
                        </span>
                        <span
                          v-else
                          class="sv-tool-empty"
                        >{{ i18n.none }}</span>
                      </template>
                      <!-- 检测中状态 -->
                      <span
                        v-else
                        class="sv-tool-checking"
                      >{{ i18n.checking }}</span>
                    </div>
                  </div>
                </div>
                <div class="sv-project-path">
                  <!-- 项目路径标签 -->
                  <div class="sv-path-label">
                    <IconWrapper
                      name="folder"
                      :size="14"
                    />
                    {{ i18n.projectPath }}
                  </div>
                  <div class="sv-path-input-row">
                    <input
                      v-model="projectPath"
                      type="text"
                      class="sv-path-input"
                      :placeholder="i18n.projectPathPlaceholder"
                      @input="handlePathChange"
                    />
                  </div>
                </div>
                <div class="sv-actions">
                  <!-- 刷新扫描按钮 -->
                  <SiButton
                    variant="primary"
                    size="xsmall"
                    :loading="loading"
                    @click="refreshSkills"
                  >
                    {{ i18n.refresh }}
                  </SiButton>
                  <!-- 打开目录按钮 -->
                  <SiButton
                    variant="ghost"
                    size="xsmall"
                    @click="openCurrentToolDir"
                  >
                    {{ i18n.openDir }}
                  </SiButton>
                </div>
                <div
                  v-if="loading"
                  class="sv-loading"
                >
                  <div class="sv-loading-spinner"></div>
                  <!-- 扫描中提示 -->
                  <span class="sv-loading-text">{{ i18n.scanning }}</span>
                </div>
                <div
                  v-else-if="filteredSkills.length > 0"
                  class="sv-skills-list"
                >
                  <SkillCard
                    v-for="skill in filteredSkills"
                    :key="skill.filePath"
                    :skill="skill"
                    :editing="editingSkill === skill.filePath"
                    :expanded="expandedSkills.has(skill.filePath)"
                    :saving-skill="savingSkill"
                    :tool-color="getToolColor(skill.tool)"
                    :tool-name="getToolName(skill.tool)"
                    :i18n="i18n"
                    :edit-content="editContent"
                    @edit="startEdit(skill.filePath)"
                    @save="saveEdit(skill.filePath)"
                    @cancel-edit="cancelEdit"
                    @toggle-expand="toggleExpand(skill.filePath)"
                    @delete="confirmDeleteSkill(skill.filePath)"
                    @copy="confirmCopySkill(skill.filePath)"
                    @update:edit-content="(v) => editContent = v"
                  />
                </div>
                <div
                  v-else
                  class="sv-empty"
                >
                  <div class="sv-empty-icon">
                    <IconWrapper
                      name="search"
                      :size="40"
                    />
                  </div>
                  <!-- 空状态文案（区分全局/单工具） -->
                  <div class="sv-empty-text">
                    {{ selectedTool === 'all' ? i18n.noSkillsAllTools : i18n.noSkillsForTool }}
                  </div>
                  <!-- 空状态路径提示 -->
                  <div class="sv-empty-hint">
                    {{ i18n.pathHint }}
                  </div>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    <DeleteConfirmModal
      :visible="deleteConfirmVisible"
      :skill-name="deleteTargetSkill?.name || ''"
      :skill-path="deleteTargetSkill?.filePath || ''"
      :loading="deletingSkill"
      :i18n="i18n"
      @confirm="executeDeleteSkill"
      @cancel="cancelDeleteSkill"
    />
    <CopySkillModal
      :visible="copyConfirmVisible"
      :source-skill="copySourceSkill"
      :loading="copyingSkill"
      :i18n="i18n"
      @confirm="executeCopySkill"
      @cancel="cancelCopySkill"
    />
  </Teleport>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import SiButton from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import DeleteConfirmModal from "./components/DeleteConfirmModal.vue"
import CopySkillModal from "./components/CopySkillModal.vue"
import SkillCard from "./components/SkillCard.vue"
import { useSkillsViewer } from "./composables/useSkillsViewer"

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

const {
  aiTools,
  i18n,
  managerAvailable,
  selectedTool,
  projectPath,
  skills,
  loading,
  expandedSkills,
  editingSkill,
  editContent,
  savingSkill,
  deleteConfirmVisible,
  deleteTargetSkill,
  deletingSkill,
  copyConfirmVisible,
  copySourceSkill,
  copyingSkill,
  toolStatuses,
  filteredSkills,
  selectTool,
  getToolColor,
  getToolName,
  toggleExpand,
  startEdit,
  cancelEdit,
  saveEdit,
  confirmDeleteSkill,
  cancelDeleteSkill,
  confirmCopySkill,
  cancelCopySkill,
  executeCopySkill,
  executeDeleteSkill,
  refreshSkills,
  openCurrentToolDir,
  handlePathChange,
} = useSkillsViewer(props)

function closeDialog() {
  emit("update:visible", false)
  emit("close")
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
