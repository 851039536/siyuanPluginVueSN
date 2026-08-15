<!-- 全局关系列表面板：基于思源 refs 表 + getBacklink2 展示全库文档间双向链接关系 -->
<template>
  <div class="global-relations-panel">
    <!-- 头部标题栏 -->
    <div class="gr-header">
      <div class="gr-header__left">
        <IconWrapper
          name="globalRelations"
          :size="16"
        />
        <span class="gr-header__title">{{ t("panelTitle", "全局关系列表") }}</span>
      </div>
      <div class="gr-header__actions">
        <button
          class="gr-btn"
          :disabled="loading"
          @click="refresh"
        >
          <IconWrapper
            name="refresh"
            :size="14"
          />
          {{ t("refresh", "刷新") }}
        </button>
        <button
          class="gr-btn gr-btn--icon"
          :title="t('close', '关闭')"
          @click="onClose"
        >
          <IconWrapper
            name="close"
            :size="14"
          />
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="gr-stats">
      <div class="gr-stat-card">
        <span class="gr-stat-card__value">{{ stats.total }}</span>
        <span class="gr-stat-card__label">{{ t("totalRelations", "关系总数") }}</span>
      </div>
      <div class="gr-stat-card">
        <span class="gr-stat-card__value">{{ stats.docs }}</span>
        <span class="gr-stat-card__label">{{ t("involvedDocs", "涉及文档") }}</span>
      </div>
      <div class="gr-stat-card gr-stat-card--bidirectional">
        <span class="gr-stat-card__value">{{ stats.bidirectional }}</span>
        <span class="gr-stat-card__label">{{ t("bidirectionalCount", "双向关系") }}</span>
      </div>
      <div class="gr-stat-card">
        <span class="gr-stat-card__value">{{ stats.unidirectional }}</span>
        <span class="gr-stat-card__label">{{ t("unidirectionalCount", "单向关系") }}</span>
      </div>
    </div>

    <!-- 搜索与方向筛选 -->
    <div class="gr-toolbar">
      <div class="gr-search">
        <IconWrapper
          name="search"
          :size="14"
          class="gr-search__icon"
        />
        <input
          v-model="searchQuery"
          class="gr-search__input"
          :placeholder="t('searchPlaceholder', '搜索文档标题或路径...')"
        />
      </div>
      <div class="gr-direction-filter">
        <button
          class="gr-btn gr-btn--small"
          :class="{ active: directionFilter === 'all' }"
          @click="directionFilter = 'all'"
        >
          {{ t("directionAll", "全部") }}
        </button>
        <button
          class="gr-btn gr-btn--small"
          :class="{ active: directionFilter === 'bidirectional' }"
          @click="directionFilter = 'bidirectional'"
        >
          {{ t("directionBidirectional", "双向") }}
        </button>
        <button
          class="gr-btn gr-btn--small"
          :class="{ active: directionFilter === 'unidirectional' }"
          @click="directionFilter = 'unidirectional'"
        >
          {{ t("directionUnidirectional", "单向") }}
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="gr-content">
      <!-- 加载中 -->
      <div
        v-if="loading"
        class="gr-empty"
      >
        <IconWrapper
          name="loading"
          :size="20"
        />
        {{ t("loading", "加载中...") }}
      </div>
      <!-- 加载失败 -->
      <div
        v-else-if="error"
        class="gr-empty gr-empty--error"
      >
        {{ error }}
      </div>
      <!-- 空状态 -->
      <div
        v-else-if="filtered.length === 0"
        class="gr-empty"
      >
        <IconWrapper
          name="linkVariant"
          :size="28"
        />
        {{ t("noRelations", "未找到文档关系") }}
      </div>
      <!-- 关系列表 -->
      <ul
        v-else
        class="gr-list"
      >
        <li
          v-for="row in filtered"
          :key="`${row.sourceId}-${row.targetId}`"
          class="gr-row"
        >
          <div
            class="gr-row__main"
            @click="toggleDetails(row)"
          >
            <div class="gr-row__doc gr-row__doc--source">
              <span
                class="gr-row__doc-name"
                :title="row.sourceHPath || row.sourceName"
                @click.stop="openDoc(row.sourceId)"
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
                @click.stop="openDoc(row.targetId)"
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
              <span
                v-if="row.bidirectional"
                class="gr-badge gr-badge--bidirectional"
              >
                {{ t("bidirectionalBadge", "双向") }}
              </span>
              <span class="gr-badge gr-badge--count">
                {{ t("refCount", "引用") }} {{ row.refCount }}
              </span>
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
            <div
              v-if="row.detailsLoading"
              class="gr-row__details-empty"
            >
              {{ t("loading", "加载中...") }}
            </div>
            <template v-else-if="row.detailsFailed">
              <div class="gr-row__details-empty">
                {{ t("loadDetailFailed", "详情加载失败或无数据") }}
              </div>
            </template>
            <template v-else>
              <!-- 引用锚文本（SQL refs.content） -->
              <div class="gr-row__details-title">
                {{ t("anchorText", "引用锚文本") }}
              </div>
              <div
                v-if="!row.contents || row.contents.length === 0"
                class="gr-row__details-empty"
              >
                {{ t("noAnchorText", "无锚文本") }}
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

              <!-- 反向链接文档（getBacklink2） -->
              <div class="gr-row__details-title">
                {{ t("backlinkDocs", "反向链接文档") }}
              </div>
              <div
                v-if="!row.backlinkDocs || row.backlinkDocs.length === 0"
                class="gr-row__details-empty"
              >
                {{ t("noBacklinkDocs", "无反链文档") }}
              </div>
              <ul
                v-else
                class="gr-row__backlinks"
              >
                <li
                  v-for="doc in row.backlinkDocs"
                  :key="doc.id"
                  class="gr-row__backlink-item"
                  @click="openDoc(doc.id)"
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
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { GlobalRelationsI18n } from "./types"
import { onMounted } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useGlobalRelations } from "./composables/useGlobalRelations"

interface Props {
  i18n: Partial<GlobalRelationsI18n>
  plugin: Plugin
  onClose: () => void
}

const props = defineProps<Props>()

/** i18n 取值（带中文兜底） */
const t = (key: keyof GlobalRelationsI18n, fallback: string): string =>
  (props.i18n as Record<string, string>)[key] || fallback

const {
  loading,
  error,
  searchQuery,
  directionFilter,
  stats,
  filtered,
  refresh,
  toggleDetails,
  openDoc,
} = useGlobalRelations(props.i18n as Record<string, string>)

onMounted(() => {
  void refresh()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
