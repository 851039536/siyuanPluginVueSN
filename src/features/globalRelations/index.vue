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
        <Button
          icon="refresh"
          variant="ghost"
          size="xsmall"
          :loading="loading"
          :title="i18n.refresh"
          @click="refresh"
        />
        <!-- 关闭按钮："关闭" -->
        <Button
          icon="close"
          variant="ghost"
          size="xsmall"
          :title="i18n.close"
          @click="onClose"
        />
      </div>
    </div>

    <!-- 统计卡片 -->
    <StatsRow
      :stats="stats"
      :i18n="i18n"
    />

    <!-- 搜索与方向筛选 -->
    <div class="gr-toolbar">
      <Input
        v-model="searchQuery"
        class="gr-search"
        size="small"
        prefix-icon="search"
        :placeholder="i18n.searchPlaceholder"
      />
      <div class="gr-direction-filter">
        <!-- 方向筛选："全部" -->
        <Button
          size="xsmall"
          dense
          :outlined="directionFilter !== 'all'"
          :text="directionFilter === 'all'"
          :aria-pressed="directionFilter === 'all'"
          @click="directionFilter = 'all'"
        >
          {{ i18n.directionAll }}
        </Button>
        <!-- 方向筛选："双向" -->
        <Button
          size="xsmall"
          dense
          :outlined="directionFilter !== 'bidirectional'"
          :text="directionFilter === 'bidirectional'"
          :aria-pressed="directionFilter === 'bidirectional'"
          @click="directionFilter = 'bidirectional'"
        >
          {{ i18n.directionBidirectional }}
        </Button>
        <!-- 方向筛选："单向" -->
        <Button
          size="xsmall"
          dense
          :outlined="directionFilter !== 'unidirectional'"
          :text="directionFilter === 'unidirectional'"
          :aria-pressed="directionFilter === 'unidirectional'"
          @click="directionFilter = 'unidirectional'"
        >
          {{ i18n.directionUnidirectional }}
        </Button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="gr-content">
      <!-- 加载中："加载中..." -->
      <div
        v-if="loading"
        class="gr-empty"
      >
        <Loader />
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
        <ul class="gr-list">
          <RelationRow
            v-for="row in filtered"
            :key="`${row.sourceId}-${row.targetId}`"
            :row="row"
            :i18n="i18n"
            @toggle="toggleDetails"
            @open="openDoc"
          />
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
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Loader from "@/components/Loader.vue"
import RelationRow from "./components/RelationRow.vue"
import StatsRow from "./components/StatsRow.vue"
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
