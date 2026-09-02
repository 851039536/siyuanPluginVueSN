<!-- 在指定提交上打 Tag 的弹窗（LOG Tab 行内入口） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="$emit('close')"
    >
      <div class="gp-dialog gp-tagc-dialog">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："在此提交上打 Tag" -->
          <span class="gp-dialog-title">{{ i18n.tagOnCommitTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            @click="$emit('close')"
          >
            <Icon
              icon="mdi:close"
              height="10"
            />
          </button>
        </div>

        <div class="gp-dialog-body">
          <!-- 元信息：项目名 + 提交 hash -->
          <div class="gp-tagc-meta">
            <span class="gp-tagc-project">{{ target.projectName }}</span>
            <!-- "提交" -->
            <span class="gp-tagc-label">{{ i18n.tagOnCommitHash }}</span>
            <span class="gp-tagc-hash">{{ target.hash }}</span>
          </div>

          <!-- 原提交信息 -->
          <pre class="gp-tagc-message">{{ target.message }}</pre>

          <!-- 该提交已有的 Tag -->
          <div
            v-if="target.existingTags.length"
            class="gp-tagc-block"
          >
            <!-- 标签："已有 Tag" -->
            <label class="gp-label">{{ i18n.commitTagsLabel }}</label>
            <div class="gp-tagc-existing">
              <span
                v-for="tag in target.existingTags"
                :key="tag"
                class="gp-tagc-chip"
              >
                <Icon
                  icon="mdi:tag-outline"
                  height="10"
                />
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- Tag 名称输入 -->
          <div class="gp-tagc-block">
            <Input
              v-model="tagName"
              size="xsmall"
              :placeholder="i18n.tagNamePlaceholder"
              @keydown.enter="create"
            />
            <!-- 注解输入（可选） -->
            <Input
              v-model="tagMessage"
              size="xsmall"
              :placeholder="i18n.tagMsgPlaceholder"
              @keydown.enter="create"
            />
          </div>
        </div>

        <div class="gp-dialog-footer">
          <div class="gp-grow" />
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click="$emit('close')"
          >
            {{ i18n.cancel }}
          </button>
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!tagName.trim()"
            @click="create"
          >
            <Icon
              icon="mdi:tag-plus-outline"
              height="12"
            />
            <span>{{ i18n.createTag }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import Input from "@/components/Input.vue"

defineProps<{
  i18n: Record<string, any>
  target: {
    projectName: string
    hash: string
    message: string
    existingTags: string[]
  }
}>()

const emit = defineEmits<{
  create: [name: string, message?: string]
  close: []
}>()

const tagName = ref("")
const tagMessage = ref("")

function create() {
  const name = tagName.value.trim()
  if (!name) return
  emit("create", name, tagMessage.value.trim() || undefined)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})
</script>

<style lang="scss">
@use "../../styles/TagCommitDialog.scss";
@use "../../styles/index.scss";
</style>
