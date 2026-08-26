<!-- 文档分析功能 - 设置弹窗健康度分区（扣分项勾选 + 0B 排除书签勾选） -->
<template>
  <section class="settings-section">
    <div class="settings-section-title">健康度</div>

    <!-- 扣分项配置区：勾选的项才参与扣分分析 -->
    <div class="deduction-list">
      <label
        v-for="opt in deductionOptions"
        :key="opt.key"
        class="settings-check-row"
      >
        <input
          type="checkbox"
          :checked="enabledDeductions.includes(opt.key)"
          @change="toggleDeduction(opt.key, ($event.target as HTMLInputElement).checked)"
        />
        <span class="settings-check-label">{{ opt.label }}</span>
      </label>
    </div>

    <!-- 0B 排除书签区：带被勾选书签的文档整体剔除出统计口径 -->
    <div class="settings-subsection">
      <div class="settings-subsection-title">0B 排除书签（带以下书签的文档不计入统计）</div>
      <label
        v-for="bk in bookmarkOptions"
        :key="bk"
        class="settings-check-row"
      >
        <input
          type="checkbox"
          :checked="zeroByteExcludeBookmarks.includes(bk)"
          @change="toggleBookmark(bk, ($event.target as HTMLInputElement).checked)"
        />
        <span class="settings-check-label">{{ bk || "(空值)" }}</span>
      </label>
      <p
        v-if="bookmarkOptions.length === 0"
        class="settings-empty-tip"
      >暂无书签，可先在思源中为文档添加书签</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { BookmarkDetail, DeductionKey } from "../../types/index"
import { DEDUCTION_OPTIONS } from "../../types/index"

interface Props {
  enabledDeductions: DeductionKey[]
  zeroByteExcludeBookmarks: string[]
  bookmarkDistribution: BookmarkDetail[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:enabledDeductions", value: DeductionKey[]): void
  (e: "update:zeroByteExcludeBookmarks", value: string[]): void
}>()

/** 扣分项选项（静态注册表） */
const deductionOptions = DEDUCTION_OPTIONS

/** 0B 排除书签可选项：动态书签分布 ∪ 已勾选书签（去重），保证已排除的书签仍可取消勾选 */
const bookmarkOptions = computed(() => {
  const seen = new Set(props.zeroByteExcludeBookmarks)
  for (const b of props.bookmarkDistribution) seen.add(b.value)
  return [...seen]
})

/** 切换扣分项（编辑副本，统一保存时生效） */
function toggleDeduction(key: DeductionKey, checked: boolean) {
  const current = new Set(props.enabledDeductions)
  if (checked) current.add(key)
  else current.delete(key)
  emit("update:enabledDeductions", [...current])
}

/** 切换 0B 排除书签 */
function toggleBookmark(bookmark: string, checked: boolean) {
  const current = new Set(props.zeroByteExcludeBookmarks)
  if (checked) current.add(bookmark)
  else current.delete(bookmark)
  emit("update:zeroByteExcludeBookmarks", [...current])
}
</script>

<style lang="scss" scoped>
@use "../../styles/SettingsPanel.scss";
</style>
