<template>
  <div class="vp-freq-keywords">
    <div class="vp-freq-keywords__row">
      <span class="vp-freq-keywords__label">常用关键字</span>

      <div v-if="keywords.length === 0" class="vp-freq-keywords__empty">
        暂无，点击 + 添加
      </div>

      <template v-for="kw in keywords" :key="kw">
        <button
          class="vp-freq-keywords__chip"
          :title="`搜索: ${kw}`"
          @click="emit('insert', kw)"
        >
          <span class="vp-freq-keywords__chip-text">{{ kw }}</span>
          <span
            class="vp-freq-keywords__chip-del"
            title="删除"
            @click.stop="handleDelete(kw)"
          >×</span>
        </button>
      </template>

      <!-- 添加输入区 -->
      <div v-if="isAdding" class="vp-freq-keywords__add-wrap">
        <input
          ref="addInputRef"
          v-model="newKeyword"
          type="text"
          class="vp-freq-keywords__add-input"
          placeholder="输入关键字"
          maxlength="60"
          @keydown.enter.prevent="handleAdd"
          @keydown.escape="cancelAdd"
        />
        <button
          class="vp-freq-keywords__add-btn"
          :disabled="!newKeyword.trim()"
          @click="handleAdd"
        >
          确定
        </button>
        <button class="vp-freq-keywords__add-cancel" @click="cancelAdd">
          取消
        </button>
      </div>
      <button
        v-else
        class="vp-freq-keywords__plus"
        title="添加常用关键字"
        @click="startAdd"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue"

interface Props {
  keywords: string[]
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
