<template>
  <div class="resource-manager-panel">
    <div class="rm-header">
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
          {{ i18n.refresh }}
        </button>
      </div>
    </div>

    <div class="rm-tabs">
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
        <!-- 加载数量 -->
        <div class="rm-filter-bar rm-filter-bar--limit">
          <span class="rm-filter-bar__label">{{ i18n.loadLimit }}:</span>
          <input
            v-model.number="loadLimit"
            type="number"
            min="1"
            max="10000"
            class="rm-limit-input"
            @change="refresh"
          />
        </div>
        <!-- 分类筛选栏 -->
        <div class="rm-filter-bar rm-filter-bar--category">
          <button
            class="rm-btn small"
            :class="{ active: categoryFilter === '' }"
            @click="categoryFilter = ''"
          >
            {{ i18n.allCategories }}
          </button>
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
          v-if="!loading && currentAssetList.length > 0"
          class="rm-asset-count"
        >
          {{ i18n.assetCount }}: {{ currentAssetList.length }}
        </div>
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <div
          v-else-if="currentAssetList.length === 0"
          class="rm-empty"
        >
          {{ i18n.noAssets }}
        </div>
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
              <button
                class="rm-btn small"
                @click="copyPathToClipboard(asset.path)"
              >
                {{ i18n.copyPath }}
              </button>
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
                <span class="rm-move-form__label">{{ i18n.currentPath }}:</span>
                <span class="rm-move-form__path">{{ asset.path }}</span>
              </div>
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.newPath }}:</span>
                <input
                  v-model="moveNewPath"
                  class="rm-move-form__input"
                  :placeholder="i18n.movePathPlaceholder"
                  @keyup.enter="handleMoveAsset(asset.path)"
                />
              </div>
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.category }}:</span>
                <div class="rm-move-form__categories">
                  <button
                    v-for="cat in quickCategories"
                    :key="cat.key"
                    class="rm-btn small"
                    @click="applyCategory(asset.path, cat.key)"
                  >
                    {{ cat.label }}
                  </button>
                  <input
                    v-model="customCategory"
                    class="rm-move-form__category-input"
                    :placeholder="i18n.customCategoryPlaceholder || '自定义'"
                    @keyup.enter="applyCustomCategory(asset.path)"
                  />
                  <button
                    class="rm-btn small"
                    :disabled="!customCategory"
                    @click="applyCustomCategory(asset.path)"
                  >
                    {{ i18n.apply || "应用" }}
                  </button>
                </div>
              </div>
              <div class="rm-move-form__actions">
                <button
                  class="rm-btn small primary"
                  :disabled="!moveNewPath"
                  @click="handleMoveAsset(asset.path)"
                >
                  {{ i18n.confirmMove }}
                </button>
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
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
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
          <button
            class="rm-btn danger small"
            :disabled="unusedAssets.length === 0"
            @click="handleDeleteAllUnused"
          >
            {{ i18n.deleteAllUnused }}
          </button>
        </div>
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
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
        <div class="rm-section__title">
          {{ i18n.rebuildIndex }}
        </div>
        <button
          class="rm-btn primary"
          :disabled="rebuildingIndex"
          @click="handleRebuildIndex"
        >
          {{ rebuildingIndex ? i18n.rebuildIndexStart : i18n.rebuildIndex }}
        </button>
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
  {
    key: "imageAssets",
    label: props.i18n.imageAssets || "图片资源",
  },
  {
    key: "fileAssets",
    label: props.i18n.fileAssets || "文件资源",
  },
  {
    key: "missingAssets",
    label: props.i18n.missingAssets || "丢失资源",
  },
  {
    key: "unusedAssets",
    label: props.i18n.unusedAssets || "未使用资源",
  },
  {
    key: "rebuildIndex",
    label: props.i18n.rebuildIndex || "重建索引",
  },
])
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
