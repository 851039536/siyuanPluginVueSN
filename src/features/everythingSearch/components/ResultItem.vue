<!-- 搜索结果项：类型图标 + 名称/路径 + 元数据 + 四个操作按钮；行支持双击与键盘打开 -->
<template>
  <div
    class="vp-result-item"
    role="button"
    tabindex="0"
    :aria-label="openButtonTitle"
    @dblclick="handleOpen"
    @keydown.enter.self="handleOpen"
    @keydown.space.self.prevent="handleOpen"
  >
    <!-- 类型图标 -->
    <div class="vp-result-item__icon">
      <IconWrapper
        :name="iconKey"
        :size="14"
      />
    </div>

    <!-- 文件信息 -->
    <div class="vp-result-item__info">
      <div
        class="vp-result-item__name"
        :title="item.name"
      >
        {{ item.name }}
      </div>
      <div
        class="vp-result-item__path"
        :title="fullPath"
      >
        {{ item.path }}
      </div>
    </div>

    <!-- 元数据 -->
    <div class="vp-result-item__meta">
      <span
        v-if="item.type === 'file'"
        class="vp-result-item__size"
      >{{ formattedSize }}</span>
      <span class="vp-result-item__date">{{ item.dateModified }}</span>
    </div>

    <!-- 操作按钮（@dblclick.stop 防止快速双击删除/复制时冒泡触发行双击打开）
         键盘触发一律 @click，不用 @keydown.enter/space：那会与原生按钮的 Enter/Space
         激活同时生效 → 一次按键触发两次操作（打开两次 / 复制两次 / 误触删除）
         纯图标按钮一律带 title + aria-label（AGENTS_STYLE § 按钮交互与无障碍） -->
    <div
      class="vp-result-item__actions"
      @dblclick.stop
    >
      <!-- 打开按钮提示："打开文件夹" / "打开文件" -->
      <Button
        class="vp-result-item__action"
        variant="ghost"
        size="xsmall"
        dense
        rounded
        icon="openInNew"
        :title="openButtonTitle"
        :aria-label="openButtonTitle"
        @click.stop="handleOpen"
      />
      <!-- 操作按钮提示："在资源管理器中显示" -->
      <Button
        class="vp-result-item__action"
        variant="ghost"
        size="xsmall"
        dense
        rounded
        icon="folder"
        :title="i18n.showInExplorer"
        :aria-label="i18n.showInExplorer"
        @click.stop="handleShowInFolder"
      />
      <!-- 操作按钮提示："复制路径" -->
      <Button
        class="vp-result-item__action"
        variant="ghost"
        size="xsmall"
        dense
        rounded
        icon="copy"
        :title="i18n.copyPath"
        :aria-label="i18n.copyPath"
        @click.stop="handleCopyPath"
      />
      <!-- 操作按钮提示："删除"（危险操作：`variant="danger"` 按既有语义即描边红；
           不叠 severity + ghost —— severity 颜色族块在源码中先于外观修饰，叠加时需再补 outlined 才不至于变实底，类名越少越稳） -->
      <Button
        class="vp-result-item__action vp-result-item__action--delete"
        variant="danger"
        size="xsmall"
        dense
        rounded
        icon="delete"
        :title="i18n.delete"
        :aria-label="i18n.delete"
        @click.stop="handleDelete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EverythingSearchResult } from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatFileSize } from "@/utils/format"
import { getFullPath } from "../utils"
import { entryIconKey } from "../icons"

interface Props {
  item: EverythingSearchResult
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "open", item: EverythingSearchResult): void
  (e: "showInFolder", item: EverythingSearchResult): void
  (e: "copyPath", item: EverythingSearchResult): void
  (e: "delete", item: EverythingSearchResult): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fullPath = computed(() => getFullPath(props.item))
const formattedSize = computed(() => formatFileSize(props.item.size))

/** 类型图标：扩展名映射收敛到 ../icons.ts（禁止在本组件内复制粘贴） */
const iconKey = computed(() => entryIconKey(props.item))

// 打开按钮提示文案："打开文件夹" / "打开文件"（同时作为结果行的可访问名称）
const openButtonTitle = computed(() =>
  props.item.type === "folder" ? props.i18n.openFolder : props.i18n.openFile,
)

const handleOpen = () => emit("open", props.item)
const handleShowInFolder = () => emit("showInFolder", props.item)
const handleCopyPath = () => emit("copyPath", props.item)
const handleDelete = () => emit("delete", props.item)
</script>

<style scoped lang="scss">
@use "../styles/ResultItem.scss";
</style>
