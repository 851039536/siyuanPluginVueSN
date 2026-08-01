<!-- 图片生成弹窗外壳：标题栏 + Tab 切换 + 内容区（App.vue 统一调度入口） -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-show="visible"
        class="image-creation-overlay"
        @click.self="close"
      >
        <Transition name="scale">
          <div
            v-show="visible"
            class="image-creation-dialog"
            @click.stop
          >
            <!-- 头部 -->
            <div class="dialog-header">
              <div class="header-title">
                <IconWrapper
                  :name="activeTab === 'cover' ? 'image' : 'code'"
                  :size="22"
                />
                <!-- 弹窗标题："文章封面" / "代码图片" -->
                <h2>{{ activeTab === 'cover' ? t.coverTitle : t.codeImageTitle }}</h2>
              </div>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="close"
              />
            </div>

            <!-- Tab 栏 -->
            <div class="tab-bar">
              <button
                class="tab-btn"
                :class="{ active: activeTab === 'cover' }"
                @click="switchTab('cover')"
              >
                <IconWrapper
                  name="image"
                  :size="16"
                />
                <!-- Tab 标签："文章封面" -->
                <span>{{ t.coverTab }}</span>
              </button>
              <button
                class="tab-btn"
                :class="{ active: activeTab === 'codeImage' }"
                @click="switchTab('codeImage')"
              >
                <IconWrapper
                  name="code"
                  :size="16"
                />
                <!-- Tab 标签："代码图片" -->
                <span>{{ t.codeImageTab }}</span>
              </button>
            </div>

            <!-- 内容区 -->
            <div class="dialog-body">
              <!-- 文章封面 Tab（v-show 保持组件常驻，关闭后重开不丢状态） -->
              <CoverTab
                v-show="activeTab === 'cover'"
                :visible="visible"
              />
              <!-- 代码图片 Tab -->
              <CodeImageTab v-show="activeTab === 'codeImage'" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 图片生成弹窗外壳：标题栏 + Tab 切换 + 内容区（App.vue 统一调度入口）
 */
import type { ImageCreationI18n } from "./types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { usePlugin } from "@/main"
import CoverTab from "./components/CoverTab.vue"
import CodeImageTab from "./components/CodeImageTab.vue"
import {
  activeTab,
  switchTab,
} from "./composables/useImageCreationState"

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
}>()

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

function close() {
  emit("update:visible", false)
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
