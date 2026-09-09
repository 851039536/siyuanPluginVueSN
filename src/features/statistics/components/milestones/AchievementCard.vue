<!-- 成就卡片子组件：解锁/锁定两态共用（锁定态锁图标 + 半透明），内置成就走 i18n 键、自定义成就原样文本 -->
<template>
  <div
    class="achievement-card"
    :class="[`tier-${ach.tier}`, {
      'custom-ach': ach._custom,
      'locked-card': locked,
    }]"
  >
    <!-- 自定义成就删除按钮（删除前由父级确认） -->
    <button
      v-if="ach._custom"
      class="btn-del-ach"
      :title="i18n.deleteAchievementHint"
      @click="emit('delete', ach.id)"
    >
      <IconWrapper
        name="close"
        :size="12"
      />
    </button>
    <IconWrapper
      class="ach-icon"
      :name="iconName"
    />
    <span class="ach-title">{{ achText(ach.title) }}</span>
    <span class="ach-desc">{{ achText(ach.description) }}</span>
  </div>
</template>

<script setup lang="ts">
// 成就卡片：按 locked 切换图标/置灰样式，title/description 经 i18n 键或字面文本解析
import type { AchievementDef } from "../../types/milestoneData"
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { resolveI18nText } from "../../utils"

interface Props {
  ach: AchievementDef
  locked?: boolean
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  locked: false,
  i18n: () => ({}),
})
const emit = defineEmits<{
  delete: [id: string]
}>()

/** 图标：锁定态统一锁图标，解锁态显示成就自身图标 */
const iconName = computed<IconKey>(() =>
  (props.locked ? "pageLock" : props.ach.icon) as IconKey,
)

/** 文案解析：内置成就为 i18n 键，自定义成就为用户字面文本 */
function achText(keyOrText: string): string {
  return resolveI18nText(props.i18n, keyOrText)
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestonesCard.scss";
@use '../../styles/index.scss' as stats;
</style>
