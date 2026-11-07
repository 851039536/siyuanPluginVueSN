<!-- gitPush 工作区浏览器主区（路径/加载/读取失败/空态分流 + 左树右预览分栏，分栏宽度可拖动并跨挂载持久化） -->
<template>
  <!-- 空态："项目路径不可用" -->
  <EmptyState
    v-if="!projectPath"
    icon="mdi:folder-alert-outline"
    :text="i18n.workspaceFilesNoPath"
  />

  <!-- 空态："读取文件列表失败"（保留重试入口，按钮文案"刷新文件列表"） -->
  <EmptyState
    v-else-if="error && files.length === 0"
    icon="mdi:alert-outline"
    :text="`${i18n.workspaceFilesLoadFailed}: ${error}`"
  >
    <template #action>
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        @click="emit('refresh')"
      >
        {{ i18n.workspaceFilesRefresh }}
      </Button>
    </template>
  </EmptyState>

  <!-- 加载态："加载中..." -->
  <EmptyState
    v-else-if="loading && files.length === 0"
    icon="mdi:loading"
    spin
    :text="i18n.loading"
  />

  <!-- 左右分栏：文件树 + 预览（分隔条可拖动调整宽度，方向键亦可微调） -->
  <div
    v-else
    class="we-split"
  >
    <Splitter
      class="we-splitter"
      layout="horizontal"
      :gutter-size="8"
      state-key="gitpush-workspace-explorer-split"
      state-storage="session"
    >
      <SplitterPanel
        :size="38"
        :min-size="20"
        :max-size="70"
      >
        <div class="we-tree-pane">
          <!-- 空态："工作区没有文件" / 筛选无命中："没有匹配的文件" -->
          <EmptyState
            v-if="rows.length === 0"
            icon="mdi:file-find-outline"
            :text="query.trim() ? i18n.workspaceFilesEmptyFiltered : i18n.workspaceFilesEmpty"
          />
          <WorkspaceFileTree
            v-else
            :i18n="i18n"
            :rows="rows"
            :expanded-dirs="expandedDirs"
            :selected-path="selectedPath"
            :query="query"
            :change-map="changeMap"
            @select="emit('select', $event)"
            @toggle-dir="emit('toggleDir', $event)"
            @open-changes="emit('openChanges', $event)"
          />
        </div>
      </SplitterPanel>
      <SplitterPanel :size="62" :min-size="30">
        <WorkspaceFilePreview
          :i18n="i18n"
          :project-path="projectPath"
          :file-path="selectedPath"
        />
      </SplitterPanel>
    </Splitter>
  </div>
</template>

<script setup lang="ts">
// gitPush 工作区浏览器主区（纯展示 + 本地动作转发：数据抓取与树行构建都在编排层）
import type { FileChange } from "../../types"
import type { PathTreeRow } from "../../utils"
import Button from "@/components/Button.vue"
import Splitter from "@/components/Splitter.vue"
import SplitterPanel from "@/components/SplitterPanel.vue"
import EmptyState from "../common/EmptyState.vue"
import WorkspaceFilePreview from "./WorkspaceFilePreview.vue"
import WorkspaceFileTree from "./WorkspaceFileTree.vue"

defineProps<{
  i18n: Record<string, any>
  /** 当前设备有效路径（空串 = 本项目在本机不可用） */
  projectPath: string
  /** 已拉取的文件相对路径列表（仅用于判断是否首次加载 / 读取失败） */
  files: readonly string[]
  loading: boolean
  /** 读取失败原因（空串 = 无错误） */
  error: string
  /** 拉平后的树行（`buildPathTreeRows` 产物） */
  rows: PathTreeRow[]
  /** 已展开目录集合 */
  expandedDirs: ReadonlySet<string>
  /** 当前预览的文件相对路径 */
  selectedPath: string
  /** 当前筛选词（仅用于文件名高亮） */
  query: string
  /** 变更文件映射（用于树行角标） */
  changeMap: Map<string, FileChange>
}>()

const emit = defineEmits<{
  select: [path: string]
  toggleDir: [path: string]
  openChanges: [path: string]
  refresh: []
}>()
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/WorkspaceExplorer.scss";
</style>
