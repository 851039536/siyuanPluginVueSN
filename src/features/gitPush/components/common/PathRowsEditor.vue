<!-- 多设备路径行编辑器（添加/编辑项目弹窗共用：行内输入 + 目录选择 + 增删） -->
<template>
  <div class="gp-edit-paths">
    <div
      v-for="(entry, idx) in rows"
      :key="idx"
      class="gp-edit-path-row"
    >
      <!-- 路径输入占位符："设备 {n} 的本地路径..." -->
      <Input
        v-model="entry.path"
        size="xsmall"
        :placeholder="String(i18n.devicePathPlaceholder).replace('{0}', String(idx + 1))"
        :disabled="disabled"
        @keydown.enter="emit('submit')"
      />
      <!-- 设备电脑名（可选）：占位符"电脑名（可选）" -->
      <div class="gp-path-device">
        <Input
          v-model="entry.device"
          size="xsmall"
          :placeholder="i18n.deviceNamePlaceholder"
          :disabled="disabled"
        />
      </div>
      <!-- 按钮提示："选择目录" -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--xs"
        :title="i18n.selectDir"
        :disabled="disabled"
        @click="emit('pick', idx)"
      >
        <Icon
          icon="mdi:folder-outline"
          height="10"
        />
      </button>
      <!-- 按钮提示："移除此路径" -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--xs"
        :title="i18n.removePath"
        :disabled="disabled || rows.length <= 1"
        @click="emit('remove', idx)"
      >
        <Icon
          icon="mdi:delete-outline"
          height="10"
        />
      </button>
    </div>
  </div>
  <!-- 按钮："添加路径" -->
  <button
    class="vp-btn vp-btn--ghost vp-btn--xs gp-add-path-btn"
    :disabled="disabled"
    @click="emit('add')"
  >
    <Icon
      icon="mdi:plus"
      height="10"
    />
    <span>{{ i18n.addLocalPath }}</span>
  </button>
</template>

<script setup lang="ts">
// 多设备路径行编辑器：行数据由父组件（usePathRows）持有，本组件只负责渲染与事件上报
import type { PathRow } from "../../composables/usePathRows"
import { Icon } from "@iconify/vue"
import Input from "@/components/Input.vue"

defineProps<{
  rows: PathRow[]
  i18n: Record<string, any>
  /** 禁用全部交互（如克隆进行中） */
  disabled?: boolean
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
  pick: [index: number]
  /** 路径输入框回车（调用方决定保存 / 提交） */
  submit: []
}>()
</script>
