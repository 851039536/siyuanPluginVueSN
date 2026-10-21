<!-- gitPush 变更目录树弹窗（VS Code 源代码管理风格：目录分组折叠 + 路径筛选 + 行内暂存/丢弃操作） -->
<template>
  <!-- 外壳（遮罩 / 定位 / 层级 / Esc / 焦点归还 / 过渡）全部由共享 Dialog 承担；
       模板位置在 WorkingTreeDiffDialog 之前，同 z-index 下后挂载的差异弹窗叠于本弹窗之上 -->
  <Dialog
    class="wt-tree-dialog"
    :visible="true"
    size="large"
    :closable="false"
    :aria-label="i18n.fileTreeTitle"
    @update:visible="$emit('close')"
  >
    <!-- 标题行："变更目录树" + 文件总数 -->
    <template #header="{ headerId }">
      <div class="wt-tree-header">
        <div class="wt-tree-title-row">
          <Icon
            icon="mdi:file-tree"
            height="12"
          />
          <span
            :id="headerId"
            class="wt-tree-title"
          >{{ i18n.fileTreeTitle }}</span>
          <!-- 复用提交文件弹窗的计数文案："共 {0} 个文件" -->
          <span
            class="wt-tree-total"
            :title="i18n.commitFilesCount.replace('{0}', String(files.length))"
          >{{ files.length }}</span>
        </div>
        <!-- 右侧关闭 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="close"
          :title="i18n.close"
          @click="$emit('close')"
        />
      </div>
    </template>

    <!-- 工具栏：路径筛选 + 全部展开/收起 -->
    <div class="wt-tree-toolbar">
      <!-- 筛选输入框（placeholder："筛选文件路径..."） -->
      <Input
        v-model="query"
        class="wt-tree-search"
        size="xsmall"
        :placeholder="i18n.fileTreeSearchPlaceholder"
        prefix-icon="search"
        clearable
        autocomplete="off"
      />
      <!-- 全部展开 -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="chevronDown"
        :title="i18n.fileTreeExpandAll"
        @click="expandAll"
      />
      <!-- 全部收起 -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="chevronRight"
        :title="i18n.fileTreeCollapseAll"
        @click="collapseAll"
      />
    </div>

    <!-- 筛选无命中空态 -->
    <EmptyState
      v-if="rows.length === 0"
      icon="mdi:file-find-outline"
      :text="i18n.fileTreeEmptyFiltered"
    />

    <!-- 树主体（目录行 + 文件行；本地分页防上千变更文件全量渲染） -->
    <div
      v-else
      class="wt-tree-body"
      role="tree"
    >
      <template
        v-for="row in pagedRows"
        :key="row.key"
      >
        <!-- 分区行："已暂存"/"未暂存" 顶级分组（点击折叠/展开；hover 出现分区级暂存/取消暂存） -->
        <div
          v-if="row.type === 'section'"
          class="wt-tree-section"
          role="button"
          tabindex="0"
          :aria-expanded="!isCollapsed(row.key)"
          @click="toggleDir(row.key)"
          @keydown.enter.prevent="toggleDir(row.key)"
          @keydown.space.prevent="toggleDir(row.key)"
        >
          <Icon
            icon="mdi:chevron-right"
            height="12"
            class="wt-tree-chev"
            :class="{ 'is-open': !isCollapsed(row.key) }"
          />
          <!-- 分区名（复用面板"已暂存/未暂存"文案） -->
          <span class="wt-tree-name">{{ row.name }}</span>
          <span class="wt-tree-count">{{ row.count }}</span>
          <!-- 分区级快捷操作：已暂存区提供"取消暂存全部"，未暂存区提供"暂存全部"（复用面板既有 emit） -->
          <Button
            v-if="row.section === 'staged'"
            class="wt-tree-section-btn"
            variant="ghost"
            size="xsmall"
            dense
            :disabled="gitOpLoading"
            :title="i18n.unstageAll"
            @click.stop="emit('unstageAll')"
          >
            {{ i18n.unstageAll }}
          </Button>
          <Button
            v-else
            class="wt-tree-section-btn"
            variant="ghost"
            size="xsmall"
            dense
            :disabled="gitOpLoading"
            :title="i18n.stageAll"
            @click.stop="emit('stageAll')"
          >
            {{ i18n.stageAll }}
          </Button>
        </div>

        <!-- 目录行：点击折叠/展开 -->
        <button
          v-else-if="row.type === 'dir'"
          class="wt-tree-row wt-tree-dir"
          :style="indentStyle(row.depth)"
          :aria-expanded="!isCollapsed(row.path)"
          :title="row.path"
          @click="toggleDir(row.path)"
        >
          <Icon
            icon="mdi:chevron-right"
            height="12"
            class="wt-tree-chev"
            :class="{ 'is-open': !isCollapsed(row.path) }"
          />
          <Icon
            icon="mdi:folder-outline"
            height="12"
            class="wt-tree-folder"
          />
          <span class="wt-tree-name">{{ row.name }}</span>
          <span class="wt-tree-count">{{ row.count }}</span>
        </button>

        <!-- 文件行：结构/交互与面板内列表一致（勾选暂存、状态图标、查看差异、丢弃） -->
        <div
          v-else
          class="wt-file-row wt-tree-file"
          :style="indentStyle(row.depth)"
          :class="{
            'staged': row.file.staged,
            'partially-staged': row.file.staged && row.file.unstaged,
            'diff-active': activeFile?.path === row.file.path && activeFile?.staged === row.file.staged,
          }"
          role="button"
          tabindex="0"
          :title="`${i18n.clickViewDiff} — ${row.file.path}`"
          @click="emit('viewDiff', row.file)"
          @keydown.enter.prevent="emit('viewDiff', row.file)"
          @keydown.space.prevent="emit('viewDiff', row.file)"
        >
          <!-- 勾选框（外层拦截冒泡，避免触发整行查看差异） -->
          <span
            class="wt-checkbox"
            @click.stop
          >
            <Checkbox
              :model-value="row.file.staged"
              size="xsmall"
              :disabled="gitOpLoading"
              :aria-label="gitOpLoading ? i18n.processing : row.file.staged ? i18n.unstageFile : i18n.stageFile"
              :title="gitOpLoading ? i18n.processing : row.file.staged ? i18n.unstageFile : i18n.stageFile"
              @update:model-value="toggleStage(row.file)"
            />
          </span>

          <!-- 状态图标 -->
          <span
            class="wt-file-status"
            :class="`wt-s-${row.file.status}`"
            :title="fileStatusTitle(row.file, i18n)"
          >
            <IconWrapper
              v-if="isIconFileStatus(row.file)"
              :name="fileStatusIconKey(row.file)"
              :size="12"
            />
            <template v-else>
              {{ fileStatusIcon(row.file) }}
            </template>
          </span>

          <!-- 文件名（筛选时高亮命中片段） -->
          <span class="wt-file-path"><template
            v-for="(seg, i) in nameSegments(row.name)"
            :key="i"
          ><span
            v-if="seg.hit"
            class="gp-hl"
          >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>

          <!-- 已暂存后又改动（porcelain MM/AM）标记 -->
          <span
            v-if="row.file.staged && row.file.unstaged"
            class="wt-partial-mark"
            :title="i18n.stagedAndUnstagedTip"
          ></span>

          <!-- 丢弃更改 -->
          <Button
            class="wt-discard-btn"
            variant="ghost"
            size="xsmall"
            dense
            severity="danger"
            icon="undoVariant"
            :title="row.file.staged ? i18n.unstageDiscard : row.file.status === 'untracked' ? i18n.discardUntracked : i18n.discardChanges"
            @click.stop="emit('discardFile', row.file.path, row.file.staged, row.file.status)"
          />
        </div>
      </template>

      <!-- 剩余行增量渲染 -->
      <LoadMoreButton
        v-if="hasMore"
        :i18n="i18n"
        :visible="pagedRows.length"
        :total="rows.length"
        @load-more="loadMore"
      />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
// gitPush 变更目录树弹窗（自含树构建/折叠/筛选/分页；操作全部 emit 回 WorkingTreePanel，
// 复用父层的暂存/丢弃确认与差异弹窗链路，不复制任何数据逻辑）
import type { FileChange } from "../../types"
import type { HighlightSegment } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Checkbox from "@/components/Checkbox.vue"
import Dialog from "@/components/Dialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import EmptyState from "../common/EmptyState.vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"
import { usePagedList } from "../../composables/usePagedList"
import {
  buildSectionedTreeRows,
  fileStatusIcon,
  fileStatusIconKey,
  fileStatusTitle,
  filterFilesByQuery,
  highlightSegments,
  isIconFileStatus,
  topLevelDirPaths,
} from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部变更文件（已按「暂存优先 → 路径」排序，目录内文件序与之一致） */
  files: FileChange[]
  /** 面板当前打开差异的文件（同步高亮；null = 未打开） */
  activeFile?: FileChange | null
  gitOpLoading: boolean
}>()

const emit = defineEmits<{
  close: []
  /** 查看差异（父层设置 activeDiffFile 并请求 diff，弹窗叠于本弹窗之上） */
  viewDiff: [file: FileChange]
  stageFile: [file: string]
  unstageFile: [file: string]
  /** 分区级批量操作（复用面板既有 stageAll/unstageAll 链路与确认语义） */
  stageAll: []
  unstageAll: []
  discardFile: [file: string, staged: boolean, status: string]
}>()

/** 路径筛选词（大小写不敏感的子串匹配；筛选时忽略折叠状态全展开，VS Code 同语义） */
const query = ref("")

/**
 * 已折叠节点的键集合（按键记忆，树刷新/筛选后仍生效；替换式更新保证响应式）。
 * 键空间：目录 = 目录完整路径（两分区共享折叠记忆）；分区 = "section:staged" / "section:unstaged"
 */
const collapsedDirs = ref<ReadonlySet<string>>(new Set())

/** 按暂存状态拆分：「已暂存」区收 staged 文件，「未暂存」区收其余（工作区改动/未跟踪） */
const sectionedFiles = computed(() => {
  const filtered = filterFilesByQuery(props.files, query.value)
  return [
    { section: "staged" as const, name: props.i18n.staged, files: filtered.filter((f) => f.staged) },
    { section: "unstaged" as const, name: props.i18n.unstaged, files: filtered.filter((f) => !f.staged) },
  ]
})

/**
 * 拉平树行（「已暂存 / 未暂存」两分区各自成树，VS Code 源代码管理同构）。
 * - 部分暂存文件两侧分区都出现（勾选后数据驱动自动跨区移动）；
 * - 空分区整段省略；筛选生效时传空折叠集 = 全展开。
 */
const rows = computed(() =>
  buildSectionedTreeRows(
    sectionedFiles.value,
    query.value.trim() ? new Set() : collapsedDirs.value,
  ),
)

// 树行本地分页：200 行 ≈ 10 屏滚动量（与面板内列表同款保护）
const WT_TREE_PAGE_SIZE = 200
const {
  paged: pagedRows,
  hasMore,
  loadMore,
} = usePagedList(rows, WT_TREE_PAGE_SIZE)

function isCollapsed(key: string): boolean {
  return collapsedDirs.value.has(key)
}

function toggleDir(key: string) {
  const next = new Set(collapsedDirs.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedDirs.value = next
}

/** 全部展开：清空折叠集（含分区与目录） */
function expandAll() {
  collapsedDirs.value = new Set()
}

/** 全部收起：收起两分区（分区折叠即整棵树收起，顶层目录在分区之下） */
function collapseAll() {
  collapsedDirs.value = new Set(["section:staged", "section:unstaged", ...topLevelDirPaths(props.files)])
}

/** 文件名筛选命中片段（gp-hl 高亮，与卡片名称搜索同款渲染） */
function nameSegments(name: string): HighlightSegment[] {
  return highlightSegments(name, query.value)
}

/** 缩进层级注入 CSS 变量（缩进量在 SCSS 中以 Token 计算，避免内联硬编码 px） */
function indentStyle(depth: number): Record<string, string> {
  return { "--wt-tree-depth": String(depth) }
}

/** 暂存勾选翻转（与面板列表行同语义） */
function toggleStage(file: FileChange) {
  if (file.staged) emit("unstageFile", file.path)
  else emit("stageFile", file.path)
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreePanel.scss";
@use "../../styles/WorkingTreeTreeDialog.scss";
</style>
