<!-- 引导发散主视图：输入主题 → 多轮方向深挖 → 发散灵感（三态切换） -->
<template>
  <div class="gd-panel">
    <!-- 输入态：主题输入 -->
    <div
      v-if="stage === 'input'"
      class="gd-input"
    >
      <div class="gd-input-inner">
        <IconWrapper
          name="lightbulb"
          :size="36"
        />
        <!-- 输入态标题 -->
        <h2 class="gd-input-title">{{ i18n.guideTab }}</h2>
        <!-- 输入态说明 -->
        <p class="gd-input-hint">{{ i18n.guideTopicHint }}</p>
        <input
          v-model="topic"
          class="gd-input-field"
          type="text"
          :placeholder="i18n.guideTopicPlaceholder"
          @keydown.enter="startDiverge"
        >
        <Button
          icon="sparkles"
          :loading="isBusy"
          @click="startDiverge"
        >
          <!-- 开始发散按钮 -->
          {{ i18n.guideStart }}
        </Button>
        <!-- 输入态错误提示 -->
        <p
          v-if="errorMessage"
          class="gd-error"
        >
          {{ errorMessage }}
        </p>
      </div>
    </div>

    <!-- 引导态：方向深挖 -->
    <div
      v-else-if="stage === 'guiding'"
      class="gd-guide"
    >
      <!-- 方向路径面包屑 -->
      <div class="gd-breadcrumb">
        <span class="gd-breadcrumb-topic">{{ topic }}</span>
        <template
          v-for="s in steps"
          :key="s.id"
        >
          <IconWrapper
            name="chevronRight"
            :size="12"
          />
          <span class="gd-breadcrumb-step">{{ s.label }}</span>
        </template>
      </div>
      <!-- 引导提示 -->
      <p class="gd-guide-hint">{{ i18n.guideChooseHint }}</p>

      <!-- 生成方向加载态 -->
      <div
        v-if="isBusy"
        class="gd-loading"
      >
        <IconWrapper
          name="loading"
          :size="16"
          className="ig-icon ig-icon--spin"
        />
        <!-- 生成方向提示 -->
        <span>{{ i18n.guideDirectionsLoading }}</span>
      </div>
      <!-- 方向卡片网格 -->
      <div
        v-else
        class="gd-direction-grid"
      >
        <DirectionCard
          v-for="(d, index) in directions"
          :key="d.id"
          :direction="d"
          :index="index + 1"
          @select="selectDirection"
        />
      </div>

      <!-- 引导态错误提示 -->
      <p
        v-if="errorMessage"
        class="gd-error"
      >
        {{ errorMessage }}
      </p>

      <!-- 操作栏：换一批 / 回退 / 发散灵感 -->
      <div class="gd-actions">
        <Button
          variant="ghost"
          size="small"
          icon="refresh"
          :disabled="isBusy"
          @click="regenerateDirections"
        >
          <!-- 换一批 -->
          {{ i18n.guideRegenerate }}
        </Button>
        <Button
          variant="ghost"
          size="small"
          icon="chevronLeft"
          :disabled="isBusy"
          @click="stepBack"
        >
          <!-- 回退一步 -->
          {{ i18n.guideStepBack }}
        </Button>
        <Button
          variant="primary"
          size="small"
          icon="sparkles"
          :disabled="isBusy || steps.length === 0"
          @click="divergeIdeas"
        >
          <!-- 发散灵感 -->
          {{ i18n.guideDiverge }}
        </Button>
      </div>
    </div>

    <!-- 灵感态：发散结果 -->
    <div
      v-else
      class="gd-ideas"
    >
      <!-- 顶部工具条：路径 + 重新开始 -->
      <div class="gd-ideas-bar">
        <div class="gd-breadcrumb">
          <span class="gd-breadcrumb-topic">{{ topic }}</span>
          <template
            v-for="s in steps"
            :key="s.id"
          >
            <IconWrapper
              name="chevronRight"
              :size="12"
            />
            <span class="gd-breadcrumb-step">{{ s.label }}</span>
          </template>
        </div>
        <Button
          variant="ghost"
          size="small"
          icon="refreshLeft"
          @click="restart"
        >
          <!-- 重新开始 -->
          {{ i18n.guideRestart }}
        </Button>
      </div>

      <!-- 灵感结果主体 -->
      <div class="gd-ideas-body">
        <!-- 左侧灵感列表 -->
        <div class="gd-ideas-list">
          <template v-if="isBusy">
            <div
              v-for="n in 5"
              :key="`sk-${n}`"
              class="ig-skeleton"
            />
          </template>
          <template v-else-if="ideas.length > 0">
            <IdeaCard
              v-for="(idea, index) in ideas"
              :key="idea.id"
              :idea="idea"
              :index="index + 1"
              :expanded="expandedId === idea.id"
              :is-refining="isRefining && expandedId === idea.id"
              :i18n="i18n"
              @toggleExpand="toggleExpand"
              @copy="copyIdea"
              @refine="refineIdea"
            />
          </template>
          <!-- 灵感态空/错误 -->
          <div
            v-else
            class="gd-ideas-empty"
          >
            <IconWrapper
              name="lightbulb"
              :size="32"
            />
            <!-- 空状态 -->
            <p class="gd-ideas-empty-text">{{ errorMessage || i18n.emptyHint }}</p>
          </div>
        </div>

        <!-- 右侧详情区（复用） -->
        <IdeaDetail
          :idea="expandedIdea"
          :detail-text="detailText"
          :refine-status="refineStatus"
          :i18n="i18n"
          @refine="handleRefineCurrent"
          @cancelRefine="cancelRefine"
          @copyDetail="copyDetail"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { IdeaGeneratorI18n } from "../types"
import { useGuideDiverge } from "../composables/useGuideDiverge"
import DirectionCard from "./DirectionCard.vue"
import IdeaCard from "./IdeaCard.vue"
import IdeaDetail from "./IdeaDetail.vue"

interface Props {
  plugin: Plugin
  i18n: IdeaGeneratorI18n
}

const props = defineProps<Props>()

const {
  stage,
  topic,
  directions,
  steps,
  ideas,
  errorMessage,
  isBusy,
  expandedIdea,
  expandedId,
  detailText,
  refineStatus,
  isRefining,
  startDiverge,
  selectDirection,
  regenerateDirections,
  stepBack,
  divergeIdeas,
  restart,
  refineIdea,
  toggleExpand,
  copyIdea,
  cancelRefine,
  copyDetail,
} = useGuideDiverge(props.plugin, props.i18n)

function handleRefineCurrent(): void {
  if (expandedIdea.value) {
    void refineIdea(expandedIdea.value)
  }
}
</script>

<style lang="scss">
@use '../styles/GuideDiverge.scss';
@use '../styles/index.scss';
</style>
