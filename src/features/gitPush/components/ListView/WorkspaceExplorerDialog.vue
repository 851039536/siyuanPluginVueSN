<!-- gitPush 工作区文件浏览器（只读 Explorer：整库文件树 + 路径筛选 + 类型预览 + 变更角标 + 底部项目脚本面板） -->
<template>
  <!-- 外壳（遮罩 / 定位 / 层级 / Esc / 焦点归还 / 过渡）由共享 Dialog 承担 -->
  <Dialog
    class="we-dialog"
    :visible="true"
    size="large"
    :draggable="true"
    :closable="false"
    :aria-label="i18n.workspaceFilesTitle"
    @update:visible="emit('close')"
  >
    <!-- 标题行：图标 + 标题 + 项目名 + 关闭 -->
    <template #header="{ headerId }">
      <div class="we-header">
        <div class="we-title-row">
          <!-- 拖拽提示（tooltip："按住标题栏拖动窗口"；标题栏任意空白处均可拖动） -->
          <Icon
            icon="mdi:drag-vertical"
            height="12"
            class="we-drag-grip"
            :title="i18n.workspaceFilesDragHint"
          />
          <Icon
            icon="mdi:file-tree-outline"
            height="12"
          />
          <span
            :id="headerId"
            class="we-title"
          >{{ i18n.workspaceFilesTitle }}</span>
          <span
            class="we-subtitle"
            :title="projectPath"
          >{{ project.name }}</span>
        </div>
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="close"
          :title="i18n.close"
          @click="emit('close')"
        />
      </div>
    </template>

    <!-- 工具栏：路径筛选 + 计数 + 全部收起 + 刷新 -->
    <div class="we-toolbar">
      <!-- 筛选输入框（placeholder："筛选文件路径..."） -->
      <Input
        v-model="query"
        class="we-search"
        size="xsmall"
        :placeholder="i18n.workspaceFilesSearchPlaceholder"
        prefix-icon="search"
        clearable
        autocomplete="off"
      />
      <!-- 文件计数："共 N 个文件"（筛选时显示命中数） -->
      <span class="we-toolbar-count">{{ countText }}</span>
      <!-- 全部收起（有展开目录时才可用；tooltip："全部收起"） -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="chevronRight"
        :disabled="query.trim().length > 0 || expandedDirs.size === 0"
        :title="i18n.workspaceFilesCollapseAll"
        @click="collapseAll"
      />
      <!-- 刷新文件列表（git ls-files，一次进程调用；tooltip："刷新文件列表"） -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="refresh"
        :loading="loading"
        :title="i18n.workspaceFilesRefresh"
        @click="refresh"
      />
    </div>

    <!-- 文件数超出上限提示："文件过多，仅显示前 N 个" -->
    <div
      v-if="truncatedNotice"
      class="we-notice"
    >
      <Icon
        icon="mdi:alert-circle-outline"
        height="12"
      />
      {{ truncatedNotice }}
    </div>

    <!-- 刷新失败但仍有缓存内容：横幅提示，不清空已展示的树（"读取文件列表失败"） -->
    <div
      v-if="error && files.length > 0"
      class="we-notice"
    >
      <Icon
        icon="mdi:alert-circle-outline"
        height="12"
      />
      {{ `${i18n.workspaceFilesLoadFailed}: ${error}` }}
    </div>

    <!-- 主体：上方文件区 + 底部项目脚本面板（展开时纵向分栏可拖高；收起时只留面板头） -->
    <div class="we-body">
      <template v-if="scriptsOpen">
        <Splitter
          class="we-body-split"
          layout="vertical"
          :gutter-size="8"
          state-key="gitpush-workspace-explorer-vertical"
          state-storage="session"
        >
          <SplitterPanel
            :size="72"
            :min-size="35"
          >
            <div class="we-main">
              <WorkspaceExplorerMain
                :i18n="i18n"
                :project-path="projectPath"
                :files="files"
                :loading="loading"
                :error="error"
                :rows="rows"
                :expanded-dirs="expandedDirs"
                :selected-path="selectedPath"
                :query="query"
                :change-map="changeMap"
                @select="selectedPath = $event"
                @toggle-dir="toggleDir"
                @open-changes="(path) => emit('openChanges', path)"
                @refresh="refresh"
              />
            </div>
          </SplitterPanel>
          <SplitterPanel
            :size="28"
            :min-size="14"
          >
            <ScriptRunnerPanel
              :project="project"
              :i18n="i18n"
              :expanded="true"
              @toggle="scriptsOpen = false"
            />
          </SplitterPanel>
        </Splitter>
      </template>
      <template v-else>
        <div class="we-main">
          <WorkspaceExplorerMain
            :i18n="i18n"
            :project-path="projectPath"
            :files="files"
            :loading="loading"
            :error="error"
            :rows="rows"
            :expanded-dirs="expandedDirs"
            :selected-path="selectedPath"
            :query="query"
            :change-map="changeMap"
            @select="selectedPath = $event"
            @toggle-dir="toggleDir"
            @open-changes="(path) => emit('openChanges', path)"
            @refresh="refresh"
          />
        </div>
        <ScriptRunnerPanel
          :project="project"
          :i18n="i18n"
          :expanded="false"
          @toggle="scriptsOpen = true"
        />
      </template>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
// gitPush 工作区文件浏览器（编排层：数据经 manager 按需拉取，树行由 utils/fileTree 构建，
// 文件主区 / 树 / 预览 / 底部项目脚本面板均为纯展示子组件）
import type { FileChange, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, onMounted, ref } from "vue"
import {
  buildPathTreeRows,
  collectDirectoryPaths,
  filterPathsByQuery,
  resolveValidPath,
} from "../../utils"
import { useCardServices } from "../../composables/useCardServices"
import { useWorkspaceFiles } from "../../composables/useWorkspaceFiles"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Input from "@/components/Input.vue"
import Splitter from "@/components/Splitter.vue"
import SplitterPanel from "@/components/SplitterPanel.vue"
import ScriptRunnerPanel from "./ScriptRunnerPanel.vue"
import WorkspaceExplorerMain from "./WorkspaceExplorerMain.vue"

const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
  /** 当前工作区变更文件（与 CHANGES Tab 同源，用于树上的 M/A/D/R/U 角标） */
  changes: FileChange[]
}>()

const emit = defineEmits<{
  close: []
  /** 点击变更角标：父层切到工作区 Tab（并关闭本弹窗） */
  openChanges: [path: string]
}>()

/** 单次最多展示的文件数（超大仓库保护；超出部分不渲染但计数照实说明） */
const MAX_FILES = 20000

const { services } = useCardServices(() => props.project)
const i18n = props.i18n

/** 当前设备有效路径（多设备适配；空串 = 本项目在本机不可用） */
const projectPath = computed(() => resolveValidPath(props.project))

const { files, loading, error, refresh } = useWorkspaceFiles(
  () => projectPath.value,
  (dir) => services.manager.getWorkspaceFiles(dir),
)

/** 路径筛选词（大小写不敏感子串；筛选时自动展开命中路径的目录） */
const query = ref("")
/** 已展开目录集合（默认空 = 全部收起，只展示根层） */
const expandedDirs = ref<ReadonlySet<string>>(new Set())
/** 当前预览文件（相对仓库根；空串 = 未选中） */
const selectedPath = ref("")
/** 底部项目脚本面板是否展开（默认展开；用户可在面板头收起为一条栏） */
const scriptsOpen = ref(true)

/** 截断后的文件集（超出上限只取前 N 条） */
const shownFiles = computed(() => (
  files.value.length > MAX_FILES ? files.value.slice(0, MAX_FILES) : files.value
))

/** 超出上限提示（不超限时为 null） */
const truncatedNotice = computed(() => (
  files.value.length > MAX_FILES
    ? i18n.workspaceFilesCapped.replace("{0}", String(MAX_FILES))
    : ""
))

/** 计数文案：有筛选词时显示命中数，否则显示总数 */
const countText = computed(() => {
  const shown = query.value.trim()
    ? filterPathsByQuery(shownFiles.value, query.value).length
    : shownFiles.value.length
  return i18n.workspaceFilesCount.replace("{0}", String(shown))
})

/** 变更映射（相对路径 → 变更条目；角标数据源） */
const changeMap = computed(() => new Map(props.changes.map((f) => [f.path, f])))

/**
 * 拉平树行：
 * - 有筛选词 → 自动展开命中路径的全部父目录（否则命中深层文件仍不可见）；
 * - 无筛选词 → 按用户展开集，默认全部收起只渲染根层。
 */
const rows = computed(() => {
  const filtered = filterPathsByQuery(shownFiles.value, query.value)
  const expanded = query.value.trim()
    ? new Set(collectDirectoryPaths(filtered))
    : expandedDirs.value
  return buildPathTreeRows(filtered, expanded)
})

/** 展开/收起目录（替换式更新保证 Set 变更可被响应式追踪） */
function toggleDir(path: string) {
  const next = new Set(expandedDirs.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expandedDirs.value = next
}

/** 全部收起 */
function collapseAll() {
  expandedDirs.value = new Set()
}

// 打开即拉取（缓存命中时先出内容、后台静默刷新，git 失败保留缓存内容）
onMounted(() => {
  void refresh()
})
</script>
