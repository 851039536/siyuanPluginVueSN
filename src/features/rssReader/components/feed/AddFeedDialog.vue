<!--
  RSS 添加订阅源对话框 — 输入 URL 与分组后调用添加逻辑
-->
<template>
  <div class="rss-add-dialog">
    <div class="dialog-header">
      <!-- 对话框标题："添加订阅源" -->
      <span class="dialog-title">{{ i18n.addFeed }}</span>
      <button
        class="close-btn"
        @click="emit('close')"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>
    <div class="dialog-body">
      <div class="form-group">
        <!-- 订阅地址标签 -->
        <label>{{ i18n.feedUrl }}</label>
        <input
          v-model="url"
          :placeholder="i18n.feedUrlPlaceholder"
          @keydown.enter="handleAddFeed"
        >
        <!-- 提示："支持RSS 2.0和Atom格式的订阅地址" -->
        <div class="hint">
          {{ i18n.feedUrlHint }}
        </div>
      </div>
      <div class="form-group">
        <!-- 分组标签 -->
        <label>{{ i18n.feedGroup }}</label>
        <input
          v-model="group"
          :placeholder="i18n.feedGroupPlaceholder"
        >
      </div>
    </div>
    <div class="dialog-footer">
      <!-- 取消按钮 -->
      <button @click="emit('close')">
        {{ i18n.cancel }}
      </button>
      <button
        class="primary"
        :disabled="!url.trim() || adding"
        @click="handleAddFeed"
      >
        <!-- 添加/添加中按钮文案 -->
        {{ adding ? i18n.adding : i18n.add }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref } from "vue"

interface Props {
  i18n: Record<string, string>
  adding: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  submit: [url: string, group: string | undefined]
}>()

const url = ref("")
const group = ref("")

function handleAddFeed() {
  if (!url.value.trim() || props.adding) return
  emit("submit", url.value, group.value || undefined)
}
</script>

<style lang="scss">
@use "../../styles/AddFeedDialog.scss";
@use "../../styles/index.scss";
</style>
