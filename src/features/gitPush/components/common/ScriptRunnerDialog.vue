<!-- gitPush 项目脚本弹窗：识别前端/.NET/脚本文件命令并点击运行（会话托管，关窗不断） -->
<template>
  <div
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="handleClose"
    @click.self="handleClose"
  >
    <div class="gp-sr-dialog">
      <!-- 头部：标题 + 重新识别 + 关闭 -->
      <div class="gp-sr-header">
        <div class="gp-sr-title">
          <Icon
            icon="mdi:script-text-outline"
            height="14"
          />
          <span>{{ i18n.scriptDialogTitle }}</span>
          <span class="gp-sr-project">{{ project.name }}</span>
        </div>
        <div class="gp-sr-head-actions">
          <!-- 悬停提示："重新识别" -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="refresh"
            :title="i18n.scriptRescan"
            @click="rescan"
          />
          <button
            class="gp-sr-close"
            :title="i18n.close"
            @click="handleClose"
          >
            <Icon
              icon="mdi:close"
              height="16"
            />
          </button>
        </div>
      </div>

      <div class="gp-sr-body">
        <!-- 识别结果列表 -->
        <div class="gp-sr-list">
          <div
            v-if="scanning"
            class="gp-sr-empty"
          >
            {{ i18n.scriptScanning }}
          </div>
          <div
            v-else-if="groups.length === 0"
            class="gp-sr-empty"
          >
            <Icon
              icon="mdi:magnify-close"
              height="20"
            />
            <span>{{ i18n.scriptEmpty }}</span>
            <span class="gp-sr-empty-hint">{{ i18n.scriptEmptyHint }}</span>
          </div>
          <template v-else>
            <div
              v-for="g in groups"
              :key="`${g.kind}:${g.source}`"
              class="gp-sr-group"
            >
              <div class="gp-sr-group-head">
                <Icon
                  :icon="groupIcon(g.kind)"
                  height="12"
                />
                <span class="gp-sr-group-title">{{ groupTitle(g.kind) }}</span>
                <span
                  class="gp-sr-group-source"
                  :title="g.source"
                >{{ g.source }}</span>
              </div>
              <div
                v-for="s in g.scripts"
                :key="s.id"
                class="gp-sr-row"
                :class="{
                  'gp-sr-row--running': rowSession(s)?.status === 'running',
                  'gp-sr-row--attachable': !!rowSession(s),
                }"
                :title="rowSession(s) ? i18n.scriptViewOutput : ''"
                @click="attachTo(s)"
              >
                <div class="gp-sr-row-info">
                  <div class="gp-sr-row-line">
                    <span class="gp-sr-label">{{ scriptLabel(g.kind, s) }}</span>
                    <code
                      class="gp-sr-preview"
                      :title="s.preview"
                    >{{ s.preview }}</code>
                  </div>
                  <div
                    v-if="s.detail && s.detail !== s.preview"
                    class="gp-sr-detail"
                    :title="s.detail"
                  >
                    {{ s.detail }}
                  </div>
                </div>
                <!-- 悬停提示："运行" / "停止"（运行经会话托管，关窗不中断） -->
                <Button
                  v-if="rowSession(s)?.status !== 'running'"
                  variant="ghost"
                  size="xsmall"
                  dense
                  icon="play"
                  :title="i18n.scriptRun"
                  @click.stop="runScript(s)"
                />
                <Button
                  v-else
                  variant="ghost"
                  size="xsmall"
                  dense
                  icon="stop"
                  :title="i18n.scriptStop"
                  @click.stop="stopScript(s)"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- 运行输出（显示所点击行的会话日志，可回看） -->
        <div class="gp-sr-console-wrap">
          <div class="gp-sr-console-head">
            <span class="gp-sr-console-title">{{ i18n.scriptOutput }}<template v-if="attachedLabel"> · {{ attachedLabel }}</template></span>
            <span
              v-if="attachedState?.status === 'running'"
              class="gp-sr-status gp-sr-status--running"
            >{{ i18n.scriptRunning }}</span>
            <span
              v-else-if="exitLabel"
              class="gp-sr-status"
              :class="{ 'gp-sr-status--fail': attachedState?.status === 'exited' && attachedState.exitCode !== 0 }"
            >{{ exitLabel }}</span>
            <Button
              class="gp-sr-clear-btn"
              variant="ghost"
              size="xsmall"
              dense
              :icon="copied ? 'check' : 'contentCopy'"
              :title="i18n.scriptCopyOutput"
              :disabled="!logText"
              @click="handleCopy"
            />
            <Button
              class="gp-sr-clear-btn"
              variant="ghost"
              size="xsmall"
              dense
              icon="deleteOutline"
              :title="i18n.scriptClearOutput"
              :disabled="!logText"
              @click="clearLog"
            />
          </div>
          <div
            v-if="notice"
            class="gp-sr-notice"
          >
            {{ notice }}
          </div>
          <!-- data-selection-menu：接入 floatingToolbar 的选中内容右键菜单（复制 / 生成二维码等） -->
          <div
            ref="consoleEl"
            class="gp-sr-console"
            data-selection-menu
          >
            <!-- 输出内容：http(s) 链接按段渲染为可点击链接（点击经系统浏览器打开） -->
            <pre v-if="logText"><template
              v-for="(seg, i) in logSegments"
              :key="i"
            ><a
              v-if="seg.url"
              class="gp-sr-link"
              :href="seg.url"
              :title="seg.url"
              @click.stop.prevent="openLogLink(seg.url)"
            >{{ seg.text }}</a><template v-else>{{ seg.text }}</template></template></pre>
            <div
              v-else
              class="gp-sr-console-empty"
            >
              {{ i18n.scriptNoOutput }}
            </div>
          </div>
        </div>
      </div>

      <div class="gp-sr-footer">
        <Button
          size="xsmall"
          @click="handleClose"
        >
          {{ i18n.close }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 项目脚本弹窗：脚本识别 + 会话托管运行（关窗不杀进程，重开回看日志）
import type { ScriptGroup, ScriptKind, ProjectScript } from "../../types/scripts"
import type { ScriptSession } from "../../managers/ScriptSessionStore"
import { Icon } from "@iconify/vue"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { DOTNET_VERB_KEYS } from "../../types/scripts"
import { resolveValidPath, scanProjectScripts, splitLogLinks } from "../../utils"
import { MAX_RUNNING_SCRIPTS } from "../../managers/ScriptSessionStore"
import { useScriptSessions } from "../../composables/useScriptSessions"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import { copyToClipboard } from "@/utils/domUtils"
import { getElectronModules } from "@/utils/nodeModules"
import { TimerRegistry } from "@/utils/timerRegistry"
import Button from "@/components/Button.vue"
import type { GitProject } from "../../types/storage"

const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
}>()

const emit = defineEmits<{
  close: []
}>()

const { sessionVersion, sessionsOf, sessionOf, store } = useScriptSessions()
const { copied, notifyCopied } = useCopyFeedback()

const scanning = ref(false)
const groups = ref<ScriptGroup[]>([])
/** 当前查看输出的脚本会话（脚本 id） */
const attachedScriptId = ref("")
const logText = ref("")
const notice = ref("")
const consoleEl = ref<HTMLElement | null>(null)

/** 输出分段：http(s) 链接单独成段，模板据此渲染可点击链接 */
const logSegments = computed(() => splitLogLinks(logText.value))

/** 在系统浏览器打开输出中的链接（Electron 走 shell.openExternal，降级 window.open） */
async function openLogLink(url?: string) {
  if (!url) return
  const shell = getElectronModules()?.shell
  if (shell?.openExternal) {
    try {
      await shell.openExternal(url)
      return
    } catch {
      // 打开失败时降级到 window.open
    }
  }
  window.open(url, "_blank", "noopener,noreferrer")
}

/** 会话日志镜像节流：store 通知高频（每 chunk），写 logText 限频 80ms */
const FLUSH_INTERVAL_MS = 80
const timers = new TimerRegistry()
let syncHandle: number | null = null

function rescan() {
  scanning.value = true
  try {
    const root = resolveValidPath(props.project)
    groups.value = scanProjectScripts(root).groups
  } catch {
    groups.value = []
  } finally {
    scanning.value = false
  }
}

function rowSession(script: ProjectScript): ScriptSession | undefined {
  return sessionOf(props.project.id, script.id)
}

function attachedSession(): ScriptSession | undefined {
  return sessionOf(props.project.id, attachedScriptId.value)
}

/** 用户是否正在控制台内选中文本（选中期间暂停镜像，避免日志刷新打断复制） */
function hasConsoleSelection(): boolean {
  const sel = window.getSelection()
  return !!consoleEl.value && !!sel && !sel.isCollapsed && consoleEl.value.contains(sel.anchorNode)
}

/** 把会话日志镜像到展示区并滚到底（force=false 时仅在用户停留在底部才自动跟随） */
function syncNow(force = false) {
  if (hasConsoleSelection()) return
  const el = consoleEl.value
  const stickToBottom = force || !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24
  logText.value = attachedSession()?.log ?? ""
  if (!stickToBottom) return
  void nextTick(() => {
    const node = consoleEl.value
    if (node) node.scrollTop = node.scrollHeight
  })
}

function scheduleSync() {
  if (syncHandle !== null) return
  syncHandle = timers.setTimeout(() => {
    syncHandle = null
    syncNow()
  }, FLUSH_INTERVAL_MS)
}

// 会话/日志变更 → 节流镜像（关闭弹窗后 watch 随组件销毁，进程在 store 继续跑）
watch(sessionVersion, scheduleSync)

/** 点击行接入该会话的输出（运行中实时续传，已结束可回看） */
function attachTo(script: ProjectScript) {
  if (!rowSession(script)) return
  attachedScriptId.value = script.id
  notice.value = ""
  syncNow(true)
}

function runScript(script: ProjectScript) {
  notice.value = ""
  const ss = store.start(props.project.id, script)
  if (!ss) {
    notice.value = String(props.i18n.scriptTooManySessions).replace("{0}", String(MAX_RUNNING_SCRIPTS))
    return
  }
  attachedScriptId.value = script.id
  syncNow(true)
}

function stopScript(script: ProjectScript) {
  store.stop(props.project.id, script.id)
  syncNow()
}

function clearLog() {
  notice.value = ""
  if (attachedScriptId.value) store.clearLog(props.project.id, attachedScriptId.value)
  syncNow(true)
}

async function handleCopy() {
  const text = attachedSession()?.log ?? logText.value
  if (!text) return
  const ok = await copyToClipboard(text)
  if (ok) notifyCopied()
}

function handleClose() {
  emit("close")
}

const attachedState = computed(() => {
  void sessionVersion.value
  return attachedSession()
})

const attachedLabel = computed(() => {
  const ss = attachedState.value
  return ss ? scriptLabel(ss.script.kind, ss.script) : ""
})

const exitLabel = computed(() => {
  const ss = attachedState.value
  if (!ss || ss.status === "running") return ""
  if (ss.status === "stopped") return String(props.i18n.scriptStopped)
  return ss.exitCode === 0
    ? String(props.i18n.scriptExitOk)
    : String(props.i18n.scriptExitFail).replace("{0}", String(ss.exitCode ?? -1))
})

function groupIcon(kind: ScriptKind): string {
  if (kind === "package") return "mdi:language-javascript"
  if (kind === "dotnet") return "mdi:dot-net"
  return "mdi:file-code-outline"
}

function groupTitle(kind: ScriptKind): string {
  if (kind === "package") return String(props.i18n.scriptGroupPackage)
  if (kind === "dotnet") return String(props.i18n.scriptGroupDotnet)
  return String(props.i18n.scriptGroupFiles)
}

/** dotnet 行显示 i18n 动词（restore→还原依赖 等），npm 脚本名原样展示 */
function scriptLabel(kind: ScriptKind, s: ProjectScript): string {
  if (kind !== "dotnet") return s.label
  const key = DOTNET_VERB_KEYS[s.label]
  return key ? String(props.i18n[key] ?? s.label) : s.label
}

onMounted(() => {
  rescan()
  // 默认接回最近会话（运行中优先）：关窗重开即回现场
  const list = sessionsOf(props.project.id)
  const pick = list.find((s) => s.status === "running")
    ?? [...list].sort((a, b) => b.startedAt - a.startedAt)[0]
  if (pick) attachedScriptId.value = pick.script.id
  syncNow(true)
})

// 卸载只摘视图：进程与日志留在会话表继续跑（显式「停止」才杀进程树）
onBeforeUnmount(() => {
  timers.clearAll()
})
</script>

<style lang="scss" scoped>
@use "../../styles/ScriptRunnerDialog";
</style>
