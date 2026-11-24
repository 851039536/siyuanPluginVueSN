<!-- gitPush Reflog 浏览器：列出引用日志，选择「丢失」的提交恢复（交由重置弹窗选模式） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="emit('close')"
    >
      <div class="gp-dialog gp-reflog-dialog">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.reflogTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            @click="emit('close')"
          >
            <Icon
              icon="mdi:close"
              height="10"
            />
          </button>
        </div>

        <div class="gp-dialog-body">
          <p class="gp-reflog-hint">{{ i18n.reflogHint }}</p>

          <div
            v-if="loading"
            class="gp-loading"
          >
            <Loader />
          </div>

          <div
            v-else-if="error"
            class="gp-reflog-error"
          >
            <Icon
              icon="mdi:alert-circle-outline"
              height="12"
            />
            <span>{{ error }}</span>
          </div>

          <div
            v-else-if="entries.length === 0"
            class="gp-reflog-empty"
          >{{ i18n.reflogEmpty }}</div>

          <div
            v-else
            class="gp-reflog-list"
          >
            <div
              v-for="(entry, index) in entries"
              :key="`${entry.hash}-${index}`"
              class="gp-reflog-row"
            >
              <span
                class="gp-reflog-hash"
                role="button"
                tabindex="0"
                :title="`${entry.hash}\n${i18n.copyHash}`"
                :aria-label="i18n.copyHash"
                @click="copyHash(entry.hash)"
                @keydown.enter.prevent="copyHash(entry.hash)"
                @keydown.space.prevent="copyHash(entry.hash)"
              >{{ copiedHash === entry.hash ? i18n.copied : shortHash(entry.hash) }}</span>
              <span
                class="gp-reflog-subject"
                :title="entry.subject"
              >{{ entry.subject }}</span>
              <span
                class="gp-reflog-selector"
                :title="entry.selector"
              >{{ entry.selector }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--xs gp-reflog-restore"
                :title="i18n.reflogRestore"
                @click="emit('restore', entry)"
              >
                <Icon
                  icon="mdi:history"
                  height="12"
                />
                <span>{{ i18n.reflogRestore }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Reflog 浏览器：只读展示；「重置到此提交」把目标交回父层打开重置弹窗（模式由用户决定）
import type { RefLogEntry } from "../../types"
import { Icon } from "@iconify/vue"
import { inject, onMounted, onUnmounted, ref } from "vue"
import Loader from "@/components/Loader.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import { TimerRegistry } from "@/utils/timerRegistry"
import { CARD_SERVICES_KEY } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  projectPath: string
}>()

const emit = defineEmits<{
  close: []
  restore: [entry: RefLogEntry]
}>()

const services = inject(CARD_SERVICES_KEY)!

const entries = ref<RefLogEntry[]>([])
const loading = ref(true)
const error = ref("")
/** 刚复制成功的 hash（只在该行显示「已复制」，避免整表同时高亮） */
const copiedHash = ref("")
const timers = new TimerRegistry()
let copyTimer: number | null = null

function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

async function copyHash(hash: string): Promise<void> {
  const ok = await copyToClipboard(hash)
  if (!ok) return
  timers.clear(copyTimer)
  copiedHash.value = hash
  copyTimer = timers.setTimeout(() => { copiedHash.value = "" }, 1500)
}

/** 与其它弹窗一致：Esc 关闭（只读弹窗没有进行中的写操作需要拦截） */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown)
  try {
    entries.value = await services.manager.listReflog(props.projectPath, 100)
  } catch (e: unknown) {
    error.value = `${props.i18n.reflogFailed}：${getErrorMessage(e)}`
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
  timers.clearAll()
})
</script>

<style lang="scss">
@use "../../styles/ReflogDialog.scss";
@use "../../styles/index.scss";
</style>
