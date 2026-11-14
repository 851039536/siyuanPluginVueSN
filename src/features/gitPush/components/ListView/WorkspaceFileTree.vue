<!-- gitPush 工作区文件树（目录折叠 / 类型图标 / 变更角标 / 本地分页；选中与展开由父层持有） -->
<template>
  <div
    ref="treeEl"
    class="we-tree"
    role="tree"
    :aria-label="i18n.workspaceFilesTitle"
    @keydown="onTreeKeydown"
  >
    <template
      v-for="row in pagedRows"
      :key="row.key"
    >
      <!-- 目录行：点击展开/收起，计数为子树文件总数；行尾可复制文件夹名 -->
      <div
        v-if="row.type === 'dir'"
        class="we-row we-row--dir"
        :style="indentStyle(row.depth)"
        role="treeitem"
        :aria-expanded="isExpanded(row.path)"
        :aria-level="row.depth + 1"
        :tabindex="rowTabIndex(row)"
        :data-row-key="row.key"
        :title="row.path"
        @focus="activeKey = row.key"
        @click="emit('toggleDir', row.path)"
        @keydown.enter.prevent="emit('toggleDir', row.path)"
        @keydown.space.prevent="emit('toggleDir', row.path)"
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
        <!-- 复制文件夹名（悬停显现；复制成功后短暂换对勾） -->
        <Button
          class="we-copy-btn"
          variant="ghost"
          size="xsmall"
          dense
          :icon="copiedKey === row.key ? 'check' : 'copy'"
          :title="copiedKey === row.key ? i18n.workspaceFilesCopied : i18n.copyFolderName"
          :aria-label="copiedKey === row.key ? i18n.workspaceFilesCopied : i18n.copyFolderName"
          @click.stop="copyName(row.key, row.name)"
          @keydown.stop
        />
      </div>

      <!-- 文件行：点击在右侧预览；有未提交变更时显示 M/A/D/R/U 角标（点击切到工作区 Tab） -->
      <div
        v-else
        class="we-row we-row--file"
        :class="{ 'is-selected': row.path === selectedPath }"
        :style="indentStyle(row.depth)"
        role="treeitem"
        :aria-selected="row.path === selectedPath"
        :aria-level="row.depth + 1"
        :tabindex="rowTabIndex(row)"
        :data-row-key="row.key"
        :title="row.path"
        @focus="activeKey = row.key"
        @click="emit('select', row.path)"
        @keydown.enter.prevent="emit('select', row.path)"
        @keydown.space.prevent="emit('select', row.path)"
      >
        <span class="we-chev-spacer" />
        <Icon
          :icon="workspaceFileIcon(row.path)"
          height="12"
          class="we-file-icon"
        />
        <!-- 文件名（筛选时高亮命中片段） -->
        <span class="we-name"><template
          v-for="(seg, i) in highlightSegments(row.name, query)"
          :key="i"
        ><span
          v-if="seg.hit"
          class="gp-hl"
        >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
        <!-- 复制文件名（悬停显现；复制成功后短暂换对勾） -->
        <Button
          class="we-copy-btn"
          variant="ghost"
          size="xsmall"
          dense
          :icon="copiedKey === row.key ? 'check' : 'copy'"
          :title="copiedKey === row.key ? i18n.workspaceFilesCopied : i18n.copyFileName"
          :aria-label="copiedKey === row.key ? i18n.workspaceFilesCopied : i18n.copyFileName"
          @click.stop="copyName(row.key, row.name)"
          @keydown.stop
        />
        <!-- 变更角标（title 复用工作区文件状态文案；点击跳到工作区 Tab） -->
        <button
          v-if="changeOf(row.path)"
          type="button"
          class="we-badge"
          :class="`we-badge--${changeOf(row.path)!.status}`"
          :title="fileStatusTitle(changeOf(row.path)!, i18n)"
          :aria-label="changeTitle(changeOf(row.path)!)"
          @click.stop="emit('openChanges', row.path)"
        >
          {{ fileStatusLetter(changeOf(row.path)!) }}
        </button>
      </div>
    </template>

    <!-- 剩余行增量渲染（大仓库一次只挂 300 行） -->
    <LoadMoreButton
      v-if="hasMore"
      :i18n="i18n"
      :visible="pagedRows.length"
      :total="rows.length"
      @load-more="loadMore"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 工作区文件树（纯渲染：折叠态/选中态/变更映射全部由父层注入，行数据由 utils/fileTree 构建）
import type { FileChange } from "../../types"
import type { PathTreeRow } from "../../utils"
import type { TimerHandle } from "@/utils/timerRegistry"
import { Icon } from "@iconify/vue"
import { computed, nextTick, onUnmounted, ref, watch } from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import { TimerRegistry } from "@/utils/timerRegistry"
import Button from "@/components/Button.vue"
import {
  fileStatusLetter,
  fileStatusTitle,
  highlightSegments,
  workspaceFileIcon,
} from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 拉平后的树行（`buildPathTreeRows` 产物） */
  rows: PathTreeRow[]
  /** 已展开目录集合（空集 = 全部收起） */
  expandedDirs: ReadonlySet<string>
  /** 当前预览的文件相对路径 */
  selectedPath: string
  /** 当前筛选词（仅用于文件名高亮） */
  query: string
  /** 变更文件映射（相对路径 → 变更条目；用于角标） */
  changeMap: Map<string, FileChange>
}>()

const emit = defineEmits<{
  select: [path: string]
  toggleDir: [path: string]
  /** 点击变更角标：请求切到工作区 Tab 查看该文件 */
  openChanges: [path: string]
}>()

/** 单页行数（300 行 ≈ 十余屏；展开目录后自动重置分页） */
const TREE_PAGE_SIZE = 300
const {
  paged: pagedRows,
  hasMore,
  loadMore,
  reset,
} = usePagedList(computed(() => props.rows), TREE_PAGE_SIZE)

/** 展开/收起/筛选会重算行集合，此时回到首屏，避免新增子行落在已分页区之外 */
watch(() => props.rows, reset)

// ── 键盘导航（roving tabindex：整棵树只占一个 Tab 位，方向键在行间移动）──
const treeEl = ref<HTMLElement | null>(null)
/** 当前键盘焦点行的键（空串 = 尚未聚焦过，回落到首行） */
const activeKey = ref("")

/** 实际 tabindex=0 的行（activeKey 失效——被筛选/折叠掉——时回落到首行） */
const activeRowKey = computed(() => {
  const rows = pagedRows.value
  if (rows.length === 0) return ""
  return rows.some((row) => row.key === activeKey.value) ? activeKey.value : rows[0].key
})

/** 行 tabindex：只有「当前行」可 Tab 进入，其余 -1（否则 300 行要按 300 次 Tab） */
function rowTabIndex(row: PathTreeRow): number {
  return row.key === activeRowKey.value ? 0 : -1
}

/** 按行键把 DOM 焦点移到该行（行已在 DOM 里，无需等重渲染） */
function focusRow(key: string) {
  const nodes = treeEl.value?.querySelectorAll<HTMLElement>("[data-row-key]")
  if (!nodes) return
  for (const node of nodes) {
    if (node.dataset.rowKey === key) {
      node.focus()
      return
    }
  }
}

/** 把键盘焦点行移到第 index 行（越界忽略） */
function moveActive(index: number) {
  const rows = pagedRows.value
  if (index < 0 || index >= rows.length) return
  activeKey.value = rows[index].key
  focusRow(rows[index].key)
}

/** 当前行的父目录行下标（深度浅一层、且最近的目录行；找不到返回 -1） */
function parentIndexOf(index: number): number {
  const rows = pagedRows.value
  const depth = rows[index].depth
  for (let i = index - 1; i >= 0; i--) {
    if (rows[i].type === "dir" && rows[i].depth === depth - 1) return i
  }
  return -1
}

/**
 * 树内方向键导航（ARIA tree 语义）：
 * ↑↓ 上下移动（到底且还有未渲染行时自动加载下一页）、→ 展开/进入子层、← 折叠/回到父层、
 * Home/End 首末行。Enter/Space 仍由行内处理（展开或预览）。
 */
function onTreeKeydown(e: KeyboardEvent) {
  const rows = pagedRows.value
  if (rows.length === 0) return
  const focusKey = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-row-key]")?.dataset.rowKey
  const index = focusKey ? rows.findIndex((row) => row.key === focusKey) : -1
  if (index === -1) return
  const row = rows[index]

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault()
      if (index === rows.length - 1 && hasMore.value) {
        loadMore()
        void nextTick(() => moveActive(index + 1))
        return
      }
      moveActive(index + 1)
      return
    case "ArrowUp":
      e.preventDefault()
      moveActive(index - 1)
      return
    case "ArrowRight":
      e.preventDefault()
      // 目录：未展开则展开；已展开则进入第一项。文件不响应（与 VS Code 一致）
      if (row.type !== "dir") return
      if (!isExpanded(row.path)) emit("toggleDir", row.path)
      else moveActive(index + 1)
      return
    case "ArrowLeft": {
      e.preventDefault()
      if (row.type === "dir" && isExpanded(row.path)) {
        emit("toggleDir", row.path)
        return
      }
      const parent = parentIndexOf(index)
      if (parent !== -1) moveActive(parent)
      return
    }
    case "Home":
      e.preventDefault()
      moveActive(0)
      return
    case "End":
      e.preventDefault()
      moveActive(rows.length - 1)
      return
    default:
      return
  }
}

// ── 行内「复制名称」（文件名 / 文件夹名）──
/** 最近一次复制成功的行键（按钮临时换对勾） */
const copiedKey = ref("")
const copyTimers = new TimerRegistry()
let copiedTimer: TimerHandle | null = null

/** 复制行名称（basename；复制反馈 2s 后复位，连续复制以最后一次为准） */
async function copyName(key: string, name: string) {
  const ok = await copyToClipboard(name)
  if (!ok) return
  copyTimers.clear(copiedTimer)
  copiedKey.value = key
  copiedTimer = copyTimers.setTimeout(() => { copiedKey.value = "" }, 2000)
}

onUnmounted(() => copyTimers.clearAll())

/** 目录是否展开 */
function isExpanded(path: string): boolean {
  return props.expandedDirs.has(path)
}

/** 取文件的变更条目（模板中多处使用，避免重复写 Map 访问） */
function changeOf(path: string): FileChange | undefined {
  return props.changeMap.get(path)
}

/** 角标可访问名称（图标文字对读屏无意义，用完整状态文案） */
function changeTitle(file: FileChange): string {
  return fileStatusTitle(file, props.i18n)
}

/** 缩进 = 基准 6px + 层级 × 12px（由 SCSS 读取自定义属性计算） */
function indentStyle(depth: number): Record<string, string> {
  return { "--we-depth": String(depth) }
}
</script>
