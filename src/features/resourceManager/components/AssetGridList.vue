<!-- 图片/文件页签资源卡片网格（图库式）：媒体区缩略图/占位 + 名称 + hover 操作条，缩略图错误态组件内自管 -->
<template>
  <ul class="rm-asset-grid">
    <li
      v-for="path in items"
      :key="path"
      class="rm-asset-card"
    >
      <!-- 媒体区：图片页展示缩略图（可点击放大预览），文件页/加载失败展示扩展名占位 -->
      <div class="rm-asset-card__media">
        <img
          v-if="imageTab && !thumbErrors.has(path)"
          :src="buildSrc(path)"
          alt=""
          loading="lazy"
          @error="thumbErrors.add(path)"
          @click="onPreview(path)"
        />
        <div
          v-else
          class="rm-asset-card__fallback"
        >
          <IconWrapper
            v-if="!fileExtName(path)"
            name="fileOutline"
            :size="22"
          />
          <span v-else>{{ fileExtName(path) }}</span>
        </div>
      </div>
      <!-- 卡片底部：路径名 + 操作条（hover 显现） -->
      <div class="rm-asset-card__footer">
        <div
          class="rm-asset-card__name"
          :title="path"
        >
          {{ path }}
        </div>
        <!-- 操作条 title："复制路径/复制MD/打开目录/定位/移动" -->
        <div class="rm-asset-card__actions">
          <!-- 按钮："复制路径" -->
          <button
            class="rm-asset-card__action"
            :title="i18n.copyPath"
            @click="onCopyPath(path)"
          >
            <IconWrapper
              name="copy"
              :size="13"
            />
          </button>
          <!-- 按钮："复制MD" -->
          <button
            class="rm-asset-card__action"
            :title="i18n.copyMdRef"
            @click="onCopyMdRef(path, imageTab)"
          >
            <IconWrapper
              name="linkVariant"
              :size="13"
            />
          </button>
          <!-- 按钮："打开目录" -->
          <button
            class="rm-asset-card__action"
            :title="i18n.openInFolder"
            @click="onOpenFolder(path)"
          >
            <IconWrapper
              name="folderOpen"
              :size="13"
            />
          </button>
          <!-- 按钮："定位" -->
          <button
            class="rm-asset-card__action"
            :title="i18n.locate"
            @click="onLocate(path)"
          >
            <IconWrapper
              name="magnify"
              :size="13"
            />
          </button>
          <!-- 按钮："移动"（主操作，hover 置亮） -->
          <button
            class="rm-asset-card__action rm-asset-card__action--primary"
            :title="i18n.moveAsset"
            @click="onMove(path)"
          >
            <IconWrapper
              name="folderMove"
              :size="13"
            />
          </button>
        </div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { ResourceManagerI18n } from "../types"
import { reactive, watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  i18n: ResourceManagerI18n
  /** 待展示资源路径列表 */
  items: string[]
  /** 是否图片页签：图片展示缩略图，文件页一律走扩展名占位 */
  imageTab: boolean
  /** 构造 /assets 图片 src（父层注入，保持编码规则唯一） */
  buildSrc: (path: string) => string
  onCopyPath: (path: string) => void
  onCopyMdRef: (path: string, isImage: boolean) => void
  onOpenFolder: (path: string) => void
  onLocate: (path: string) => void
  onMove: (path: string) => void
  /** 点击图片打开放大预览 */
  onPreview: (path: string) => void
}

const props = defineProps<Props>()

// 缩略图加载失败集合：失败卡片隐藏图片并回退扩展名占位
const thumbErrors = reactive(new Set<string>())

// 列表变化（加载完成/筛选/限制变更）时重置失败缓存，避免资源修复后缩略图永久缺失
watch(
  () => props.items,
  () => thumbErrors.clear(),
)

/** 提取路径扩展名（不含点，大写）；无扩展名返回空串，用于文件卡片媒体区占位文案 */
function fileExtName(path: string): string {
  const dot = path.lastIndexOf(".")
  const slash = path.lastIndexOf("/")
  return dot > slash ? path.slice(dot + 1).toUpperCase() : ""
}
</script>

<style scoped lang="scss">
@use "../styles/AssetGridList.scss";
</style>
