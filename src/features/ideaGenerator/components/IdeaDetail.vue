<!-- 灵感详情：完整描述 + 流式技术方案展示 -->
<template>
  <aside class="ig-detail">
    <!-- 详情标题："灵感详情" -->
    <div class="ig-detail-header">
      <span class="ig-detail-title">{{ i18n.detailTitle }}</span>
    </div>

    <template v-if="idea">
      <div class="ig-detail-body">
        <!-- 灵感标题 -->
        <h3 class="ig-detail-idea">{{ idea.title }}</h3>
        <!-- 详细描述 -->
        <p class="ig-detail-desc">{{ idea.description }}</p>

        <div class="ig-detail-section">
          <!-- 分节标题："技术方案" -->
          <span class="ig-detail-section-label">{{ i18n.detailPlan }}</span>
          <div class="ig-detail-plan">
            <!-- 流式技术方案文本 -->
            <pre
              v-if="detailText"
              class="ig-detail-plan-text"
            >{{ detailText }}</pre>
            <!-- 细化中提示 -->
            <p
              v-else-if="refineStatus === 'loading'"
              class="ig-detail-hint"
            >
              {{ i18n.refineLoading }}
            </p>
            <!-- 细化失败提示 -->
            <p
              v-else-if="refineStatus === 'error'"
              class="ig-detail-hint ig-detail-hint--error"
            >
              {{ detailText }}
            </p>
            <!-- 未细化占位提示 -->
            <p
              v-else
              class="ig-detail-hint"
            >
              {{ i18n.detailPlanEmpty }}
            </p>
          </div>
        </div>
      </div>

      <div class="ig-detail-actions">
        <button
          type="button"
          class="ig-detail-btn ig-detail-btn--primary"
          :disabled="isRefining"
          @click="emit('refine')"
        >
          <IconWrapper
            name="sparkles"
            :size="14"
            className="ig-icon"
          />
          <!-- AI 细化 -->
          <span>{{ i18n.refine }}</span>
        </button>
        <button
          v-if="isRefining"
          type="button"
          class="ig-detail-btn"
          @click="emit('cancelRefine')"
        >
          <IconWrapper
            name="stop"
            :size="14"
            className="ig-icon"
          />
          <!-- 停止生成 -->
          <span>{{ i18n.refineCancel }}</span>
        </button>
        <button
          type="button"
          class="ig-detail-btn"
          :disabled="!detailText"
          @click="emit('copyDetail')"
        >
          <IconWrapper
            name="copy"
            :size="14"
            className="ig-icon"
          />
          <!-- 复制方案 -->
          <span>{{ i18n.copyDetail }}</span>
        </button>
      </div>
    </template>

    <!-- 未选中灵感空状态 -->
    <div
      v-else
      class="ig-detail-empty"
    >
      <IconWrapper
        name="lightbulb"
        :size="28"
      />
      <!-- 空状态提示 -->
      <p class="ig-detail-empty-text">{{ i18n.detailPlanEmpty }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  computed,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type {
  IdeaGeneratorI18n,
  IdeaItem,
} from "../types"
import type { RefineStatus } from "../composables/useIdeaGenerator"

interface Props {
  idea: IdeaItem | null
  detailText: string
  refineStatus: RefineStatus
  i18n: IdeaGeneratorI18n
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "refine"): void
  (e: "cancelRefine"): void
  (e: "copyDetail"): void
}>()

const isRefining = computed(() =>
  props.refineStatus === "loading" || props.refineStatus === "streaming",
)
</script>

<style lang="scss">
@use '../styles/IdeaDetail.scss';
@use '../styles/index.scss';
</style>
