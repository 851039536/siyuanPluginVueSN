<template>
  <div class="skills-viewer-settings">
    <div class="sv-header">
      <span class="sv-header-icon">🧩</span>
      <span class="sv-header-title">{{ i18n?.skillsViewerTitle || 'Skills 查看器' }}</span>
      <span v-if="skills.length > 0" class="sv-header-badge">{{ skills.length }} Skills</span>
    </div>

    <p class="sv-description">
      {{ i18n?.skillsViewerDesc || '查看和管理 AI 编程工具的 Skills 配置文件，兼容 Claude、CodeBuddy、Qoder、Trae' }}
    </p>

    <!-- 不支持提示 -->
    <div v-if="!managerAvailable" class="sv-unsupported">
      <div class="sv-unsupported-icon">⚠️</div>
      <div class="sv-unsupported-text">
        {{ i18n?.skillsViewerUnsupported || 'Skills 查看器需要桌面端 Electron 环境支持，当前环境不可用' }}
      </div>
    </div>

    <template v-if="managerAvailable">
      <!-- 工具选择卡片 -->
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

      <!-- 项目路径 -->
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

      <!-- 操作按钮 -->
      <div class="sv-actions">
        <SiButton variant="primary" size="small" :loading="loading" @click="refreshSkills">
          {{ i18n?.refresh || '刷新扫描' }}
        </SiButton>
        <SiButton variant="ghost" size="small" @click="openCurrentToolDir">
          {{ i18n?.openDir || '打开目录' }}
        </SiButton>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="sv-loading">
        <div class="sv-loading-spinner"></div>
        <span class="sv-loading-text">{{ i18n?.scanning || '正在扫描...' }}</span>
      </div>

      <!-- Skills 列表 -->
      <div v-else-if="filteredSkills.length > 0" class="sv-skills-list">
        <div
          v-for="(skill, index) in filteredSkills"
          :key="index"
          class="sv-skill-card"
          :style="{ '--tool-color': getToolColor(skill.tool) }"
        >
          <div class="sv-skill-header">
            <span class="sv-skill-name">{{ skill.name }}</span>
            <span
              class="sv-skill-tool-badge"
              :style="{
                background: getToolColor(skill.tool) + '15',
                color: getToolColor(skill.tool),
              }"
            >
              {{ getToolName(skill.tool) }}
            </span>
          </div>
          <div v-if="skill.description" class="sv-skill-desc">{{ skill.description }}</div>
          <div class="sv-skill-path" :title="skill.filePath">{{ skill.filePath }}</div>
          <button class="sv-skill-expand-btn" @click="toggleExpand(index)">
            {{ expandedSkills.has(index) ? (i18n?.collapse || '收起') : (i18n?.expand || '展开内容') }}
            {{ expandedSkills.has(index) ? '▲' : '▼' }}
          </button>
          <div v-if="expandedSkills.has(index)" class="sv-skill-content">{{ skill.content }}</div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="sv-empty">
        <div class="sv-empty-icon">🔍</div>
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
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { showMessage } from "siyuan";
import SiButton from "@/components/Button.vue";
import {
  SkillsViewerManager,
  AI_TOOLS,
  type AIToolType,
  type SkillInfo,
} from "../modules/SkillsViewerManager";

interface Props {
  i18n?: Record<string, string>;
  plugin?: any;
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
});

const manager = new SkillsViewerManager();
const managerAvailable = manager.isAvailable();
const aiTools = AI_TOOLS;

const selectedTool = ref<string>("all");
const projectPath = ref("");
const skills = ref<SkillInfo[]>([]);
const loading = ref(false);
const expandedSkills = reactive(new Set<number>());

const toolStatuses = reactive<Record<string, {
  global: boolean;
  project: boolean;
  globalCount: number;
  projectCount: number;
}>>({});

const filteredSkills = computed(() => {
  if (selectedTool.value === "all") return skills.value;
  return skills.value.filter((s) => s.tool === selectedTool.value);
});

function selectTool(toolId: string) {
  selectedTool.value = toolId;
}

function getToolColor(toolId: AIToolType): string {
  return AI_TOOLS.find((t) => t.id === toolId)?.color || "#999";
}

function getToolName(toolId: AIToolType): string {
  return AI_TOOLS.find((t) => t.id === toolId)?.name || toolId;
}

function toggleExpand(index: number) {
  if (expandedSkills.has(index)) {
    expandedSkills.delete(index);
  } else {
    expandedSkills.add(index);
  }
}

async function checkAllToolStatuses() {
  for (const tool of AI_TOOLS) {
    toolStatuses[tool.id] = await manager.checkToolExists(tool, projectPath.value || undefined);
  }
}

async function refreshSkills() {
  if (!managerAvailable) return;
  loading.value = true;
  expandedSkills.clear();

  try {
    skills.value = await manager.scanAllSkills(projectPath.value || undefined);
    await checkAllToolStatuses();
    showMessage(
      skills.value.length > 0
        ? `${props.i18n?.scanComplete || '扫描完成'}：${skills.value.length} ${props.i18n?.skillsUnit || '个 Skills'}`
        : (props.i18n?.noSkillsFound || '未发现 Skills 文件'),
      2000,
      "info",
    );
  } catch (e) {
    console.error("扫描 Skills 失败:", e);
    showMessage(props.i18n?.scanFailed || "扫描失败", 2000, "error");
  } finally {
    loading.value = false;
  }
}

async function openCurrentToolDir() {
  if (!managerAvailable) return;
  const path = await import("path").catch(() => null);
  if (!path) return;

  let dirPath = "";
  if (selectedTool.value === "all") {
    // 打开 home 目录
    dirPath = manager.getHomeDir();
  } else {
    const tool = AI_TOOLS.find((t) => t.id === selectedTool.value);
    if (tool && tool.skillPaths.length > 0) {
      const nodePath = window.require("path");
      dirPath = nodePath.join(manager.getHomeDir(), tool.skillPaths[0]);
    }
  }

  if (dirPath) {
    const success = await manager.openInFileManager(dirPath);
    if (!success) {
      showMessage(props.i18n?.openDirFailed || "打开目录失败", 2000, "error");
    }
  }
}

async function handlePathChange() {
  await refreshSkills();
}

async function loadSettings() {
  if (!props.plugin) return;
  try {
    const data = await props.plugin.loadData("skills-viewer-settings");
    if (data) {
      projectPath.value = data.projectPath || "";
      selectedTool.value = data.selectedTool || "all";
    }
  } catch (e) {
    console.error("加载 Skills 查看器设置失败:", e);
  }
}

onMounted(async () => {
  await loadSettings();
  if (managerAvailable) {
    await checkAllToolStatuses();
    await refreshSkills();
  }
});

defineExpose({ refreshSkills, loadSettings });
</script>

<style scoped lang="scss">
@use './styles/SkillsViewerSettings.scss';
</style>
