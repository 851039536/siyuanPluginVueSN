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
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <!-- 空状态："暂无资源" -->
        <div
          v-else-if="currentAssetList.length === 0"
          class="rm-empty"
        >
          {{ i18n.noAssets }}
        </div>
        <!-- 资源列表 -->
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="path in currentAssetList"
            :key="path"
            class="rm-asset-item"
          >
            <!-- 图片缩略图（hover 显示放大预览，加载失败自动隐藏） -->
            <div
              v-if="activeTab === 'imageAssets' && !thumbErrors.has(path)"
              class="rm-asset-item__thumb"
              @mouseenter="hoveredThumb = path"
              @mouseleave="hoveredThumb = ''"
            >
              <img
                :src="buildAssetSrc(path)"
                alt=""
                loading="lazy"
                @error="thumbErrors.add(path)"
              />
              <img
                v-if="hoveredThumb === path"
                class="rm-asset-item__preview"
                alt=""
                :src="buildAssetSrc(path)"
              />
            </div>
            <div class="rm-asset-item__info">
              <div
                class="rm-asset-item__name"
                :title="path"
              >
                {{ path }}
              </div>
            </div>
            <div class="rm-asset-item__actions">
              <!-- 按钮："定位" -->
              <button
                class="rm-btn small"
                @click="handleLocateAsset(path)"
              >
                {{ i18n.locate }}
              </button>
              <!-- 按钮："复制路径" -->
              <button
                class="rm-btn small"
                @click="copyPathToClipboard(path)"
              >
                {{ i18n.copyPath }}
              </button>
              <!-- 按钮："复制MD" -->
              <button
                class="rm-btn small"
                @click="copyMarkdownRef(path, activeTab === 'imageAssets')"
              >
                {{ i18n.copyMdRef }}
              </button>
              <!-- 按钮："打开目录" -->
              <button
                class="rm-btn small"
                @click="openAssetInExplorer(path)"
              >
                {{ i18n.openInFolder }}
              </button>
              <!-- 按钮："移动" -->
              <button
                class="rm-btn small"
                @click="startMoveAsset(path)"
              >
                {{ i18n.moveAsset }}
              </button>
            </div>
            <!-- 移动表单 -->
            <div
              v-if="movingAsset === path"
              class="rm-move-form"
            >
              <div class="rm-move-form__row">
                <!-- 标签："当前路径" -->
                <span class="rm-move-form__label">{{ i18n.currentPath }}:</span>
                <span class="rm-move-form__path">{{ path }}</span>
              </div>
              <div class="rm-move-form__row">
                <!-- 标签："新路径" -->
                <span class="rm-move-form__label">{{ i18n.newPath }}:</span>
                <!-- 输入框占位："输入新路径，如 assets/分类/xxx.png" -->
                <input
                  v-model="moveNewPath"
                  class="rm-move-form__input"
                  :placeholder="i18n.movePathPlaceholder"
                  @keyup.enter="handleMoveAsset(path)"
                />
              </div>
              <div class="rm-move-form__row">
                <!-- 标签："快速分类" -->
                <span class="rm-move-form__label">{{ i18n.category }}:</span>
                <div class="rm-move-form__categories">
                  <!-- 分类按钮："图片 / NET / tool / 其他" 及自定义分类 -->
                  <button
                    v-for="cat in quickCategories"
                    :key="cat.key"
                    class="rm-btn small"
                    @click="applyCategory(path, cat.key)"
                  >
                    {{ cat.label }}
                  </button>
                  <!-- 输入框占位："自定义" -->
                  <input
                    v-model="customCategory"
                    class="rm-move-form__category-input"
                    :placeholder="i18n.customCategoryPlaceholder"
                    @keyup.enter="applyCustomCategory(path)"
                  />
                  <!-- 按钮："应用" -->
                  <button
                    class="rm-btn small"
                    :disabled="!customCategory"
                    @click="applyCustomCategory(path)"
                  >
                    {{ i18n.apply }}
                  </button>
                </div>
              </div>
              <!-- 移动表单操作栏 -->
              <div class="rm-move-form__actions">
                <!-- 按钮："确认移动" -->
                <button
                  class="rm-btn small primary"
                  :disabled="!moveNewPath"
                  @click="handleMoveAsset(path)"
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
          </li>
        </ul>
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
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <!-- 空状态："无丢失资源" -->
        <div
          v-else-if="missingAssets.length === 0"
          class="rm-empty"
        >
          {{ i18n.noMissingAssets }}
        </div>
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
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <!-- 空状态："无未使用资源" -->
        <div
          v-else-if="unusedAssets.length === 0"
          class="rm-empty"
        >
          {{ i18n.noUnusedAssets }}
        </div>
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
import { computed, reactive, ref, watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CategoryFilterBar from "./components/CategoryFilterBar.vue"
import CategorySettingsDialog from "./components/CategorySettingsDialog.vue"
import DocAssetsSection from "./components/DocAssetsSection.vue"
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

// 缩略图交互状态：hover 中的资源路径（控制放大预览按需加载）与加载失败集合
const hoveredThumb = ref("")
const thumbErrors = reactive(new Set<string>())

// 可见列表变化（加载完成/筛选/限制变更）时重置失败缓存，避免资源修复后缩略图永久缺失
watch(currentAssetList, () => {
  thumbErrors.clear()
  hoveredThumb.value = ""
})

// 分类设置弹窗开合状态
const settingsOpen = ref(false)

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
