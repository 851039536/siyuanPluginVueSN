<!-- 缓存根目录勾选列表：三态勾选 + 分类图标 + 风险标签 + 体积/条数（纯展示，逻辑全在容器） -->
<template>
  <div class="cc-roots">
    <div class="cc-roots__head">
      <span class="cc-roots__title">{{ i18n.cacheRootsTitle }}</span>
      <span class="cc-roots__hint">{{ i18n.cacheRootsHint }}</span>
    </div>

    <ul class="cc-roots__list">
      <li
        v-for="row in roots"
        :key="row.id"
        class="cc-roots__row"
        :class="{ 'cc-roots__row--missing': row.paths.length === 0 }"
      >
        <Checkbox
          size="small"
          :model-value="row.checked"
          :indeterminate="row.indeterminate"
          :disabled="row.paths.length === 0"
          :aria-label="row.label"
          @update:model-value="emit('toggle', row.id, $event === true)"
        />

        <IconWrapper
          :name="row.icon"
          :size="12"
          class="cc-roots__icon"
        />

        <div class="cc-roots__main">
          <div class="cc-roots__line">
            <span class="cc-roots__label">{{ row.label }}</span>
            <Tag
              size="xsmall"
              :variant="row.risk === 'safe' ? 'success' : 'warning'"
              :content="row.risk === 'safe' ? i18n.cacheRiskSafe : i18n.cacheRiskCaution"
            />
            <span
              v-if="row.files > 0"
              class="cc-roots__count"
            >{{ row.files }}</span>
          </div>

          <!-- 路径：多候选（浏览器缓存等）时逐行展示，每行可单独在资源管理器中打开 -->
          <div
            v-for="path in row.paths"
            :key="path"
            class="cc-roots__path-row"
          >
            <span
              class="cc-roots__path"
              :title="path"
            >{{ path }}</span>
            <Button
              variant="ghost"
              text
              size="xsmall"
              dense
              icon="folderOpen"
              :title="i18n.cacheOpenFolder"
              @click="emit('open', path)"
            />
          </div>

          <div
            v-if="row.paths.length === 0"
            class="cc-roots__note"
          >{{ i18n.cacheRootMissing }}</div>
          <div
            v-else-if="row.message"
            class="cc-roots__note"
          >{{ i18n.cacheNoPermission }}</div>
        </div>

        <span
          v-if="row.size > 0"
          class="cc-roots__size"
        >{{ formatSize(row.size) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { CacheRootId } from "../../types"
import type { CacheRootRow } from "./types"
import Button from "@/components/Button.vue"
import Checkbox from "@/components/Checkbox.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"
import { formatSize } from "./format"

interface Props {
  /** 根目录行（由容器拍平，含勾选态与扫描合计） */
  roots: CacheRootRow[]
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  /** 勾选/取消勾选整个分类（checked 为期望态） */
  (e: "toggle", id: CacheRootId, checked: boolean): void
  /** 在资源管理器中打开某条已解析路径 */
  (e: "open", path: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped lang="scss">
@use "../../styles/CacheCleanRootList.scss";
</style>
