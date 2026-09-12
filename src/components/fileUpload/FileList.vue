<!-- FileUpload 私有子部件：已选文件列表（缩略图 + 文件名 / 大小 + 移除按钮），禁止 feature 直接导入 -->
<template>
  <ul class="si-fileupload__list">
    <li
      v-for="(file, index) in files"
      :key="`${file.name}-${file.size}-${file.lastModified}-${index}`"
      class="si-fileupload__file"
    >
      <!-- 左侧标识：图片走预览 URL（占位列宽 = previewWidth），其余用文件类型图标
           （占位列宽 = 图标尺寸，避免图标右侧留出无用空档） -->
      <span
        class="si-fileupload__thumb"
        :class="objectUrls[index] ? 'si-fileupload__thumb--image' : 'si-fileupload__thumb--icon'"
      >
        <img
          v-if="objectUrls[index]"
          :src="objectUrls[index]"
          :alt="file.name"
          class="si-fileupload__thumb-img"
        >
        <IconWrapper
          v-else
          name="fileOutline"
          :size="iconSize"
          class="si-fileupload__thumb-icon"
        />
      </span>

      <!-- 文件信息可替换（官方 filelabel 插槽作用域为整个 files 数组） -->
      <span class="si-fileupload__info">
        <slot
          name="filelabel"
          :files="files"
        >
          <span
            class="si-fileupload__name"
            :title="file.name"
          >{{ file.name }}</span>
          <span class="si-fileupload__size">{{ formatSize(file.size) }}</span>
        </slot>
      </span>

      <!-- 移除：⚠️ 插槽必须用 v-if **条件转发**（编译为 createSlots 的条件条目）——
           恒传插槽出口会让 Button 的 `$slots.default` 恒真、`isIconOnly` 退化为假，
           既不再输出 `si-button--icon-only` 类（尺寸覆写失效），还会多渲染一个空的文本层 -->
      <Button
        variant="ghost"
        :size="size"
        :icon="$slots.fileremoveicon ? undefined : 'close'"
        :aria-label="removeLabel"
        :title="removeLabel"
        class="si-fileupload__remove"
        :disabled="disabled"
        @click="emit('remove', index)"
      >
        <template
          v-if="$slots.fileremoveicon"
          #default
        >
          <slot
            name="fileremoveicon"
            :file="file"
            :index="index"
          />
        </template>
      </Button>
    </li>
  </ul>
</template>

<script setup lang="ts">
// 文件列表子部件：只负责单行渲染与移除派发，队列由父组件 FileUpload 持有
// （拆出理由：父组件模板含拖拽区 / 空态 / 进度 / 操作栏多段，列表段独立后两块都可读）
import type { FileUploadSize } from "./types"
import { formatFileSize } from "@/utils/format"
import Button from "../Button.vue"
import IconWrapper from "../IconWrapper.vue"

interface Props {
  /** 当前队列 */
  files: File[]
  /** 与 `files` 同下标的对象 URL（非图片为 `undefined`） */
  objectUrls: (string | undefined)[]
  /** 缩略图内文件图标的边长（px）——占位框边长由父组件的 `--si-fu-thumb` 变量下发 */
  iconSize: number
  /** 尺寸档位（透传给按钮与图标） */
  size: FileUploadSize
  /** 是否禁用 */
  disabled: boolean
  /** 移除按钮的无障碍名称 */
  removeLabel: string
}

defineProps<Props>()

const emit = defineEmits<{
  /** 请求移除指定下标的文件（父组件负责真正删除并回收 URL） */
  remove: [index: number]
}>()

/** 可读大小：复用全局格式化工具，避免在组件内重复实现（仓库内已有 6 处历史副本，不再新增） */
const formatSize = (bytes: number) => formatFileSize(bytes)
</script>

<style scoped lang="scss">
@use '../styles/FileUpload.scss';
</style>
