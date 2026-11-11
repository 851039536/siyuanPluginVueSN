<!--
  gitPush 审阅流侧栏：变更文件的目录树索引（已暂存 / 未暂存两个分区各自成树）。
  侧栏只负责「定位与暂存」，diff 本体在右侧连续流里；点击文件滚动到对应段。

  视觉/结构直接复用「工作区文件浏览器」的树（.we-row / .we-chev / .we-folder /
  .we-file-icon / .we-name / .we-badge），同一个插件里文件树只有一种长相。
-->
<template>
  <aside class="wt-sb">
    <!-- 筛选 + 展开/收起 -->
    <div class="wt-sb-toolbar">
      <Input
        v-model="query"
        class="wt-sb-search"
        size="xsmall"
        :placeholder="i18n.fileTreeSearchPlaceholder"
        prefix-icon="search"
        clearable
        autocomplete="off"
      />
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="chevronDown"
        :title="i18n.fileTreeExpandAll"
        @click="expandAll"
      />
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="chevronRight"
        :title="i18n.fileTreeCollapseAll"
        @click="collapseAll"
      />
    </div>

    <!-- 筛选无命中 -->
    <div
      v-if="rows.length === 0"
      class="wt-sb-empty"
    >
      {{ i18n.fileTreeEmptyFiltered }}
    </div>

    <!-- 树主体：复用工作区树的滚动容器类（overflow / scrollbar-gutter 与之一致） -->
    <div
      v-else
      class="we-tree"
      role="tree"
    >
      <template
        v-for="row in pagedRows"
        :key="row.key"
      >
        <!-- 分区行：已暂存 / 未暂存 -->
        <div
          v-if="row.type === 'section'"
          class="wt-sb-section"
          role="treeitem"
          tabindex="0"
          :aria-expanded="isExpanded(row.key)"
          @click="toggleDir(row.key)"
          @keydown.enter.prevent="toggleDir(row.key)"
          @keydown.space.prevent="toggleDir(row.key)"
        >
          <Icon
            icon="mdi:chevron-right"
            height="12"
            class="we-chev"
            :class="{ 'is-open': isExpanded(row.key) }"
          />
          <span class="wt-sb-section-name">{{ row.name }}</span>
          <span class="we-count">{{ row.count }}</span>
          <!-- 分区级批量操作（hover 显现，复用工作区树的悬停按钮显隐规则） -->
          <Button
            class="we-copy-btn wt-sb-section-btn"
            variant="ghost"
            size="xsmall"
            dense
            :disabled="gitOpLoading"
            :title="row.section === 'staged' ? i18n.unstageAll : i18n.stageAll"
            @click.stop="row.section === 'staged' ? emit('unstageAll') : emit('stageAll')"
          >
            {{ row.section === "staged" ? i18n.unstageAll : i18n.stageAll }}
          </Button>
        </div>

        <!-- 目录行：箭头 + 文件夹图标 + 名字 + 子树计数 -->
        <div
          v-else-if="row.type === 'dir'"
          class="we-row we-row--dir"
          :style="indentStyle(row.depth)"
          role="treeitem"
          :aria-expanded="isExpanded(row.path)"
          tabindex="0"
          :title="row.path"
          @click="toggleDir(row.path)"
          @keydown.enter.prevent="toggleDir(row.path)"
          @keydown.space.prevent="toggleDir(row.path)"
        >
          <Icon
            icon="mdi:chevron-right"
            height="12"
            class="we-chev"
            :class="{ 'is-open': isExpanded(row.path) }"
          />
          <Icon
            :icon="isExpanded(row.path) ? 'mdi:folder-open-outline' : 'mdi:folder-outline'"
            height="12"
            class="we-folder"
          />
          <span class="we-name">{{ row.name }}</span>
          <span class="we-count">{{ row.count }}</span>
        </div>

        <!-- 文件行：文件类型图标 + 名字 + 增删统计 + 变更角标（悬停时统计让位给暂存开关） -->
        <div
          v-else
          class="we-row we-row--file"
          :class="{ 'is-selected': activePath === row.file.path }"
          :style="indentStyle(row.depth)"
          role="treeitem"
          :aria-selected="activePath === row.file.path"
          tabindex="0"
          :title="row.file.path"
          @click="emit('focus', row.file)"
          @keydown.enter.prevent="emit('focus', row.file)"
          @keydown.space.prevent="emit('focus', row.file)"
        >
          <span class="we-chev-spacer" />
          <Icon
            :icon="workspaceFileIcon(row.file.path)"
            height="12"
            class="we-file-icon"
          />
          <span class="we-name"><template
            v-for="(seg, i) in nameSegments(row.name)"
            :key="i"
          ><span
            v-if="seg.hit"
            class="gp-hl"
          >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>

          <!-- 增删统计 / 暂存开关：同一格互换，行宽恒定 -->
          <span class="wt-sb-slot">
            <span
              v-if="hasStats(row.file)"
              class="wt-sb-stats"
            ><span class="wt-stat-add">+{{ statsOf(row.file)?.add }}</span><span class="wt-stat-del">−{{ statsOf(row.file)?.del }}</span></span>
            <Button
              class="we-copy-btn wt-sb-stage"
              variant="ghost"
              size="xsmall"
              dense
              :icon="row.file.staged ? 'minusBoxOutline' : 'plusBoxOutline'"
              :disabled="gitOpLoading"
              :aria-label="row.file.staged ? i18n.unstageFile : i18n.stageFile"
              :title="row.file.staged ? i18n.unstageFile : i18n.stageFile"
              @click.stop="toggleStage(row.file)"
            />
          </span>

          <!-- 变更角标（M / A / D / R / U；与工作区树同款） -->
          <span
            class="we-badge"
            :class="`we-badge--${row.file.status}`"
            :title="fileStatusTitle(row.file, i18n)"
          >{{ fileStatusLetter(row.file) }}</span>
        </div>
      </template>

      <LoadMoreButton
        v-if="hasMore"
        :i18n="i18n"
        :visible="pagedRows.length"
        :total="rows.length"
        @load-more="loadMore"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
// gitPush 审阅流侧栏（自含树构建/折叠/筛选/分页；文件操作全部 emit 回弹窗，不复制数据逻辑）
import type { FileChange } from "../../types"
import type { HighlightSegment } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import { usePagedList } from "../../composables/usePagedList"
import {
  buildSectionedTreeRows,
  diffCacheKey,
  fileStatusLetter,
  fileStatusTitle,
  filterFilesByQuery,
  highlightSegments,
  workspaceFileIcon,
} from "../../utils"
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部变更文件（已按「暂存优先 → 路径」排序） */
  files: FileChange[]
  /** 右侧当前所在的文件路径（滚动联动高亮） */
  activePath: string
  /** 每个文件的增删行数（键 = diffCacheKey(path, staged)，由弹窗按变更集预先算好） */
  stats: Record<string, { add: number, del: number }>
  gitOpLoading: boolean
}>()

const emit = defineEmits<{
  /** 点击文件：右侧滚动到该文件段 */
  focus: [file: FileChange]
  stageFile: [path: string]
  unstageFile: [path: string]
  stageAll: []
  unstageAll: []
}>()

/** 路径筛选词（大小写不敏感子串；筛选时忽略折叠全展开，与 VS Code 同语义） */
const query = ref("")

/** 已折叠节点的键集合（键空间：目录最深路径 / "section:staged" / "section:unstaged"） */
const collapsedDirs = ref<ReadonlySet<string>>(new Set())

/** 按暂存状态拆分两分区（部分暂存文件归入已暂存区） */
const sectionedFiles = computed(() => {
  const filtered = filterFilesByQuery(props.files, query.value)
  return [
    {
      section: "staged" as const,
      name: props.i18n.staged,
      files: filtered.filter((f) => f.staged),
    },
    {
      section: "unstaged" as const,
      name: props.i18n.unstaged,
      files: filtered.filter((f) => !f.staged),
    },
  ]
})

/**
 * 拉平树行（两分区各自成树，空分区整段省略；筛选时传空折叠集 = 全展开）。
 * compact = true：把「只有单个子目录」的链条压成一行（src/features/gitPush），
 * 272px 宽的侧栏里能省下 3~4 层缩进，文件名才放得下。
 */
const rows = computed(() =>
  buildSectionedTreeRows(
    sectionedFiles.value,
    query.value.trim() ? new Set() : collapsedDirs.value,
    true,
  ),
)

// 侧栏本地分页：200 行（与工作区树同款保护）
const SIDEBAR_PAGE_SIZE = 200
const {
  paged: pagedRows,
  hasMore,
  loadMore,
} = usePagedList(rows, SIDEBAR_PAGE_SIZE)

/** 是否展开（树行用展开语义表达，内部仍按折叠集合存储） */
function isExpanded(key: string): boolean {
  return !collapsedDirs.value.has(key)
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

/**
 * 全部收起：只收起两个分区 —— 分区折叠即整棵树收起。
 * 不逐个收起目录：链式压缩后目录行的键是最深路径，按顶层目录名收集会对不上。
 */
function collapseAll() {
  collapsedDirs.value = new Set(["section:staged", "section:unstaged"])
}

/** 文件名筛选命中片段高亮（与工作区树同款渲染） */
function nameSegments(name: string): HighlightSegment[] {
  return highlightSegments(name, query.value)
}

/** 缩进层级注入 CSS 变量（复用工作区树的 --we-depth，缩进量在 SCSS 中以 Token 计算） */
function indentStyle(depth: number): Record<string, string> {
  return { "--we-depth": String(depth) }
}

/** 该文件在当前暂存态下的增删统计（该侧没有时回退到另一侧的数字） */
function statsOf(file: FileChange): { add: number, del: number } | undefined {
  return props.stats[diffCacheKey(file.path, file.staged)]
    ?? props.stats[diffCacheKey(file.path, !file.staged)]
}

/** 有实际增删才显示统计（二进制 / 仅改权限的文件会是 0 0，显示出来只是噪音） */
function hasStats(file: FileChange): boolean {
  const s = statsOf(file)
  return !!s && (s.add > 0 || s.del > 0)
}

/** 暂存勾选翻转（与面板列表行同语义） */
function toggleStage(file: FileChange) {
  if (file.staged) emit("unstageFile", file.path)
  else emit("stageFile", file.path)
}
</script>

<style lang="scss">
@use "../../styles/DiffStream.scss";
</style>
