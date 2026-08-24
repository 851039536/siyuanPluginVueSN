<!-- 灵感生成器主面板：分类操作区 + 状态条 + 灵感卡片列表 + 详情/细化区 -->
<template>
  <div class="ig-panel">
    <!-- 顶部操作区 -->
    <div class="ig-toolbar">
      <CategorySelector
        :categories="IDEA_CATEGORIES"
        :selected-id="selectedCategoryId"
        :i18n="i18n"
        @select="handleSelectCategory"
      />
      <div class="ig-toolbar-right">
        <input
          v-model="keyword"
          class="ig-toolbar-input"
          type="text"
          :placeholder="i18n.keywordPlaceholder"
          @keydown.enter="generateIdeas"
        >
        <Button
          icon="sparkles"
          :loading="isGenerating"
          @click="generateIdeas"
        >
          <!-- 生成灵感按钮 -->
          {{ isGenerating ? i18n.generating : i18n.generate }}
        </Button>
      </div>
    </div>

    <!-- 状态条 -->
    <div class="ig-statusbar">
      <template v-if="status === 'generating'">
        <IconWrapper
          name="loading"
          :size="12"
          className="ig-icon ig-icon--spin"
        />
        <!-- 生成中提示 -->
        <span>{{ i18n.generating }}</span>
      </template>
      <template v-else-if="status === 'done'">
        <IconWrapper
          name="checkCircle"
          :size="12"
        />
        <!-- 生成完成提示 -->
        <span>{{ statusDoneText }}</span>
      </template>
      <template v-else-if="status === 'error'">
        <IconWrapper
          name="alertCircle"
          :size="12"
        />
        <!-- 生成失败提示 -->
        <span>{{ errorMessage }}</span>
      </template>
      <template v-else>
        <!-- 就绪提示 -->
        <span>{{ i18n.emptyHint }}</span>
      </template>
    </div>

    <!-- 主区域 -->
    <div class="ig-body">
      <!-- 左侧灵感列表 -->
      <div class="ig-list">
        <!-- 生成中骨架占位 -->
        <template v-if="isGenerating">
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
        <!-- 空状态 -->
        <div
          v-else
          class="ig-list-empty"
        >
          <IconWrapper
            name="lightbulb"
            :size="32"
          />
          <!-- 空状态标题 -->
          <p class="ig-list-empty-title">{{ i18n.empty }}</p>
          <!-- 空状态副标题 -->
          <p class="ig-list-empty-hint">{{ i18n.emptyHint }}</p>
        </div>
      </div>

      <!-- 右侧详情区 -->
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
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {
  computed,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CategorySelector from "./components/CategorySelector.vue"
import IdeaCard from "./components/IdeaCard.vue"
import IdeaDetail from "./components/IdeaDetail.vue"
import { useIdeaGenerator } from "./composables/useIdeaGenerator"
import {
  IDEA_CATEGORIES,
} from "./types"
import type { IdeaGeneratorI18n } from "./types"

interface Props {
  plugin: Plugin
  i18n: IdeaGeneratorI18n
}

const props = defineProps<Props>()

const {
  selectedCategoryId,
  keyword,
  ideas,
  status,
  errorMessage,
  expandedId,
  detailText,
  refineStatus,
  expandedIdea,
  isGenerating,
  isRefining,
  generateIdeas,
  toggleExpand,
  copyIdea,
  refineIdea,
  cancelRefine,
  copyDetail,
} = useIdeaGenerator(props.plugin, props.i18n)

/** 生成完成提示（替换 {count} 占位符） */
const statusDoneText = computed(() =>
  (props.i18n.statusDone || "").replace("{count}", String(ideas.value.length)),
)

function handleSelectCategory(id: string): void {
  selectedCategoryId.value = id
}

function handleRefineCurrent(): void {
  if (expandedIdea.value) {
    void refineIdea(expandedIdea.value)
  }
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
