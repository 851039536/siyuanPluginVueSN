<!-- gitPush 统计视图远程覆盖率区块（四个平台 + 多远程合计，配置驱动渲染条形） -->
<template>
  <StatsSection :title="i18n.remoteCoverage">
    <!-- 区块标题："远程仓库覆盖率" -->
    <div class="gp-coverage-list">
      <!-- 覆盖率条目：四个平台 + 多远程合计（配置驱动，多远程标签为"多远程项目"；hover 显示项目数明细） -->
      <div
        v-for="c in coverageItems"
        :key="c.key"
        class="gp-coverage-item"
        :title="c.counts"
      >
        <div class="gp-coverage-head">
          <Icon
            :icon="c.icon"
            height="12"
          />
          <span>{{ c.label }}</span>
          <span class="gp-coverage-num">{{ c.pct }}</span>
        </div>
        <div class="gp-coverage-bar">
          <div
            class="gp-coverage-fill"
            :class="`gp-coverage-fill--${c.key}`"
            :style="{ width: c.pct }"
          />
        </div>
      </div>
    </div>
  </StatsSection>
</template>

<script setup lang="ts">
// gitPush 统计视图远程覆盖率区块（平台配置条 + 多远程合计）
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META } from "../../types"
import { ratioPct } from "../../utils"
import StatsSection from "./common/StatsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 remoteCoverage + projectCount） */
  stats: StatsView
}>()

/** 覆盖率条目：四个平台（PLATFORM_META 投影）+ 多远程合计（预计算占比与计数明细；key 同时作为 gp-coverage-fill 修饰类后缀） */
const coverageItems = computed(() => {
  const total = props.stats.projectCount
  const platformItems = PLATFORM_META.map((pm) => {
    const count = props.stats.remoteCoverage[pm.key]
    return {
      key: pm.key,
      icon: pm.icon,
      label: pm.label,
      count,
      pct: ratioPct(count, total),
      counts: `${count} / ${total}`,
    }
  })
  const multiple = props.stats.remoteCoverage.multiple
  return [
    ...platformItems,
    // 多远程项目条目："多远程项目"
    {
      key: "multi",
      icon: "mdi:layers",
      label: props.i18n.multipleRemotes,
      count: multiple,
      pct: ratioPct(multiple, total),
      counts: `${multiple} / ${total}`,
    },
  ]
})
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
