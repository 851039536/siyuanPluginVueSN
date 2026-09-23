<!-- 单条文档关系行：引用方 → 被引用方，含双向/计数徽标与可展开详情 -->
<template>
  <li class="gr-row">
    <div
      class="gr-row__main"
      @click="emit('toggle', row)"
    >
      <div class="gr-row__doc gr-row__doc--source">
        <span
          class="gr-row__doc-name"
          :title="row.sourceHPath || row.sourceName"
          @click.stop="emit('open', row.sourceId)"
        >
          {{ row.sourceName || row.sourceId }}
        </span>
        <span
          v-if="row.sourceHPath"
          class="gr-row__doc-path"
          :title="row.sourceHPath"
        >
          {{ row.sourceHPath }}
        </span>
      </div>

      <div class="gr-row__arrow">
        <IconWrapper
          name="arrowRight"
          :size="14"
        />
      </div>

      <div class="gr-row__doc gr-row__doc--target">
        <span
          class="gr-row__doc-name"
          :title="row.targetHPath || row.targetName"
          @click.stop="emit('open', row.targetId)"
        >
          {{ row.targetName || row.targetId }}
        </span>
        <span
          v-if="row.targetHPath"
          class="gr-row__doc-path"
          :title="row.targetHPath"
        >
          {{ row.targetHPath }}
        </span>
      </div>

      <div class="gr-row__meta">
        <!-- 徽标："双向" -->
        <Tag
          v-if="row.bidirectional"
          variant="info"
          size="xsmall"
        >
          {{ i18n.bidirectionalBadge }}
        </Tag>
        <!-- 徽标："引用 N" -->
        <Tag
          variant="secondary"
          size="xsmall"
        >
          {{ i18n.refCount }} {{ row.refCount }}
        </Tag>
        <IconWrapper
          name="chevronDown"
          :size="14"
          :class-name="row.detailsExpanded ? 'gr-row__chevron gr-row__chevron--open' : 'gr-row__chevron'"
        />
      </div>
    </div>

    <!-- 详情（按需展开）：锚文本 + 反链文档 -->
    <div
      v-if="row.detailsExpanded"
      class="gr-row__details"
    >
      <!-- 详情加载中："加载中..." -->
      <div
        v-if="row.detailsLoading"
        class="gr-row__details-empty"
      >
        {{ i18n.loading }}
      </div>
      <!-- 详情加载失败："详情加载失败或无数据" -->
      <div
        v-else-if="row.detailsFailed"
        class="gr-row__details-empty"
      >
        {{ i18n.loadDetailFailed }}
      </div>
      <template v-else>
        <!-- 标题："引用锚文本" -->
        <div class="gr-row__details-title">
          {{ i18n.anchorText }}
        </div>
        <!-- 空锚文本："无锚文本" -->
        <div
          v-if="!row.contents || row.contents.length === 0"
          class="gr-row__details-empty"
        >
          {{ i18n.noAnchorText }}
        </div>
        <ul
          v-else
          class="gr-row__contents"
        >
          <li
            v-for="(content, index) in row.contents"
            :key="index"
            class="gr-row__content-item"
          >
            {{ content }}
          </li>
        </ul>

        <!-- 标题："反向链接文档" -->
        <div class="gr-row__details-title">
          {{ i18n.backlinkDocs }}
        </div>
        <!-- 空反链："无反链文档" -->
        <div
          v-if="!row.backlinkDocs || row.backlinkDocs.length === 0"
          class="gr-row__details-empty"
        >
          {{ i18n.noBacklinkDocs }}
        </div>
        <ul
          v-else
          class="gr-row__backlinks"
        >
          <li
            v-for="doc in row.backlinkDocs"
            :key="doc.id"
            class="gr-row__backlink-item"
            @click="emit('open', doc.id)"
          >
            <span class="gr-row__backlink-name">{{ doc.name || doc.id }}</span>
            <span
              v-if="doc.hPath"
              class="gr-row__backlink-path"
            >{{ doc.hPath }}</span>
          </li>
        </ul>
      </template>
    </div>
  </li>
</template>

<script setup lang="ts">
import type {
  GlobalRelationRow,
  GlobalRelationsI18n,
} from "../types"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"

interface Props {
  row: GlobalRelationRow
  i18n: GlobalRelationsI18n
}

defineProps<Props>()

const emit = defineEmits<{
  (e: "toggle", row: GlobalRelationRow): void
  (e: "open", docId: string): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/RelationRow.scss";
</style>
