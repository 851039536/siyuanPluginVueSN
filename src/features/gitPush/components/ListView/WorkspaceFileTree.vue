<!-- gitPush 工作区文件树（目录折叠 / 类型图标 / 变更角标 / 本地分页；选中与展开由父层持有） -->
<template>
  <div
    class="we-tree"
    role="tree"
    :aria-label="i18n.workspaceFilesTitle"
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
        tabindex="0"
        :title="row.path"
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
        tabindex="0"
        :title="row.path"
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
import { computed, onUnmounted, ref, watch } from "vue"
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
