<!-- gitPush 统计视图远程覆盖率区块（四个平台 + 多远程合计，配置驱动渲染条形） -->
<template>
  <div class="gp-stats-section">
    <div class="gp-stats-section-title">
      <!-- 区块标题："远程覆盖率" -->
      {{ i18n.remoteCoverage }}
    </div>
    <div class="gp-coverage-list">
      <!-- 覆盖率条目：四个平台 + 多远程合计（配置驱动，多远程标签为"多远程项目"；hover 显示百分比） -->
      <div
        v-for="c in coverageItems"
        :key="c.key"
        class="gp-coverage-item"
        :title="ratioPct(c.count, stats.projectCount)"
      >
        <div class="gp-coverage-head">
          <Icon
            :icon="c.icon"
            height="12"
          />
          <span>{{ c.label }}</span>
          <span class="gp-coverage-num">{{ c.count }} / {{ stats.projectCount }}</span>
        </div>
        <div class="gp-coverage-bar">
          <div
            class="gp-coverage-fill"
            :class="`gp-coverage-fill--${c.key}`"
            :style="{ width: ratioPct(c.count, stats.projectCount) }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图远程覆盖率区块（平台配置条 + 多远程合计）
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META } from "../../types"
import { ratioPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 remoteCoverage + projectCount） */
  stats: StatsView
}>()

/** 覆盖率条目：四个平台（PLATFORM_META 投影）+ 多远程合计（key 同时作为 gp-coverage-fill 修饰类后缀） */
const coverageItems = computed(() => [
  ...PLATFORM_META.map((pm) => ({
    key: pm.key as string,
    icon: pm.icon,
    label: pm.label as string,
    count: props.stats.remoteCoverage[pm.key],
  })),
  // 多远程项目条目："多远程项目"
  { key: "multi", icon: "mdi:layers", label: props.i18n.multipleRemotes as string, count: props.stats.remoteCoverage.multiple },
])
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
