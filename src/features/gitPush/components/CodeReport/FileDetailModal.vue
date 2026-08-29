<!-- gitPush 文件详情弹窗：展示文件完整统计（路径/修改次数/增删行/作者数/最后修改）+ 按需懒取的变更 diff，Teleport 到 body -->
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
          <!-- 指标网格：修改次数 / 新增行数 / 删除行数 / 参与作者数 / 净增 / 最后修改时间 -->
          <div class="gpr-fm-grid">
            <!-- 指标："修改次数" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailMods }}</span>
              <span class="gpr-fm-value">{{ fileStat.modCount }}</span>
            </div>
            <!-- 指标："新增行数" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailAdded }}</span>
              <span class="gpr-fm-value gpr-fm-added">+{{ fileStat.added }}</span>
            </div>
            <!-- 指标："删除行数" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailDeleted }}</span>
              <span class="gpr-fm-value gpr-fm-deleted">-{{ fileStat.deleted }}</span>
            </div>
            <!-- 指标："参与作者数" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailAuthors }}</span>
              <span class="gpr-fm-value">{{ fileStat.authorCount }}</span>
            </div>
            <!-- 指标："净增"（新增-删除） -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportNetCol }}</span>
              <span class="gpr-fm-value">{{ netLines }}</span>
            </div>
            <!-- 指标："最后修改时间" -->
            <div class="gpr-fm-cell">
              <span class="gpr-fm-label">{{ i18n.reportFileDetailLastModified }}</span>
              <span class="gpr-fm-value">{{ formatIsoDate(fileStat.lastModified) }}</span>
            </div>
          </div>

          <!-- 变更详情：git log -p diff 内容（打开弹窗时按需异步加载，失败静默隐藏） -->
          <div
            v-if="patchLoading || patchContent"
            class="gpr-fm-diff-section"
          >
            <!-- 分区标签："变更详情" -->
            <span class="gpr-fm-label gpr-fm-diff-label">{{ i18n.reportFileDetailDiff }}</span>
            <!-- 加载态文案："加载中..."（复用全局 loading 键） -->
            <div
              v-if="patchLoading"
              class="gpr-fm-diff-loading"
            >{{ i18n.loading }}</div>
            <div
              v-else
              class="gpr-fm-diff"
            >
              <div
                v-for="(line, i) in diffLines"
                :key="i"
                class="gpr-fm-dl"
                :class="`gpr-fm-dl-${line.type}`"
              >
                <!-- 旧/新文件行号双列（hunk/meta 行无行号，留空对齐） -->
                <span class="gpr-fm-dl-no">{{ line.oldNo ?? "" }}</span>
                <span class="gpr-fm-dl-no">{{ line.newNo ?? "" }}</span>
                <!-- 行首符号：+ / − / @ / 空格 -->
                <span class="gpr-fm-dl-sign">{{ DIFF_SIGN[line.type] }}</span>
                <span class="gpr-fm-dl-text">{{ line.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 文件详情弹窗：受控显示 + 变更 diff 按需懒取（打开时异步加载），ESC/遮罩/关闭按钮触发 close
import { Icon } from "@iconify/vue"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { FileStatRow } from "../../types"
import { formatIsoDate, parseDiffLines, type DiffLineType } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 目标文件完整统计行（null = 隐藏） */
  fileStat: FileStatRow | null
  /** 按当前项目+范围懒取文件补丁（弹窗打开时异步加载，失败返回空串） */
  getFilePatch: (path: string) => Promise<string>
}>()

const emit = defineEmits<{
  close: []
}>()

/** 补丁内容（弹窗本地状态，打开时异步加载；空串 = 加载失败/无内容，隐藏区块） */
const patchContent = ref("")
/** 补丁加载中标记 */
const patchLoading = ref(false)
/** 请求序号（快速切换目标文件时丢弃过期响应，防竞态） */
let patchReqSeq = 0

// 目标文件变化（含弹窗打开）时按需加载补丁
watch(() => props.fileStat, async (stat) => {
  patchContent.value = ""
  if (!stat) {
    patchLoading.value = false
    return
  }
  const seq = ++patchReqSeq
  patchLoading.value = true
  const content = await props.getFilePatch(stat.path).catch(() => "")
  // 响应返回前目标已切换时丢弃过期结果
  if (seq !== patchReqSeq) return
  patchContent.value = content
  patchLoading.value = false
})

/** 净增行数（新增 - 删除；fileStat 为 null 时显示 —） */
const netLines = computed(() => {
  if (!props.fileStat) return "—"
  const net = props.fileStat.added - props.fileStat.deleted
  return net >= 0 ? `+${net}` : `${net}`
})

/** diff 行类型 → 行首符号（与 WorkingTreeDiffDialog 展示一致） */
const DIFF_SIGN: Record<DiffLineType, string> = {
  add: "+",
  del: "−",
  hunk: "@",
  ctx: " ",
  meta: " ",
}

/** 将补丁文本解析为带类型/行号的行数组（供行级着色渲染） */
const diffLines = computed(() => (patchContent.value ? parseDiffLines(patchContent.value) : []))

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
