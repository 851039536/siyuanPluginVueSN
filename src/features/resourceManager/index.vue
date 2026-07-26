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
        <!-- 分类筛选栏 -->
        <div class="rm-filter-bar rm-filter-bar--category">
          <!-- 按钮："待分类"（空筛选仅显示未归入分类目录的资源） -->
          <button
            class="rm-btn small"
            :class="{ active: categoryFilter === '' }"
            @click="categoryFilter = ''"
          >
            {{ i18n.uncategorized }}
          </button>
          <!-- 分类按钮："图片 / NET / tool / 其他" 及自定义分类 -->
          <button
            v-for="cat in quickCategories"
            :key="cat.key"
            class="rm-btn small"
            :class="{ active: categoryFilter === cat.key }"
            @click="categoryFilter = cat.key"
          >
            {{ cat.label }}
          </button>
        </div>
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
            v-for="asset in currentAssetList"
            :key="asset.path"
            class="rm-asset-item"
          >
            <div class="rm-asset-item__info">
              <div
                class="rm-asset-item__name"
                :title="asset.path"
              >
                {{ asset.path }}
              </div>
            </div>
            <div class="rm-asset-item__actions">
              <!-- 按钮："复制路径" -->
              <button
                class="rm-btn small"
                @click="copyPathToClipboard(asset.path)"
              >
                {{ i18n.copyPath }}
              </button>
              <!-- 按钮："移动" -->
              <button
                class="rm-btn small"
                @click="startMoveAsset(asset.path)"
              >
                {{ i18n.moveAsset }}
              </button>
            </div>
            <!-- 移动表单 -->
            <div
              v-if="movingAsset === asset.path"
              class="rm-move-form"
            >
              <div class="rm-move-form__row">
                <!-- 标签："当前路径" -->
                <span class="rm-move-form__label">{{ i18n.currentPath }}:</span>
                <span class="rm-move-form__path">{{ asset.path }}</span>
              </div>
              <div class="rm-move-form__row">
                <!-- 标签："新路径" -->
                <span class="rm-move-form__label">{{ i18n.newPath }}:</span>
                <!-- 输入框占位："输入新路径，如 assets/分类/xxx.png" -->
                <input
                  v-model="moveNewPath"
                  class="rm-move-form__input"
                  :placeholder="i18n.movePathPlaceholder"
                  @keyup.enter="handleMoveAsset(asset.path)"
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
                    @click="applyCategory(asset.path, cat.key)"
                  >
                    {{ cat.label }}
                  </button>
                  <!-- 输入框占位："自定义" -->
                  <input
                    v-model="customCategory"
                    class="rm-move-form__category-input"
                    :placeholder="i18n.customCategoryPlaceholder"
                    @keyup.enter="applyCustomCategory(asset.path)"
                  />
                  <!-- 按钮："应用" -->
                  <button
                    class="rm-btn small"
                    :disabled="!customCategory"
                    @click="applyCustomCategory(asset.path)"
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
                  @click="handleMoveAsset(asset.path)"
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
            <div
              class="rm-asset-item__name"
              :title="path"
            >
              {{ path }}
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
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { ResourceManagerI18n } from "./types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useResourceManager } from "./composables/useResourceManager"

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
  totalAssetCount,
  currentAssetList,
  refresh,
  copyPathToClipboard,
  handleDeleteUnused,
  handleDeleteAllUnused,
  startMoveAsset,
  cancelMove,
  applyCategory,
  applyCustomCategory,
  handleMoveAsset,
  handleRebuildIndex,
} = useResourceManager(props.plugin, props.i18n)

const tabs = computed(() => [
  { key: "imageAssets", label: props.i18n.imageAssets },
  { key: "fileAssets", label: props.i18n.fileAssets },
  { key: "missingAssets", label: props.i18n.missingAssets },
  { key: "unusedAssets", label: props.i18n.unusedAssets },
  { key: "rebuildIndex", label: props.i18n.rebuildIndex },
])
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
