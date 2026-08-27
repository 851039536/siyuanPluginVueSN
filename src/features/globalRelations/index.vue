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
        <!-- 标题："全局关系列表" -->
        <span class="gr-header__title">{{ i18n.panelTitle }}</span>
      </div>
      <div class="gr-header__actions">
        <!-- 刷新按钮："刷新" -->
        <button
          class="gr-btn"
          :disabled="loading"
          @click="refresh"
        >
          <IconWrapper
            name="refresh"
            :size="14"
          />
          {{ i18n.refresh }}
        </button>
        <!-- 关闭按钮："关闭" -->
        <button
          class="gr-btn gr-btn--icon"
          :title="i18n.close"
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
      <!-- 标签："关系总数" -->
      <div class="gr-stat-card">
        <span class="gr-stat-card__value">{{ stats.total }}</span>
        <span class="gr-stat-card__label">{{ i18n.totalRelations }}</span>
      </div>
      <!-- 标签："涉及文档" -->
      <div class="gr-stat-card">
        <span class="gr-stat-card__value">{{ stats.docs }}</span>
        <span class="gr-stat-card__label">{{ i18n.involvedDocs }}</span>
      </div>
      <!-- 标签："双向关系" -->
      <div class="gr-stat-card gr-stat-card--bidirectional">
        <span class="gr-stat-card__value">{{ stats.bidirectional }}</span>
        <span class="gr-stat-card__label">{{ i18n.bidirectionalCount }}</span>
      </div>
      <!-- 标签："单向关系" -->
      <div class="gr-stat-card">
        <span class="gr-stat-card__value">{{ stats.unidirectional }}</span>
        <span class="gr-stat-card__label">{{ i18n.unidirectionalCount }}</span>
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
        <!-- 搜索占位："搜索文档标题或路径..." -->
        <input
          v-model="searchQuery"
          class="gr-search__input"
          :placeholder="i18n.searchPlaceholder"
        />
      </div>
      <div class="gr-direction-filter">
        <!-- 方向筛选："全部" -->
        <button
          class="gr-btn gr-btn--small"
          :class="{ active: directionFilter === 'all' }"
          @click="directionFilter = 'all'"
        >
          {{ i18n.directionAll }}
        </button>
        <!-- 方向筛选："双向" -->
        <button
          class="gr-btn gr-btn--small"
          :class="{ active: directionFilter === 'bidirectional' }"
          @click="directionFilter = 'bidirectional'"
        >
          {{ i18n.directionBidirectional }}
        </button>
        <!-- 方向筛选："单向" -->
        <button
          class="gr-btn gr-btn--small"
          :class="{ active: directionFilter === 'unidirectional' }"
          @click="directionFilter = 'unidirectional'"
        >
          {{ i18n.directionUnidirectional }}
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="gr-content">
      <!-- 加载中："加载中..." -->
      <div
        v-if="loading"
        class="gr-empty"
      >
        <IconWrapper
          name="loading"
          :size="20"
        />
        {{ i18n.loading }}
      </div>
      <!-- 加载失败：直接显示错误信息 -->
      <div
        v-else-if="error"
        class="gr-empty gr-empty--error"
      >
        {{ error }}
      </div>
      <!-- 空状态："未找到文档关系" -->
      <div
        v-else-if="filtered.length === 0"
        class="gr-empty"
      >
        <IconWrapper
          name="linkVariant"
          :size="28"
        />
        {{ i18n.noRelations }}
      </div>
      <!-- 关系列表 + 截断提示 -->
      <template v-else>
        <ul
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
                <!-- 徽标："双向" -->
                <span
                  v-if="row.bidirectional"
                  class="gr-badge gr-badge--bidirectional"
                >
                  {{ i18n.bidirectionalBadge }}
                </span>
                <!-- 徽标："引用 N" -->
                <span class="gr-badge gr-badge--count">
                  {{ i18n.refCount }} {{ row.refCount }}
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
              <!-- 详情加载中："加载中..." -->
              <div
                v-if="row.detailsLoading"
                class="gr-row__details-empty"
              >
                {{ i18n.loading }}
              </div>
              <!-- 详情加载失败："详情加载失败或无数据" -->
              <template v-else-if="row.detailsFailed">
                <div class="gr-row__details-empty">
                  {{ i18n.loadDetailFailed }}
                </div>
              </template>
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
        <!-- 截断提示："仅显示引用数最高的前 500 条关系" -->
        <div
          v-if="truncated"
          class="gr-truncated-hint"
        >
          {{ i18n.truncatedHint }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GlobalRelationsI18n } from "./types"
import { onMounted } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useGlobalRelations } from "./composables/useGlobalRelations"

interface Props {
  i18n: GlobalRelationsI18n
  onClose: () => void
}

const props = defineProps<Props>()

const {
  loading,
  error,
  searchQuery,
  directionFilter,
  stats,
  filtered,
  truncated,
  refresh,
  toggleDetails,
  openDoc,
} = useGlobalRelations(props.i18n)

onMounted(() => {
  void refresh()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
