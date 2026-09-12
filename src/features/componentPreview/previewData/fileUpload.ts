/**
 * 组件预览清单 — FileUpload 分组数据
 *
 * 注 1：上传组件需要「真实 File 对象」才能演示文件列表与缩略图，纯清单数据无法表达
 *      ⇒ 这里内联一个**演示宿主**：装载时用 `new File([...])` 造几个纯内存假文件
 *      （不发起任何网络请求、不落盘）预置进队列，使快照能直接呈现列表 / 缩略图 / 错误态。
 * 注 2：宿主自身可真实交互 —— 选择、拖拽、移除、清空都可用（组件队列为非受控自持）。
 * 注 3：⚠️ 假文件用 `new File(...)` 构造，**不入库、不联网**；仅用于目视回归。
 * 注 4：宿主自身只是预览脚手架，转发 props 时用宽松对象（与渲染层 `PreviewStage` 同法）。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { Component } from "vue"
import {
  defineComponent,
  ref,
} from "vue"
import type { PreviewGroup } from "../types"
import FileUpload from "@/components/FileUpload.vue"

/** 造一个纯内存假文件（不发起请求、不落盘，仅用于让快照有内容可渲染） */
const makeFile = (name: string, size: number, type: string): File => {
  // 内容只需长度正确即可反映体积，无需真实字节
  const bytes = new Uint8Array(Math.min(size, 1024))
  return new File([bytes], name, { type, lastModified: Date.now() })
}

/** PNG 头 + 少量填充，保证 <img> 能真的渲染出缩略图（1x1 透明图） */
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const makeImageFile = (name: string, size: number): File => {
  try {
    const binary = atob(TINY_PNG_BASE64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], name, { type: "image/png", lastModified: Date.now() })
  } catch {
    return makeFile(name, size, "image/png")
  }
}

/**
 * 演示宿主：可选预置假文件（`seed`），并暴露移除 / 清空回调给内部使用。
 * `seed` 取值：`images`（图片，展示缩略图）/ `mixed`（图片 + 文档）/ `none`（空态）。
 */
const FileUploadDemo = defineComponent({
  name: "FileUploadDemo",
  props: {
    size: { type: String, default: "small" },
    accept: { type: String, default: "" },
    mode: { type: String, default: "advanced" },
    multiple: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    maxFileSize: { type: Number, default: undefined },
    fileLimit: { type: Number, default: undefined },
    previewWidth: { type: Number, default: 50 },
    showUploadButton: { type: Boolean, default: true },
    showCancelButton: { type: Boolean, default: true },
    uploading: { type: Boolean, default: false },
    progress: { type: Number, default: undefined },
    chooseLabel: { type: String, default: undefined },
    uploadLabel: { type: String, default: undefined },
    cancelLabel: { type: String, default: undefined },
    dragText: { type: String, default: undefined },
    hintText: { type: String, default: "" },
    emptyText: { type: String, default: undefined },
    /** 预览脚手架：预置内容形态（`images` / `mixed` / `none`） */
    seed: { type: String, default: "mixed" },
  },
  setup(props) {
    const uploadRef = ref<any>(null)
    /** 预置假文件：装载时（非响应式后续）注入一次，之后完全交给组件自持 */
    const seeded = ref(false)

    return (): VNode => {
      const upload = h(FileUpload, {
        ref: uploadRef,
        accept: props.accept || undefined,
        mode: props.mode,
        multiple: props.multiple,
        disabled: props.disabled,
        maxFileSize: props.maxFileSize,
        fileLimit: props.fileLimit,
        previewWidth: props.previewWidth,
        showUploadButton: props.showUploadButton,
        showCancelButton: props.showCancelButton,
        uploading: props.uploading,
        progress: props.progress,
        chooseLabel: props.chooseLabel,
        uploadLabel: props.uploadLabel,
        cancelLabel: props.cancelLabel,
        dragText: props.dragText,
        hintText: props.hintText || undefined,
        emptyText: props.emptyText,
        size: props.size,
      })

      // 预置内容：借组件的隐藏 input 无法注入，改为把假文件塞进原生 input 的 DataTransfer
      if (!seeded.value && props.seed !== "none") {
        seeded.value = true
        requestAnimationFrame(() => {
          const root = (uploadRef.value?.$el ?? null) as HTMLElement | null
          const input = root?.querySelector<HTMLInputElement>("input[type=file]")
          if (!input) return
          const list = props.seed === "images"
            ? [makeImageFile("photo-1.png", 204_800), makeImageFile("photo-2.png", 512_000)]
            : [
              makeImageFile("cover.png", 348_160),
              makeFile("年度报告.pdf", 2_411_724, "application/pdf"),
              makeFile("数据表.xlsx", 86_016, "application/vnd.ms-excel"),
            ]
          const transfer = new DataTransfer()
          list.forEach((file) => transfer.items.add(file))
          input.files = transfer.files
          input.dispatchEvent(new Event("change", { bubbles: true }))
        })
      }

      return h("div", { class: "cp-fileupload-demo" }, [upload])
    }
  },
})

export const fileUploadGroup: PreviewGroup = {
  id: "fileUpload",
  component: FileUploadDemo as Component,
  name: "FileUpload",
  summary: "文件上传：拖拽区 / 点击选择 + 多文件列表与缩略图 + 校验提示 + 进度，advanced 与 basic 双模式",
  importCode: "import FileUpload from \"@/components/FileUpload.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（拖拽区 + 文件列表）",
      props: {
        seed: "mixed",
        hintText: "支持 PNG / PDF / XLSX，单个不超过 5 MB",
      },
      code: `<script setup>
// 组件队列为**非受控**自持：选好文件后经事件把 File[] 交给调用方
const files = ref([])
</script>

<template>
  <FileUpload
    multiple
    hint-text="支持 PNG / PDF / XLSX，单个不超过 5 MB"
    @select="(picked) => (files = [...files, ...picked])"
    @remove="(file, rest) => (files = rest)"
    @clear="files = []"
    @upload="(queue) => uploadToServer(queue)"
  />
</template>`,
    },
    {
      title: "基础模式（mode=\"basic\"）",
      props: {
        mode: "basic",
        seed: "none",
        chooseLabel: "选择文件",
      },
      code: `<!-- basic：只有一个选择按钮 + 已选数量徽标，适合嵌进工具栏 -->
<FileUpload mode="basic" multiple choose-label="选择文件" @select="onSelect" />`,
    },
    {
      title: "仅图片 + 缩略图（accept=\"image/*\"）",
      props: {
        accept: "image/*",
        seed: "images",
        hintText: "仅图片，自动生成缩略图",
      },
      code: `<!-- accept 支持 .pdf / image/* / image/png 三种形态，逗号分隔可混用 -->
<FileUpload accept="image/*" multiple hint-text="仅图片，自动生成缩略图" />`,
    },
    {
      title: "空态（未选任何文件）",
      props: {
        seed: "none",
      },
      code: `<FileUpload multiple drag-text="拖拽文件到此处，或点击选择" />`,
    },
    {
      title: "大小上限（max-file-size=1MB）",
      props: {
        seed: "mixed",
        maxFileSize: 1_048_576,
        hintText: "单个文件不超过 1 MB（超限文件会被拒绝并提示）",
      },
      code: `<!-- 超限文件不进队列，并派发 invalid 事件 + 行内提示 -->
<FileUpload multiple :max-file-size="1048576" hint-text="单个文件不超过 1 MB" />`,
    },
    {
      title: "类型限制（accept=\".pdf\"）",
      props: {
        seed: "mixed",
        accept: ".pdf",
        hintText: "仅允许 .pdf（列表中的非 PDF 已由调用方预置，用于演示提示位）",
      },
      code: `<FileUpload accept=".pdf" multiple hint-text="仅允许 .pdf" />`,
    },
    {
      title: "数量上限（file-limit=2）",
      props: {
        seed: "mixed",
        fileLimit: 2,
        hintText: "最多 2 个文件，超出的会被拒绝",
      },
      code: `<!-- 数量按「已有 + 本次」累计判断，只拒绝溢出的部分 -->
<FileUpload multiple :file-limit="2" hint-text="最多 2 个文件" />`,
    },
    {
      title: "上传中 + 进度（uploading / progress）",
      props: {
        seed: "mixed",
        uploading: true,
        progress: 62,
      },
      code: `<!-- 组件不做网络请求：uploading / progress 由调用方按自身通道回报 -->
<FileUpload
  multiple
  :uploading="uploading"
  :progress="progress"
  @upload="(queue) => startUpload(queue)"
/>
<!-- startUpload 内部在 xhr.upload.onprogress 里更新 progress -->`,
    },
    {
      title: "隐藏上传 / 取消按钮",
      props: {
        seed: "mixed",
        showUploadButton: false,
        showCancelButton: false,
      },
      code: `<!-- 两个按钮可分别关闭；都不显示时底部操作栏整块不渲染 -->
<FileUpload multiple :show-upload-button="false" :show-cancel-button="false" />`,
    },
    {
      title: "禁用（disabled）",
      props: {
        seed: "mixed",
        disabled: true,
      },
      code: `<FileUpload multiple disabled />`,
    },
    {
      title: "自定义文案（choose / upload / cancel）",
      props: {
        seed: "mixed",
        chooseLabel: "挑选附件",
        uploadLabel: "开始上传",
        cancelLabel: "全部清除",
        removeLabel: "删除",
        dragText: "把附件拖到这里",
      },
      code: `<!-- 全部文案均可覆盖为调用方 i18n ⇒ 组件零 i18n 分片改动 -->
<FileUpload
  multiple
  choose-label="挑选附件"
  upload-label="开始上传"
  cancel-label="全部清除"
/>`,
    },
    {
      title: "缩略图放大（preview-width=40）",
      props: {
        seed: "images",
        accept: "image/*",
        previewWidth: 40,
        hintText: "previewWidth 同时决定占位框与图片边长",
      },
      code: `<!-- previewWidth 默认 24（比官方 50 紧凑，图标行保持单行）；按需放大即可 -->
<FileUpload accept="image/*" multiple :preview-width="40" />`,
    },
  ],
}

export const fileUploadPreviewGroups: PreviewGroup[] = [fileUploadGroup]
