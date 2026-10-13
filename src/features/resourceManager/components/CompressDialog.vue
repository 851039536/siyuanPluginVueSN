<!-- 图片压缩参数弹窗：质量 / 最大体积 / 最大宽高 / Web Worker 四档参数 + 选中数量与预计耗时预览 -->
<template>
  <Teleport to="body">
    <Transition name="rm-move-fade">
      <!-- 遮罩点击取消 -->
      <div
        class="rm-move-mask"
        @click.self="emit('cancel')"
      >
        <div class="rm-move-dialog rm-compress-dialog">
          <!-- 弹窗头部 -->
          <div class="rm-move-dialog__header">
            <!-- 标题："图片压缩" -->
            <span class="rm-move-dialog__title">{{ i18n.compressDialogTitle }}</span>
            <!-- 按钮："关闭" -->
            <button
              class="rm-move-dialog__icon"
              :title="i18n.cancel"
              @click="emit('cancel')"
            >
              <IconWrapper
                name="close"
                :size="14"
              />
            </button>
          </div>

          <!-- 弹窗内容：四档压缩参数（Slider 的 model-value 可为 null，统一经 setOption 过滤） -->
          <div class="rm-move-dialog__body">
            <Slider
              :label="i18n.compressQuality"
              :model-value="options.quality"
              :min="0.1"
              :max="1"
              :step="0.1"
              :show-value="true"
              :format-value="formatQuality"
              :hint="i18n.compressQualityHint"
              size="small"
              @update:model-value="(v) => setOption('quality', v)"
            />
            <Slider
              :label="i18n.compressMaxSize"
              :model-value="options.maxSizeMB"
              :min="0.1"
              :max="10"
              :step="0.1"
              :show-value="true"
              :format-value="formatMaxSize"
              :hint="i18n.compressMaxSizeHint"
              size="small"
              @update:model-value="(v) => setOption('maxSizeMB', v)"
            />
            <Slider
              :label="i18n.compressMaxDimension"
              :model-value="options.maxWidthOrHeight"
              :min="500"
              :max="4000"
              :step="100"
              :show-value="true"
              :format-value="formatMaxDimension"
              :hint="i18n.compressMaxDimensionHint"
              size="small"
              @update:model-value="(v) => setOption('maxWidthOrHeight', v)"
            />
            <Switch
              v-model="options.useWebWorker"
              :label="i18n.compressWebWorker"
              size="small"
            />
            <!-- 后台线程说明 -->
            <div class="rm-compress-dialog__hint">
              {{ i18n.compressWebWorkerHint }}
            </div>

            <!-- 选中数量与预计耗时 -->
            <div class="rm-compress-dialog__stats">
              <div class="rm-compress-dialog__stat-row">
                <span>{{ i18n.selectedCount }}</span>
                <span class="rm-compress-dialog__stat-value">{{ selectedCount }}</span>
              </div>
              <div class="rm-compress-dialog__stat-row">
                <span>{{ i18n.compressEstimatedTime }}</span>
                <span class="rm-compress-dialog__stat-value">{{ estimatedTime }}</span>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="rm-move-dialog__footer">
            <!-- 按钮："取消" -->
            <button
              class="rm-move-btn"
              @click="emit('cancel')"
            >
              {{ i18n.cancel }}
            </button>
            <!-- 按钮："压缩" -->
            <button
              class="rm-move-btn primary"
              @click="emit('confirm', options)"
            >
              {{ i18n.compress }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  CompressOptions,
  ResourceManagerI18n,
} from "../types"
import {
  computed,
  reactive,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Slider from "@/components/Slider.vue"
import Switch from "@/components/Switch.vue"
import { DEFAULT_COMPRESS_OPTIONS } from "../services/compressor"

interface Props {
  i18n: ResourceManagerI18n
  /** 待压缩图片数量（用于预计耗时估算） */
  selectedCount: number
}

interface Emits {
  (e: "confirm", options: CompressOptions): void
  (e: "cancel"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const options = reactive<CompressOptions>({ ...DEFAULT_COMPRESS_OPTIONS })

/**
 * 写入单个数值参数。
 * `Slider` 的 `update:model-value` 载荷可为 `null`（组件允许清空），
 * 压缩参数不接受 null，故统一在此过滤，避免三处模板重复内联判空。
 */
function setOption(key: "quality" | "maxSizeMB" | "maxWidthOrHeight", value: number | null) {
  if (value === null) return
  options[key] = value
}

/** 估算耗时：按每张约 1.5 秒折算，超 60 秒改用分钟 */
const estimatedTime = computed(() => {
  const s = props.i18n.compressUnitSecond
  const m = props.i18n.compressUnitMinute
  if (props.selectedCount === 0) return `0${s}`
  const seconds = props.selectedCount * 1.5
  if (seconds < 60) return `~${Math.ceil(seconds)}${s}`
  return `~${Math.ceil(seconds / 60)}${m}`
})

const formatQuality = (value: number): string => `${(value * 100).toFixed(0)}%`
const formatMaxSize = (value: number): string => `${value} MB`
const formatMaxDimension = (value: number): string => `${value} px`
</script>

<style scoped lang="scss">
@use "../styles/MoveAssetDialog.scss";
@use "../styles/CompressDialog.scss";
</style>
