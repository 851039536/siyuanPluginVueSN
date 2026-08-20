<template>
  <div class="vp-freq-keywords">
    <div class="vp-freq-keywords__row">
      <span class="vp-freq-keywords__label">{{ i18n.frequentKeywords }}</span>

      <div
        v-if="keywords.length === 0"
        class="vp-freq-keywords__empty"
      >
        {{ i18n.noKeywords }}
      </div>

      <template
        v-for="kw in keywords"
        :key="kw"
      >
        <button
          class="vp-freq-keywords__chip"
          :title="`${i18n.searchKeyword}: ${kw}`"
          @click="emit('insert', kw)"
        >
          <span class="vp-freq-keywords__chip-text">{{ kw }}</span>
          <span
            class="vp-freq-keywords__chip-del"
            :title="i18n.deleteKeyword"
            @click.stop="handleDelete(kw)"
          >×</span>
        </button>
      </template>

      <!-- 添加输入区 -->
      <div
        v-if="isAdding"
        class="vp-freq-keywords__add-wrap"
      >
        <input
          ref="addInputRef"
          v-model="newKeyword"
          type="text"
          class="vp-freq-keywords__add-input"
          :placeholder="i18n.keywordPlaceholder"
          maxlength="60"
          @keydown.enter.prevent="handleAdd"
          @keydown.escape="cancelAdd"
        />
        <button
          class="vp-freq-keywords__add-btn"
          :disabled="!newKeyword.trim()"
          @click="handleAdd"
        >
          {{ i18n.confirm }}
        </button>
        <button
          class="vp-freq-keywords__add-cancel"
          @click="cancelAdd"
        >
          {{ i18n.cancel }}
        </button>
      </div>
      <button
        v-else
        class="vp-freq-keywords__plus"
        :title="i18n.addKeyword"
        @click="startAdd"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  nextTick,
  ref,
} from "vue"

interface Props {
  keywords: string[]
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "insert", keyword: string): void
  (e: "add", keyword: string): void
  (e: "delete", keyword: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isAdding = ref(false)
const newKeyword = ref("")
const addInputRef = ref<HTMLInputElement | null>(null)

const startAdd = () => {
  isAdding.value = true
  newKeyword.value = ""
  nextTick(() => {
    addInputRef.value?.focus()
  })
}

const cancelAdd = () => {
  isAdding.value = false
  newKeyword.value = ""
}

const handleAdd = () => {
  const kw = newKeyword.value.trim()
  if (!kw) return
  if (props.keywords.includes(kw)) {
    return // 重复不添加
  }
  emit("add", kw)
  cancelAdd()
}

const handleDelete = (kw: string) => {
  emit("delete", kw)
}
</script>

<style scoped lang="scss">
@use "../styles/FrequentKeywords.scss";
</style>
