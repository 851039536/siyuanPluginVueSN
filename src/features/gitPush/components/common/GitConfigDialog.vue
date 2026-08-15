<!-- gitPush Git 配置弹窗：查看/编辑/新增/删除配置项（全局或项目级作用域） -->
<template>
  <div
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-gc-dialog">
      <!-- 头部 -->
      <div class="gp-gc-header">
        <div class="gp-gc-title">
          <Icon
            icon="mdi:information-outline"
            height="14"
          />
          <!-- 弹窗标题：项目级显示项目名，否则"Git 全局配置" -->
          <span>{{ title || i18n.gitConfigTitle }}</span>
        </div>
        <!-- 关闭按钮（tooltip："关闭"） -->
        <button
          class="gp-gc-close"
          :title="i18n.close"
          @click="$emit('close')"
        >
          <Icon
            icon="mdi:close"
            height="16"
          />
        </button>
      </div>

      <!-- 内容区：Git 配置管理面板（自包含：自行加载/编辑/新增/删除） -->
      <div class="gp-gc-body">
        <GitConfigSection
          :i18n="i18n"
          :manager="manager"
          :scope="scope"
          :project-path="projectPath"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GitPushManager } from "../../types"
import type { GitConfigScope } from "../../types/gitConfigDesc"
import { Icon } from "@iconify/vue"
import GitConfigSection from "./GitConfigSection.vue"

defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  scope: GitConfigScope
  projectPath?: string
  title?: string
}>()

defineEmits<{
  close: []
}>()
</script>

<style lang="scss" scoped>
@use "../../styles/GitConfigDialog";
</style>
