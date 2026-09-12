<!-- FileUpload 私有子部件：选择入口（basic 选择按钮 / advanced 拖拽区），禁止 feature 直接导入 -->
<template>
  <!-- basic 模式：只有一个选择按钮 + 已选数量徽标 -->
  <div
    v-if="mode === 'basic'"
    class="si-fileupload__basic"
  >
    <Button
      :variant="disabled ? 'ghost' : 'primary'"
      :size="size"
      :disabled="disabled"
      :icon="$slots.chooseicon ? undefined : 'cloudUpload'"
      @click="emit('choose')"
    >
      <slot name="chooseicon" />
      {{ chooseLabel }}
    </Button>
    <!-- 已选数量徽标（对齐官方用 Badge 呈现计数） -->
    <Badge
      v-if="fileCount > 0"
      :content="fileCount"
      :size="size"
      variant="primary"
    />
  </div>

  <!-- advanced 模式：拖拽区（点击、Enter、Space 均可触发选择） -->
  <div
    v-else
    class="si-fileupload__dropzone"
    :class="{ 'si-fileupload__dropzone--active': active }"
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled || undefined"
    @click="emit('choose')"
    @keydown.enter.prevent="emit('choose')"
    @keydown.space.prevent="emit('choose')"
    @dragenter.prevent="emit('dragenter')"
    @dragover.prevent="emit('dragover')"
    @dragleave.prevent="emit('dragleave', $event)"
    @drop.prevent="emit('drop', $event)"
  >
    <IconWrapper
      name="cloudUpload"
      :size="iconSize"
      class="si-fileupload__dropzone-icon"
    />
    <span class="si-fileupload__dropzone-text">{{ dragText }}</span>
    <span
      v-if="hintText"
      class="si-fileupload__dropzone-hint"
    >{{ hintText }}</span>
    <Button
      variant="primary"
      :size="size"
      :disabled="disabled"
      :icon="$slots.chooseicon ? undefined : 'fileUploadOutline'"
      class="si-fileupload__dropzone-btn"
      @click.stop="emit('choose')"
    >
      <slot name="chooseicon" />
      {{ chooseLabel }}
    </Button>
  </div>
</template>

<script setup lang="ts">
// 选择入口子部件：两种模式的头部形态差异较大，独立后父组件只保留队列与编排逻辑。
// 本部件**不碰文件与校验**，所有交互都以上抛事件的形式交给父组件处理。
import type { FileUploadMode, FileUploadSize } from "./types"
import Badge from "../Badge.vue"
import Button from "../Button.vue"
import IconWrapper from "../IconWrapper.vue"

interface Props {
  /** 展示模式：决定渲染 basic 选择按钮还是 advanced 拖拽区 */
  mode: FileUploadMode
  /** 尺寸档位（透传给按钮与徽标） */
  size: FileUploadSize
  /** 是否禁用 */
  disabled: boolean
  /** 当前已选数量（basic 模式徽标用） */
  fileCount: number
  /** 是否处于拖拽悬停态（高亮用） */
  active: boolean
  /** 拖拽区图标边长（px） */
  iconSize: number
  /** 拖拽区主文案 */
  dragText: string
  /** 拖拽区补充提示（空则不渲染） */
  hintText: string
  /** 选择按钮文案 */
  chooseLabel: string
}

defineProps<Props>()

const emit = defineEmits<{
  /** 请求打开选择对话框 */
  choose: []
  dragenter: []
  dragover: []
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
}>()
</script>

<style scoped lang="scss">
@use '../styles/FileUpload.scss';
</style>
