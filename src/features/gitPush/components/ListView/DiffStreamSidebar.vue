<!--
  gitPush 审阅流侧栏：变更文件的目录树索引（已暂存 / 未暂存两个分区各自成树）。
  侧栏只负责「定位与暂存」，diff 本体在右侧连续流里；点击文件滚动到对应段。
  原独立的「变更目录树」弹窗在本组件上线后并入审阅流，不再单独存在。
-->
<template>
  <aside class="wt-sb">
    <!-- 筛选 + 展开/收起 + 计数 -->
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

    <div
      v-else
      class="wt-sb-body"
      role="tree"
    >
      <template
        v-for="row in pagedRows"
        :key="row.key"
      >
        <!-- 分区行：已暂存 / 未暂存（整行比一个空分区更省地方，空分区不渲染） -->
        <div
          v-if="row.type === 'section'"
          class="wt-sb-section"
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
            class="wt-sb-chev"
            :class="{ 'is-open': !isCollapsed(row.key) }"
          />
          <span class="wt-sb-name">{{ row.name }}</span>
          <span class="wt-sb-count">{{ row.count }}</span>
          <!-- 分区级批量操作（复用面板既有链路与确认语义） -->
          <Button
            class="wt-sb-section-btn"
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

        <!-- 目录行 -->
        <button
          v-else-if="row.type === 'dir'"
          class="wt-sb-row wt-sb-dir"
          :style="indentStyle(row.depth)"
          :aria-expanded="!isCollapsed(row.path)"
          :title="row.path"
          @click="toggleDir(row.path)"
        >
          <Icon
            icon="mdi:chevron-right"
            height="12"
            class="wt-sb-chev"
            :class="{ 'is-open': !isCollapsed(row.path) }"
          />
          <Icon
            icon="mdi:folder-outline"
            height="12"
            class="wt-sb-folder"
          />
          <span class="wt-sb-name">{{ row.name }}</span>
          <span class="wt-sb-count">{{ row.count }}</span>
        </button>

        <!-- 文件行：点击滚动到右侧对应文件段；勾选框翻转暂存态 -->
        <div
          v-else
          class="wt-sb-row wt-sb-file"
          :style="indentStyle(row.depth)"
          :class="{ 'is-active': activePath === row.file.path }"
          role="button"
          tabindex="0"
          :aria-current="activePath === row.file.path ? 'true' : undefined"
          :title="`${i18n.clickViewDiff} — ${row.file.path}`"
          @click="emit('focus', row.file)"
          @keydown.enter.prevent="emit('focus', row.file)"
          @keydown.space.prevent="emit('focus', row.file)"
        >
          <span
            class="wt-checkbox"
            @click.stop
          >
            <Checkbox
              :model-value="row.file.staged"
              size="xsmall"
              :disabled="gitOpLoading"
              :aria-label="row.file.staged ? i18n.unstageFile : i18n.stageFile"
              :title="row.file.staged ? i18n.unstageFile : i18n.stageFile"
              @update:model-value="toggleStage(row.file)"
            />
          </span>
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
          <span class="wt-sb-name wt-sb-file-name"><template
            v-for="(seg, i) in nameSegments(row.name)"
            :key="i"
          ><span
            v-if="seg.hit"
            class="gp-hl"
          >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
          <!-- 已暂存后又改动（porcelain MM/AM） -->
          <span
            v-if="row.file.staged && row.file.unstaged"
            class="wt-partial-mark"
            :title="i18n.stagedAndUnstagedTip"
          ></span>
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
import Checkbox from "@/components/Checkbox.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
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
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部变更文件（已按「暂存优先 → 路径」排序） */
  files: FileChange[]
  /** 右侧当前所在的文件路径（滚动联动高亮） */
  activePath: string
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

/** 已折叠节点的键集合（键空间：目录完整路径 / "section:staged" / "section:unstaged"） */
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

/** 拉平树行（两分区各自成树，空分区整段省略；筛选时传空折叠集 = 全展开） */
const rows = computed(() =>
  buildSectionedTreeRows(sectionedFiles.value, query.value.trim() ? new Set() : collapsedDirs.value),
)

// 侧栏本地分页：200 行（与面板内列表同款保护）
const SIDEBAR_PAGE_SIZE = 200
const {
  paged: pagedRows,
  hasMore,
  loadMore,
} = usePagedList(rows, SIDEBAR_PAGE_SIZE)

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

/** 全部收起：收起两分区（分区折叠即整棵树收起） */
function collapseAll() {
  collapsedDirs.value = new Set(["section:staged", "section:unstaged", ...topLevelDirPaths(props.files)])
}

/** 文件名筛选命中片段高亮（与卡片名称搜索同款渲染） */
function nameSegments(name: string): HighlightSegment[] {
  return highlightSegments(name, query.value)
}

/** 缩进层级注入 CSS 变量（缩进量在 SCSS 中以 Token 计算） */
function indentStyle(depth: number): Record<string, string> {
  return { "--wt-sb-depth": String(depth) }
}

/** 暂存勾选翻转（与面板列表行同语义） */
function toggleStage(file: FileChange) {
  if (file.staged) emit("unstageFile", file.path)
  else emit("stageFile", file.path)
}
</script>
