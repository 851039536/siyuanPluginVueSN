<!-- 当前文档资源页签：展示活动文档引用的资源列表（含文件大小），自行加载数据 -->
<template>
  <div class="rm-section">
    <!-- 当前文档信息栏 -->
    <div class="rm-doc-bar">
      <!-- 标签："当前文档" -->
      <span class="rm-doc-bar__label">{{ i18n.currentDoc }}:</span>
      <span
        class="rm-doc-bar__title"
        :title="docTitle"
      >{{ docTitle }}</span>
      <!-- 按钮："刷新" -->
      <button
        class="rm-btn small"
        @click="loadDocAssets"
      >
        {{ i18n.refresh }}
      </button>
    </div>
    <!-- 加载中提示："加载中..." -->
    <div
      v-if="loading"
      class="rm-empty"
    >
      {{ i18n.loading }}
    </div>
    <!-- 空状态："请先打开一个文档" -->
    <div
      v-else-if="noActiveDoc"
      class="rm-empty"
    >
      {{ i18n.noActiveDoc }}
    </div>
    <!-- 错误状态："加载失败" -->
    <div
      v-else-if="loadError"
      class="rm-empty"
    >
      {{ i18n.loadFailed }}
    </div>
    <!-- 空状态："当前文档未引用资源" -->
    <div
      v-else-if="docAssets.length === 0"
      class="rm-empty"
    >
      {{ i18n.noDocAssets }}
    </div>
    <!-- 文档资源列表 -->
    <ul
      v-else
      class="rm-asset-list"
    >
      <li
        v-for="asset in docAssets"
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
          <!-- 文件大小元信息 -->
          <div class="rm-asset-item__size">
            {{ formatFileSize(asset.size) }}
          </div>
        </div>
        <div class="rm-asset-item__actions">
          <!-- 按钮："定位" -->
          <button
            class="rm-btn small"
            @click="onLocate(asset.path)"
          >
            {{ i18n.locate }}
          </button>
          <!-- 按钮："复制路径" -->
          <button
            class="rm-btn small"
            @click="onCopyPath(asset.path)"
          >
            {{ i18n.copyPath }}
          </button>
          <!-- 按钮："复制MD" -->
          <button
            class="rm-btn small"
            @click="onCopyMdRef(asset.path, isImagePath(asset.path))"
          >
            {{ i18n.copyMdRef }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { ResourceManagerI18n } from "../types"
import { onMounted } from "vue"
import { formatFileSize } from "@/utils/format"
import { useDocAssets } from "../composables/useDocAssets"
import { isImagePath } from "../utils"

interface Props {
  i18n: ResourceManagerI18n
  onLocate: (path: string) => void
  onCopyPath: (path: string) => void
  onCopyMdRef: (path: string, isImage: boolean) => void
}

defineProps<Props>()

// 自包含加载：页签切入（组件挂载）时读取活动文档资源
const { docAssets, loading, noActiveDoc, loadError, docTitle, loadDocAssets } = useDocAssets()

onMounted(() => {
  loadDocAssets()
})
</script>

<style scoped lang="scss">
@use "../styles/DocAssetsSection.scss";
@use "../styles/index.scss";
</style>
