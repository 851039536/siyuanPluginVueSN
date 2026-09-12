<!-- 文件上传：拖拽区 / 点击选择 + 多文件列表 + 校验提示 + 进度，支持 advanced 与 basic 两种模式 -->
<template>
  <div
    class="si-fileupload"
    :class="[
      `si-fileupload--${mode}`,
      `si-fileupload--${size}`,
      { 'si-fileupload--disabled': disabled },
    ]"
    :style="{
      '--si-fu-thumb': `${previewWidth}px`,
      '--si-fu-thumb-icon': `${thumbIconSize}px`,
    }"
  >
    <!-- 隐藏的原生文件输入：所有选择路径最终都走它 -->
    <input
      ref="inputRef"
      class="si-fileupload__input"
      type="file"
      :accept="accept || undefined"
      :multiple="multiple"
      :disabled="disabled"
      :name="name || undefined"
      tabindex="-1"
      aria-hidden="true"
      @change="handleInputChange"
    >

    <!-- 头部内容可整体替换（作用域给文件集合与三个回调） -->
    <slot
      name="header"
      v-bind="headerScope"
    >
      <!-- 选择入口（basic 选择按钮 / advanced 拖拽区由私有子部件承载） -->
      <ChooseArea
        :mode="mode"
        :size="size"
        :disabled="disabled"
        :file-count="fileCount"
        :active="isDragActive"
        :icon-size="dragIconSize"
        :drag-text="dragText"
        :hint-text="hintText"
        :choose-label="chooseLabel"
        @choose="choose"
        @dragenter="handleDragEnter"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <template
          v-if="$slots.chooseicon"
          #chooseicon
        >
          <slot name="chooseicon" />
        </template>
      </ChooseArea>
    </slot>

    <!-- 校验失败提示（按条列出，文案已插值） -->
    <ul
      v-if="errors.length > 0"
      class="si-fileupload__errors"
      role="alert"
    >
      <li
        v-for="(error, index) in errors"
        :key="`${error.reason}-${error.fileName}-${index}`"
        class="si-fileupload__error"
      >
        <IconWrapper
          name="alertCircleOutline"
          :size="size === 'large' ? 16 : 13"
          class="si-fileupload__error-icon"
        />
        <span>{{ error.message }}</span>
      </li>
    </ul>

    <!-- 内容区可整体替换（作用域对齐官方：文件集合 / 进度 / 消息 / 两个移除回调） -->
    <slot
      name="content"
      v-bind="contentScope"
    >
      <!-- 空态（advanced 模式下未选任何文件时） -->
      <div
        v-if="files.length === 0 && mode === 'advanced'"
        class="si-fileupload__empty"
      >
        <slot name="empty">
          {{ emptyText }}
        </slot>
      </div>

      <!-- 文件列表（单行渲染与移除派发由私有子部件承载） -->
      <FileList
        v-else-if="files.length > 0"
        :files="files"
        :object-urls="objectUrls"
        :icon-size="thumbIconSize"
        :size="size"
        :disabled="disabled"
        :remove-label="removeLabel"
        @remove="removeFile"
      >
        <!-- 两个具名插槽原样转发（未传时不建立插槽，让子部件的回退逻辑生效） -->
        <template
          v-if="$slots.filelabel"
          #filelabel="scope"
        >
          <slot
            name="filelabel"
            v-bind="scope"
          />
        </template>
        <template
          v-if="$slots.fileremoveicon"
          #fileremoveicon="scope"
        >
          <slot
            name="fileremoveicon"
            v-bind="scope"
          />
        </template>
      </FileList>
    </slot>

    <!-- 进度条（progress 有值时显示，0 也显示以便「已开始」可见） -->
    <div
      v-if="progress !== undefined"
      class="si-fileupload__progress"
      role="progressbar"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="si-fileupload__progress-bar"
        :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
      />
    </div>

    <!-- 底部操作栏（advanced 模式下有文件才出现；按钮可分别关闭） -->
    <div
      v-if="mode === 'advanced' && files.length > 0 && (showUploadButton || showCancelButton)"
      class="si-fileupload__footer"
    >
      <Button
        v-if="showUploadButton"
        variant="primary"
        :size="size"
        :disabled="disabled || uploading"
        :loading="uploading"
        :icon="$slots.uploadicon ? undefined : 'upload'"
        @click="handleUploadClick"
      >
        <slot name="uploadicon" />
        {{ uploadLabel }}
      </Button>
      <Button
        v-if="showCancelButton"
        variant="ghost"
        :size="size"
        :disabled="disabled || uploading"
        :icon="$slots.cancelicon ? undefined : 'close'"
        @click="clear"
      >
        <slot name="cancelicon" />
        {{ cancelLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  FileUploadMode as FileUploadModeShape,
  FileUploadSize as FileUploadSizeShape,
  FileUploadError,
} from "./fileUpload/types"
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from "vue"
import { formatFileSize } from "@/utils/format"
import Button from "./Button.vue"
import IconWrapper from "./IconWrapper.vue"
import ChooseArea from "./fileUpload/ChooseArea.vue"
import FileList from "./fileUpload/FileList.vue"
import {
  DEFAULT_CANCEL_LABEL,
  DEFAULT_CHOOSE_LABEL,
  DEFAULT_EMPTY_TEXT,
  DEFAULT_INVALID_LIMIT_MESSAGE,
  DEFAULT_INVALID_SIZE_MESSAGE,
  DEFAULT_INVALID_TYPE_MESSAGE,
  DEFAULT_UPLOAD_LABEL,
} from "./fileUpload/types"
import {
  filterAcceptedFiles,
  validateFiles,
} from "./fileUpload/validate"
import "./kit/theme"

// 公开类型转出（沿用 Dialog / Drawer / Tooltip 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type FileUploadMode = FileUploadModeShape
export type FileUploadSize = FileUploadSizeShape

interface Props {
  /**
   * `accept` 规则串，如 `image/*` / `.pdf,.docx` / `image/png`。
   * 三种形态可混用，逗号分隔。
   */
  accept?: string
  /** 展示模式：`advanced`（默认，拖拽区 + 列表 + 操作）/ `basic`（仅选择按钮） */
  mode?: FileUploadMode
  /** 是否允许一次选择多个文件（拖拽多文件始终可用，此项只约束选择对话框） */
  multiple?: boolean
  /** 是否禁用（禁用后不响应选择 / 拖拽 / 移除 / 上传） */
  disabled?: boolean
  /** 单文件大小上限（字节），超出则报错并拒绝加入 */
  maxFileSize?: number
  /** 文件数量上限，超出部分报错并拒绝加入 */
  fileLimit?: number
  /** 表单字段名（透传给原生 input 的 `name`） */
  name?: string
  /**
   * 缩略图边长（px，默认 24）。
   * ⚠️ 官方默认 50（偏大，每行接近 60px 高、列表很快触顶）；本项目收紧到 24，
   *    使默认档位下图标的文件行保持单行紧凑（整行高度由缩略图决定）。
   */
  previewWidth?: number
  /** 尺寸档位：驱动字号 10/12/14/16 与各段内边距 */
  size?: FileUploadSize
  /** 是否显示上传按钮 */
  showUploadButton?: boolean
  /** 是否显示取消（清空）按钮 */
  showCancelButton?: boolean
  /** 上传中（由调用方置位；置位时上传 / 取消按钮禁用并显示加载态） */
  uploading?: boolean
  /**
   * 进度百分比（0-100）。传入即渲染进度条；不传则整条不出现。
   * 组件自身**不做网络请求**，进度由调用方按自身上传通道回报。
   */
  progress?: number
  /** 选择按钮文案 */
  chooseLabel?: string
  /** 上传按钮文案 */
  uploadLabel?: string
  /** 取消（清空）按钮文案 */
  cancelLabel?: string
  /** 移除按钮的无障碍名称 */
  removeLabel?: string
  /** 拖拽区主文案 */
  dragText?: string
  /** 拖拽区补充提示（如大小 / 类型限制），不传则不渲染 */
  hintText?: string
  /** 空态文案 */
  emptyText?: string
  /** 大小超限文案模板（`{0}` 文件名、`{1}` 上限） */
  invalidFileSizeMessage?: string
  /** 类型不符文案模板（`{0}` 文件名） */
  invalidFileTypeMessage?: string
  /** 数量超限文案模板（`{0}` 上限） */
  invalidFileLimitMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  accept: "",
  mode: "advanced",
  multiple: false,
  disabled: false,
  maxFileSize: undefined,
  fileLimit: undefined,
  name: "",
  previewWidth: 24,
  size: "small",
  showUploadButton: true,
  showCancelButton: true,
  uploading: false,
  progress: undefined,
  chooseLabel: DEFAULT_CHOOSE_LABEL,
  uploadLabel: DEFAULT_UPLOAD_LABEL,
  cancelLabel: DEFAULT_CANCEL_LABEL,
  removeLabel: "移除",
  dragText: DEFAULT_EMPTY_TEXT,
  hintText: "",
  emptyText: "尚未选择任何文件",
  invalidFileSizeMessage: DEFAULT_INVALID_SIZE_MESSAGE,
  invalidFileTypeMessage: DEFAULT_INVALID_TYPE_MESSAGE,
  invalidFileLimitMessage: DEFAULT_INVALID_LIMIT_MESSAGE,
})

const emit = defineEmits<{
  /** 文件被加入列表（仅通过校验的） */
  select: [files: File[], originalEvent: Event | null]
  /** 单个文件被移除 */
  remove: [file: File, files: File[]]
  /** 队列被清空（取消按钮 / `clear()`） */
  clear: []
  /** 点击上传按钮（组件不做网络请求，由调用方接管） */
  upload: [files: File[]]
  /** 校验失败（载荷为全部失败项，含可读文案） */
  invalid: [errors: FileUploadError[]]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
/** 当前待上传 / 已选文件队列（**非受控**：组件自持，经事件对外通报） */
const files = ref<File[]>([])
/** 最近一次校验失败项（再次成功选择时清空） */
const errors = ref<FileUploadError[]>([])
const isDragActive = ref(false)

/**
 * 图片缩略图的对象 URL 缓存：按 files 索引持有。
 * ⚠️ 必须显式 revoke —— 否则每选一批图就泄漏一批 blob URL（长会话下内存持续增长）。
 */
const objectUrls = ref<(string | undefined)[]>([])
let liveUrls: string[] = []

const revokeUrls = () => {
  liveUrls.forEach((url) => URL.revokeObjectURL(url))
  liveUrls = []
  objectUrls.value = []
}

/** 仅图片才生成预览（非图片用图标占位，避免为任意文件创建 blob URL） */
const isImage = (file: File) => (file.type || "").startsWith("image/")

const syncObjectUrls = () => {
  revokeUrls()
  objectUrls.value = files.value.map((file) => {
    if (!isImage(file)) return undefined
    const url = URL.createObjectURL(file)
    liveUrls.push(url)
    return url
  })
}

// 文件队列变化即重建缩略图 URL（旧的先回收）
watch(files, syncObjectUrls)

const fileCount = computed(() => files.value.length)
const dragIconSize = computed(() => (props.size === "large" ? 40 : 32))
/**
 * 非图片文件的文件类型图标边长。
 * ⚠️ **刻意与 `previewWidth` 解耦**：`previewWidth` 是「图片缩略图的展示尺寸」，
 *    图标是纯文字性的行内标识，应与**行文字**同阶（略大于字号即可），
 *    否则默认档位下会出现「18px 图标配 12px 文件名」的头重脚轻观感。
 *    按档位字号（10/12/14/16）取 +2px。
 */
const TIER_ICON_SIZE: Record<FileUploadSize, number> = {
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
}

const thumbIconSize = computed(() => TIER_ICON_SIZE[props.size])
const formatSize = (bytes: number) => formatFileSize(bytes)

/** 打开原生文件选择对话框 */
const choose = () => {
  if (props.disabled) return
  inputRef.value?.click()
}

/** 原生 input 变化：走与拖拽完全相同的校验入库路径 */
const handleInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const selected = target.files ? Array.from(target.files) : []
  addFiles(selected, event)
  // 重置 value：否则再次选择同一文件不会触发 change
  target.value = ""
}

/**
 * 校验并加入文件（选择与拖拽的唯一入库口）。
 * ⚠️ 数量上限按「已有 + 本次」累计判断，且只拒绝溢出的那部分。
 */
const addFiles = (incoming: File[], originalEvent: Event | null) => {
  if (props.disabled || incoming.length === 0) return

  const found = validateFiles(incoming, {
    accept: props.accept,
    maxFileSize: props.maxFileSize,
    currentCount: files.value.length,
    incomingCount: incoming.length,
    fileLimit: props.fileLimit,
    formatSize,
    messages: {
      invalidFileSizeMessage: props.invalidFileSizeMessage,
      invalidFileTypeMessage: props.invalidFileTypeMessage,
      invalidFileLimitMessage: props.invalidFileLimitMessage,
    },
  })

  const accepted = filterAcceptedFiles(incoming, found)
  errors.value = found
  if (found.length > 0) emit("invalid", found)

  if (accepted.length === 0) return
  files.value = props.multiple || files.value.length === 0
    ? [...files.value, ...accepted]
    // 单选模式：新文件替换旧文件（与原生 input 的单选语义一致）
    : [accepted[accepted.length - 1]]
  emit("select", accepted, originalEvent)
}

/** 拖拽进入 / 悬停：进入即激活；`dragover` 也必须 preventDefault，否则 drop 不触发 */
const handleDragEnter = () => {
  if (props.disabled) return
  isDragActive.value = true
}

const handleDragOver = () => {
  if (props.disabled) return
  isDragActive.value = true
}

/**
 * 拖拽离开：靠 `relatedTarget` 判断是否真的离开了拖拽区。
 * ⚠️ 子元素间移动也会冒泡出 dragleave，只看事件本身会导致高亮反复闪烁。
 */
const handleDragLeave = (event: DragEvent) => {
  const zone = event.currentTarget as HTMLElement | null
  const to = event.relatedTarget as Node | null
  if (zone && to && zone.contains(to)) return
  isDragActive.value = false
}

const handleDrop = (event: DragEvent) => {
  isDragActive.value = false
  if (props.disabled) return
  const dropped = event.dataTransfer?.files
  if (!dropped || dropped.length === 0) return
  addFiles(Array.from(dropped), event)
}

/** 移除单个文件 */
const removeFile = (index: number) => {
  if (props.disabled) return
  const removed = files.value[index]
  if (!removed) return
  files.value = files.value.filter((_, i) => i !== index)
  // 该文件若在错误列表里，一并清掉其相关提示
  errors.value = errors.value.filter((error) => error.fileName !== removed.name)
  emit("remove", removed, files.value)
}

/**
 * 清空队列与提示。
 * ⚠️ 暴露为公开方法（对齐官方 `clear()`），也供取消按钮调用。
 */
const clear = () => {
  if (props.disabled) return
  files.value = []
  errors.value = []
  isDragActive.value = false
  if (inputRef.value) inputRef.value.value = ""
  emit("clear")
}

/** 上传：仅派发事件，组件不做网络请求（由调用方按自身通道实现并回报 progress） */
const handleUploadClick = () => {
  if (props.disabled || props.uploading) return
  if (files.value.length === 0) return
  emit("upload", files.value)
}

/** `header` 插槽作用域（对齐官方：文件集合与三个回调） */
const headerScope = computed(() => ({
  files: files.value,
  uploadedFiles: [] as File[],
  chooseCallback: choose,
  uploadCallback: handleUploadClick,
  clearCallback: clear,
}))

/** `content` 插槽作用域（对齐官方：文件集合 / 进度 / 消息 / 两个移除回调） */
const contentScope = computed(() => ({
  files: files.value,
  uploadedFiles: [] as File[],
  progress: props.progress ?? 0,
  messages: errors.value.length > 0 ? errors.value.map((error) => error.message) : null,
  removeFileCallback: removeFile,
  removeUploadedFileCallback: (_index: number) => {
    // 本项目不做上传后文件区（uploadedFiles 恒空），保留回调以对齐官方作用域形状
  },
}))

// 卸载兜底：回收全部 blob URL
onBeforeUnmount(revokeUrls)

defineExpose({
  /** 打开原生文件选择对话框 */
  choose,
  /** 清空已选文件与提示 */
  clear,
  /** 触发上传事件（组件不做网络请求） */
  upload: handleUploadClick,
})
</script>

<style scoped lang="scss">
@use './styles/FileUpload.scss';
</style>
