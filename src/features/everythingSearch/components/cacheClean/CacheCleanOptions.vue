<!-- 缓存清理偏好设置：清理方式 / 时间门槛 / 条目上限（纯展示，值经 emit 交由容器落盘） -->
<template>
  <div class="cc-options">
    <div class="cc-options__field">
      <span class="cc-options__key">{{ i18n.cacheMode }}</span>
      <RadioButton
        v-for="option in modeOptions"
        :key="option.value"
        size="xsmall"
        :name="groupName"
        :model-value="mode"
        :value="option.value"
        :label="option.label"
        @update:model-value="emit('update-mode', option.value)"
      />
    </div>
    <p class="cc-options__hint">
      {{ mode === "recycle" ? i18n.cacheModeRecycleHint : i18n.cacheModePermanentHint }}
    </p>

    <div class="cc-options__field">
      <span class="cc-options__key">{{ i18n.cacheMinAge }}</span>
      <Input
        :model-value="minAgeMinutes"
        type="number"
        size="xsmall"
        class="cc-options__number"
        @update:model-value="emit('update-min-age', Number($event))"
      />
      <span class="cc-options__unit">{{ i18n.cacheMinAgeUnit }}</span>
      <span class="cc-options__hint-inline">{{ i18n.cacheMinAgeHint }}</span>
    </div>

    <div class="cc-options__field">
      <span class="cc-options__key">{{ i18n.cacheMaxEntries }}</span>
      <Input
        :model-value="maxEntries"
        type="number"
        size="xsmall"
        class="cc-options__number"
        @update:model-value="emit('update-max-entries', Number($event))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CacheCleanMode } from "../../types"
import {
  computed,
  useId,
} from "vue"
import Input from "@/components/Input.vue"
import RadioButton from "@/components/RadioButton.vue"

interface Props {
  /** 当前清理方式 */
  mode: CacheCleanMode
  /** 只清理早于 N 分钟未改动的条目 */
  minAgeMinutes: number
  /** 单次扫描条目上限 */
  maxEntries: number
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "update-mode", mode: CacheCleanMode): void
  (e: "update-min-age", minutes: number): void
  (e: "update-max-entries", max: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 单选组 name 需唯一：同一面板多实例（弹窗 + 浮动窗口）共用固定 name 会串组 */
const groupName = `cc-clean-mode-${useId()}`

/** 清理方式选项（computed 保证切换语言即时更新） */
const modeOptions = computed<{ value: CacheCleanMode, label: string }[]>(() => [
  { value: "recycle", label: props.i18n.cacheModeRecycle },
  { value: "permanent", label: props.i18n.cacheModePermanent },
])
</script>

<style scoped lang="scss">
@use "../../styles/CacheCleanOptions.scss";
</style>
