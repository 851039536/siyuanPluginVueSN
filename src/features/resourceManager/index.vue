<!-- 资源管理 Dock 面板：资源浏览/分类/移动、丢失与未使用资源检测、重建索引 -->
<template>
  <div class="resource-manager-panel">
    <!-- 头部标题栏 -->
    <div class="rm-header">
      <!-- 面板标题："资源管理" -->
      <span class="rm-header__title">{{ i18n.panelTitle }}</span>
      <div class="rm-header__actions">
        <button
          class="rm-btn"
          @click="refresh"
        >
          <IconWrapper
            name="refresh"
            :size="14"
          />
          <!-- 按钮："刷新" -->
          {{ i18n.refresh }}
        </button>
      </div>
    </div>

    <!-- 页签栏 -->
    <div class="rm-tabs">
      <!-- 页签标签："图片资源 / 文件资源 / 丢失资源 / 未使用资源 / 重建索引" -->
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="rm-tabs__item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </div>
    </div>

    <div class="rm-content">
      <!-- 图片资源 / 文件资源（共用 UI） -->
      <div
        v-if="activeTab === 'imageAssets' || activeTab === 'fileAssets'"
        class="rm-section"
      >
        <!-- 加载数量输入行 -->
        <div class="rm-filter-bar rm-filter-bar--limit">
          <!-- 标签："加载数量" -->
          <span class="rm-filter-bar__label">{{ i18n.loadLimit }}:</span>
          <input
            v-model.number="loadLimit"
            type="number"
            min="1"
            max="10000"
            class="rm-limit-input"
          />
        </div>
        <!-- 分类筛选栏（自包含子组件：chip 切换 + 「分类设置」入口） -->
        <CategoryFilterBar
          :i18n="i18n"
          :categories="quickCategories"
          :active-key="categoryFilter"
          @select="categoryFilter = $event"
          @manage="settingsOpen = true"
        />
        <!-- 资源统计 -->
        <div
          v-if="!loading && totalAssetCount > 0"
          class="rm-asset-count"
        >
          <!-- 统计文案："资源数量: 已显示 / 总数" -->
          {{ i18n.assetCount }}: {{ currentAssetList.length }} / {{ totalAssetCount }}
        </div>
        <!-- 加载中提示："加载中..." -->
        <EmptyState
          v-if="loading"
          icon="refresh"
          :text="i18n.loading"
          spin
        />
        <!-- 空状态："暂无资源" -->
        <EmptyState
          v-else-if="currentAssetList.length === 0"
          icon="inbox"
          :text="i18n.noAssets"
        />
        <!-- 资源卡片网格（图库式）：媒体区缩略图/占位 + 名称，操作 hover 显现 -->
        <AssetGridList
          v-else
          :i18n="i18n"
          :items="currentAssetList"
          :image-tab="activeTab === 'imageAssets'"
          :build-src="buildAssetSrc"
          :on-copy-path="copyPathToClipboard"
          :on-copy-md-ref="copyMarkdownRef"
          :on-open-folder="openAssetInExplorer"
          :on-locate="handleLocateAsset"
          :on-move="handleStartMove"
          :on-preview="openAssetPreview"
        />
        <!-- 移动表单卡（区块级，点击卡片「移动」后展开并自动滚入视口） -->
        <div
          v-if="movingAsset"
          ref="moveFormRef"
          class="rm-move-form"
        >
          <div class="rm-move-form__row">
            <!-- 标签："当前路径" -->
            <span class="rm-move-form__label">{{ i18n.currentPath }}:</span>
            <span class="rm-move-form__path">{{ activeMovePath }}</span>
          </div>
          <div class="rm-move-form__row">
            <!-- 标签："新路径" -->
            <span class="rm-move-form__label">{{ i18n.newPath }}:</span>
            <!-- 输入框占位："输入新路径，如 assets/分类/xxx.png" -->
            <input
              v-model="moveNewPath"
              class="rm-move-form__input"
              :placeholder="i18n.movePathPlaceholder"
              @keyup.enter="handleMoveAsset(activeMovePath)"
            />
          </div>
          <div class="rm-move-form__row">
            <!-- 标签："快速分类" -->
            <span class="rm-move-form__label">{{ i18n.category }}:</span>
            <div class="rm-move-form__categories">
              <!-- 分类快捷 chips 一排："图片 / NET / tool / 其他" 及自定义分类 -->
              <div class="rm-move-form__chips">
                <button
                  v-for="cat in quickCategories"
                  :key="cat.key"
                  class="rm-btn small"
                  @click="applyCategory(activeMovePath, cat.key)"
                >
                  {{ cat.label }}
                </button>
              </div>
              <!-- 自定义分类输入行（独立第二行，避免与 chips 混排换行悬尾） -->
              <div class="rm-move-form__custom">
                <!-- 输入框占位："自定义" -->
                <input
                  v-model="customCategory"
                  class="rm-move-form__category-input"
                  :placeholder="i18n.customCategoryPlaceholder"
                  @keyup.enter="applyCustomCategory(activeMovePath)"
                />
                <!-- 按钮："应用" -->
                <button
                  class="rm-btn small"
                  :disabled="!customCategory"
                  @click="applyCustomCategory(activeMovePath)"
                >
                  {{ i18n.apply }}
                </button>
              </div>
            </div>
          </div>
          <!-- 移动表单操作栏 -->
          <div class="rm-move-form__actions">
            <!-- 按钮："确认移动" -->
            <button
              class="rm-btn small primary"
              :disabled="!moveNewPath"
              @click="handleMoveAsset(activeMovePath)"
            >
              {{ i18n.confirmMove }}
            </button>
            <!-- 按钮："取消" -->
            <button
              class="rm-btn small"
              @click="cancelMove"
            >
              {{ i18n.cancel }}
            </button>
          </div>
        </div>
      </div>

      <!-- 当前文档资源（自包含组件，自行加载活动文档的资源列表） -->
      <DocAssetsSection
        v-if="activeTab === 'docAssets'"
        :i18n="i18n"
        :on-locate="handleLocateAsset"
        :on-copy-path="copyPathToClipboard"
        :on-copy-md-ref="copyMarkdownRef"
      />

      <!-- 丢失资源 -->
      <div
        v-if="activeTab === 'missingAssets'"
        class="rm-section"
      >
        <!-- 加载中提示："加载中..." -->
        <EmptyState
          v-if="loading"
          icon="refresh"
          :text="i18n.loading"
          spin
        />
        <!-- 空状态："无丢失资源" -->
        <EmptyState
          v-else-if="missingAssets.length === 0"
          icon="linkOff"
          :text="i18n.noMissingAssets"
        />
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="path in missingAssets"
            :key="path"
            class="rm-asset-item"
          >
            <div class="rm-asset-item__info">
              <div
                class="rm-asset-item__name"
                :title="path"
              >
                {{ path }}
              </div>
            </div>
            <div class="rm-asset-item__actions">
              <!-- 按钮："定位"（跳转到引用该丢失资源的文档，便于修复断链） -->
              <button
                class="rm-btn small"
                @click="handleLocateAsset(path)"
              >
                {{ i18n.locate }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- 未使用资源 -->
      <div
        v-if="activeTab === 'unusedAssets'"
        class="rm-section"
      >
        <div
          v-if="unusedAssets.length > 0 && !loading"
          class="rm-section__actions"
        >
          <!-- 按钮："删除所有未使用资源" -->
          <button
            class="rm-btn danger small"
            :disabled="unusedAssets.length === 0"
            @click="handleDeleteAllUnused"
          >
            {{ i18n.deleteAllUnused }}
          </button>
        </div>
        <!-- 加载中提示："加载中..." -->
        <EmptyState
          v-if="loading"
          icon="refresh"
          :text="i18n.loading"
          spin
        />
        <!-- 空状态："无未使用资源" -->
        <EmptyState
          v-else-if="unusedAssets.length === 0"
          icon="delete"
          :text="i18n.noUnusedAssets"
        />
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="path in unusedAssets"
            :key="path"
            class="rm-asset-item"
          >
            <div class="rm-asset-item__info">
              <div
                class="rm-asset-item__name"
                :title="path"
              >
                {{ path }}
              </div>
            </div>
            <div class="rm-asset-item__actions">
              <!-- 按钮："删除" -->
              <button
                class="rm-btn small danger"
                @click="handleDeleteUnused(path)"
              >
                {{ i18n.deleteUnused }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- 重建索引 -->
      <div
        v-if="activeTab === 'rebuildIndex'"
        class="rm-section"
      >
        <!-- 区块标题："重建索引" -->
        <div class="rm-section__title">
          {{ i18n.rebuildIndex }}
        </div>
        <!-- 按钮："重建索引 / 正在重建索引..." -->
        <button
          class="rm-btn primary"
          :disabled="rebuildingIndex"
          @click="handleRebuildIndex"
        >
          {{ rebuildingIndex ? i18n.rebuildIndexStart : i18n.rebuildIndex }}
        </button>
        <!-- 重建结果展示 -->
        <div
          v-if="rebuildResult"
          class="rm-result"
        >
          {{ rebuildResult }}
        </div>
      </div>
    </div>

    <!-- 图片放大预览弹层：点击卡片缩略图打开，遮罩或关闭按钮退出 -->
    <Teleport to="body">
      <Transition name="rm-preview-fade">
        <div
          v-if="previewAsset"
          class="rm-preview-mask"
          @click.self="closeAssetPreview"
        >
          <div class="rm-preview-panel">
            <!-- 预览头部：资源路径 + 关闭 -->
            <div class="rm-preview-panel__header">
              <span
                class="rm-preview-panel__name"
                :title="previewAsset"
              >{{ previewAsset }}</span>
              <!-- 按钮："关闭" -->
              <button
                class="rm-preview-panel__close"
                :title="i18n.cancel"
                @click="closeAssetPreview"
              >
                <IconWrapper
                  name="close"
                  :size="14"
                />
              </button>
            </div>
            <!-- 大图主体 -->
            <div class="rm-preview-panel__body">
              <img
                :src="buildAssetSrc(previewAsset)"
                alt=""
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- 分类设置弹窗：集中删除空分类 / 恢复内置分类（Teleport 至 body 全屏遮罩） -->
    <CategorySettingsDialog
      v-if="settingsOpen"
      :i18n="i18n"
      :categories="quickCategories"
      :hidden-built-ins="hiddenBuiltInCategories"
      @close="settingsOpen = false"
      @delete="handleDeleteCategory($event.key, $event.label)"
      @restore="handleRestoreBuiltIn"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { ResourceManagerI18n } from "./types"
import { computed, nextTick, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import AssetGridList from "./components/AssetGridList.vue"
import CategoryFilterBar from "./components/CategoryFilterBar.vue"
import CategorySettingsDialog from "./components/CategorySettingsDialog.vue"
import DocAssetsSection from "./components/DocAssetsSection.vue"
import EmptyState from "./components/EmptyState.vue"
import { useResourceManager } from "./composables/useResourceManager"
import { buildAssetSrc } from "./utils"

interface Props {
  i18n: ResourceManagerI18n
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  activeTab,
  loading,
  rebuildingIndex,
  missingAssets,
  unusedAssets,
  categoryFilter,
  loadLimit,
  movingAsset,
  moveNewPath,
  customCategory,
  rebuildResult,
  quickCategories,
  hiddenBuiltInCategories,
  totalAssetCount,
  currentAssetList,
  refresh,
  copyPathToClipboard,
  copyMarkdownRef,
  openAssetInExplorer,
  handleLocateAsset,
  handleDeleteUnused,
  handleDeleteAllUnused,
  handleDeleteCategory,
  handleRestoreBuiltIn,
  startMoveAsset,
  cancelMove,
  applyCategory,
  applyCustomCategory,
  handleMoveAsset,
  handleRebuildIndex,
} = useResourceManager(props.plugin, props.i18n)

// 分类设置弹窗开合状态
const settingsOpen = ref(false)

// 移动表单当前路径（未选中移动时为安全空串；表单仅在 movingAsset 存在时渲染）
const activeMovePath = computed(() => movingAsset.value ?? "")

// 图片放大预览的当前资源路径（空串 = 关闭）
const previewAsset = ref("")
// 区块级移动表单元素（展开后自动滚入视口，避免表单在可视区外导致"点了没反应"）
const moveFormRef = ref<HTMLElement | null>(null)

/** 打开图片放大预览 */
function openAssetPreview(path: string) {
  previewAsset.value = path
}

/** 关闭图片放大预览 */
function closeAssetPreview() {
  previewAsset.value = ""
}

/** 展开移动表单并滚动至可视区域，提升"移动"点击的即时反馈 */
async function handleStartMove(path: string) {
  startMoveAsset(path)
  await nextTick()
  moveFormRef.value?.scrollIntoView({ behavior: "smooth", block: "nearest" })
}

const tabs = computed(() => [
  { key: "imageAssets", label: props.i18n.imageAssets },
  { key: "fileAssets", label: props.i18n.fileAssets },
  { key: "docAssets", label: props.i18n.docAssets },
  { key: "missingAssets", label: props.i18n.missingAssets },
  { key: "unusedAssets", label: props.i18n.unusedAssets },
  { key: "rebuildIndex", label: props.i18n.rebuildIndex },
])
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
