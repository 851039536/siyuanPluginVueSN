<!-- gitPush 提交文件弹窗：列出指定提交修改的文件（内嵌 CommitFilesList 面板，行点击查看差异） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="emit('close')"
    >
      <div class="gp-dialog gcf-dialog">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："修改的文件" -->
          <span class="gp-dialog-title">{{ i18n.commitFilesTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" height="10" />
          </button>
        </div>

        <div class="gp-dialog-body">
          <!-- 加载项目信息中 -->
          <div
            v-if="loading"
            class="gp-loading"
          >
            <Loader />
          </div>

          <template v-else>
            <!-- 项目信息 + 提交 hash -->
            <div class="gcf-meta">
              <span class="gcf-project">{{ project?.name || target.projectName }}</span>
              <span class="gcf-hash">{{ target.hash }}</span>
            </div>

            <!-- 提交信息（弱化单行展示，悬停查看全文） -->
            <div
              v-if="target.message"
              class="gcf-message"
              :title="target.message"
            >{{ target.message }}</div>

            <!-- 该提交修改的文件清单（行点击可查看差异；merge 提交给专门空态文案） -->
            <CommitFilesList
              v-if="project"
              :i18n="i18n"
              :project="project"
              :hash="target.hash"
              :empty-text="target.isMerge ? i18n.commitFilesEmptyMerge : undefined"
              :list-height="320"
            />
          </template>
        </div>

        <div class="gp-dialog-footer">
          <div class="gp-grow" />
          <!-- 关闭 -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            @click="emit('close')"
          >
            <span>{{ i18n.close }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush 提交文件弹窗（壳层：加载项目后内嵌 CommitFilesList 面板展示清单与差异）
import type { CommitFixTarget, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { inject, onMounted, onUnmounted, ref } from "vue"
import { CARD_SERVICES_KEY } from "../../types"
import Loader from "@/components/Loader.vue"
import CommitFilesList from "./CommitFilesList.vue"

const props = defineProps<{
  i18n: Record<string, any>
  target: CommitFixTarget
}>()

const emit = defineEmits<{
  close: []
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

const project = ref<GitProject | null>(null)
const loading = ref(true)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void init()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

/** 拉取项目信息（文件清单加载交给内嵌 CommitFilesList，其按 project + hash 自取） */
async function init() {
  try {
    const p = await manager.getProjectById(props.target.projectId)
    project.value = p ?? null
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss">
@use "../../styles/CommitFilesDialog.scss";
@use "../../styles/index.scss";
</style>
