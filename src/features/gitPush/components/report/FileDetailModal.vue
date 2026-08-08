<!-- gitPush 文件详情弹窗：展示作者 Top 修改文件的完整统计（路径/修改次数/LOC/参与作者数/最后修改），Teleport 到 body -->
<template>
  <Teleport to="body">
    <div
      v-if="fileStat"
      class="gpr-fm-overlay"
      @click.self="emit('close')"
    >
      <div class="gpr-fm-dialog">
        <!-- 头部：标题 + 关闭按钮 -->
        <div class="gpr-fm-header">
          <div class="gpr-fm-title">
            <Icon
              icon="mdi:file-document-outline"
              height="14"
            />
            <!-- 弹窗标题："文件详情" -->
            <span>{{ i18n.reportFileDetailTitle }}</span>
          </div>
          <!-- 关闭弹窗（tooltip："关闭"） -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.close"
            @click="emit('close')"
          >
            <Icon
              icon="mdi:close"
              height="12"
            />
          </button>
        </div>

        <div class="gpr-fm-body">
          <!-- 文件路径（等宽完整路径，超长自动换行） -->
          <div class="gpr-fm-path-row">
            <!-- 标签："文件路径" -->
            <span class="gpr-fm-label">{{ i18n.reportFileDetailPath }}</span>
            <span class="gpr-fm-path">{{ fileStat.path }}</span>
          </div>
          <!-- 指标网格：修改次数 / 代码行数 / 参与作者数 / 最后修改时间 -->
          <div class="gpr-fm-grid">
            <!-- 指标："修改次数" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailMods }}</span>
              <span class="gpr-fm-value">{{ fileStat.modCount }}</span>
            </div>
            <!-- 指标："代码行数"（null = 暂无数据，如幽灵文件/超限文件） -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailLoc }}</span>
              <span class="gpr-fm-value">{{ fileStat.loc ?? "—" }}</span>
            </div>
            <!-- 指标："参与作者数" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailAuthors }}</span>
              <span class="gpr-fm-value">{{ fileStat.authorCount }}</span>
            </div>
            <!-- 指标："最后修改时间" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailLastModified }}</span>
              <span class="gpr-fm-value">{{ formatIsoDate(fileStat.lastModified) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 文件详情弹窗：受控显示（fileStat 非空即展示），ESC/遮罩/关闭按钮触发 close
import { Icon } from "@iconify/vue"
import { onBeforeUnmount, onMounted } from "vue"
import type { FileStatRow } from "../../types"
import { formatIsoDate } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 目标文件完整统计行（null = 隐藏） */
  fileStat: FileStatRow | null
}>()

const emit = defineEmits<{
  close: []
}>()

/** ESC 关闭（Teleport 到 body 后键盘事件在 document 层监听） */
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.fileStat) emit("close")
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown)
})
</script>

<style lang="scss">
@use "../../styles/FileDetailModal.scss";
@use "../../styles/index.scss";
</style>
