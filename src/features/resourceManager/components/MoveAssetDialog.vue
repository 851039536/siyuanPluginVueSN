<!-- 移动资源弹窗：居中展示当前/新路径、快速分类与自定义分类，确认后交父层执行移动 -->
<template>
  <Teleport to="body">
    <Transition name="rm-move-fade">
      <!-- 遮罩点击取消 -->
      <div
        class="rm-move-mask"
        @click.self="emit('cancel')"
      >
        <!-- 弹窗卡片 -->
        <div class="rm-move-dialog">
          <!-- 弹窗头部 -->
          <div class="rm-move-dialog__header">
            <!-- 标题："移动" -->
            <span class="rm-move-dialog__title">{{ i18n.moveAsset }}</span>
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
          <!-- 弹窗内容 -->
          <div class="rm-move-dialog__body">
            <!-- 即时移动说明："选择分类、或输入新路径回车即移动" -->
            <div class="rm-move-dialog__hint">
              {{ i18n.moveInstantlyHint }}
            </div>
            <div class="rm-move-row">
              <!-- 标签："当前路径" -->
              <span class="rm-move-row__label">{{ i18n.currentPath }}:</span>
              <span
                class="rm-move-row__path"
                :title="currentPath"
              >{{ currentPath }}</span>
            </div>
            <div class="rm-move-row">
              <!-- 标签："新路径" -->
              <span class="rm-move-row__label">{{ i18n.newPath }}:</span>
              <!-- 输入框占位："输入新路径，如 assets/分类/xxx.png" -->
              <input
                class="rm-move-row__input"
                :value="newPath"
                :placeholder="i18n.movePathPlaceholder"
                @input="emit('update:newPath', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('confirm')"
              />
            </div>
            <div class="rm-move-row rm-move-row--stack">
              <!-- 标签："快速分类" -->
              <span class="rm-move-row__label">{{ i18n.category }}:</span>
              <div class="rm-move-row__content">
                <!-- 分类快捷 chips 一排："图片 / NET / tool / 其他" 及自定义分类 -->
                <div class="rm-move-row__chips">
                  <button
                    v-for="cat in categories"
                    :key="cat.key"
                    class="rm-move-btn"
                    @click="emit('applyCategory', cat.key)"
                  >
                    {{ cat.label }}
                  </button>
                </div>
                <!-- 自定义分类输入行（独立第二行，避免与 chips 混排换行悬尾） -->
                <div class="rm-move-row__custom">
                  <!-- 输入框占位："自定义" -->
                  <input
                    class="rm-move-row__input rm-move-row__input--inline"
                    :value="custom"
                    :placeholder="i18n.customCategoryPlaceholder"
                    @input="emit('update:custom', ($event.target as HTMLInputElement).value)"
                    @keyup.enter="emit('applyCustom')"
                  />
                  <!-- 按钮："应用" -->
                  <button
                    class="rm-move-btn"
                    :disabled="!custom"
                    @click="emit('applyCustom')"
                  >
                    {{ i18n.apply }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- 底部操作栏：仅保留取消（移动为即时动作，确认入口已移除） -->
          <div class="rm-move-dialog__footer">
            <!-- 按钮："取消" -->
            <button
              class="rm-move-btn"
              @click="emit('cancel')"
            >
              {{ i18n.cancel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { CategoryItem, ResourceManagerI18n } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  i18n: ResourceManagerI18n
  /** 分类快捷 chips（内置 + 自定义） */
  categories: CategoryItem[]
  /** 当前资源路径（只读展示） */
  currentPath: string
  /** 新路径输入值（双向同步父层 composable） */
  newPath: string
  /** 自定义分类输入值（双向同步父层 composable） */
  custom: string
}

interface Emits {
  (e: "update:newPath", value: string): void
  (e: "update:custom", value: string): void
  /** 执行移动（父层调用 handleMoveAsset） */
  (e: "confirm"): void
  /** 关闭并复位（父层调用 cancelMove） */
  (e: "cancel"): void
  /** 点击快捷分类 chip 直接移动 */
  (e: "applyCategory", key: string): void
  /** 应用自定义分类并移动 */
  (e: "applyCustom"): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped lang="scss">
@use "../styles/MoveAssetDialog.scss";
</style>
