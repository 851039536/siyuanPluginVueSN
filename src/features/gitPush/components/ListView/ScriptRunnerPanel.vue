<!-- gitPush 项目脚本面板：识别前端/.NET/脚本文件命令并运行（会话托管，收起/关窗不断；嵌入工作区浏览器底部） -->
<template>
  <div
    class="we-scripts"
    :class="{ 'is-collapsed': !expanded }"
  >
    <!-- 面板头：折叠切换 + 标题 + 项目名 + 运行中计数 + 重新识别 -->
    <div class="we-scripts-head">
      <!-- 折叠按钮（title："展开/收起项目脚本面板"） -->
      <button
        type="button"
        class="we-scripts-toggle"
        :aria-expanded="expanded"
        :title="expanded ? i18n.scriptPanelCollapse : i18n.scriptPanelExpand"
        @click="emit('toggle')"
      >
        <Icon
          :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-up'"
          height="12"
          class="we-scripts-chev"
        />
        <Icon
          icon="mdi:script-text-outline"
          height="12"
          class="we-scripts-icon"
        />
        <!-- 面板标题："项目脚本" -->
        <span class="we-scripts-title">{{ i18n.scriptDialogTitle }}</span>
        <!-- 项目名（弱化副标题，path 作 tooltip） -->
        <span
          class="we-scripts-project"
          :title="project.path"
        >{{ project.name }}</span>
        <!-- 运行中会话计数："N 个运行中"（收起态也可见，便于回到运行现场） -->
        <span
          v-if="runningCount > 0"
          class="we-scripts-running"
        >{{ runningText }}</span>
      </button>
      <!-- 重新识别脚本（tooltip："重新识别"） -->
      <Button
        v-if="expanded"
        variant="ghost"
        size="xsmall"
        dense
        icon="refresh"
        :loading="scanning"
        :title="i18n.scriptRescan"
        @click="rescan"
      />
    </div>

    <!-- 面板主体（收起时整块不渲染：列表/输出随面板重新挂载，运行中的进程留在会话表继续跑） -->
    <div
      v-if="expanded"
      class="we-scripts-body"
    >
      <!-- 左右分栏：脚本列表 + 运行输出（分隔条可拖动，方向键亦可微调） -->
      <Splitter
        class="we-scripts-split"
        layout="horizontal"
        :gutter-size="8"
        state-key="gitpush-workspace-scripts-split"
        state-storage="session"
      >
        <SplitterPanel
          :size="34"
          :min-size="18"
        >
          <div class="we-scripts-list">
            <!-- 识别中 -->
            <div
              v-if="scanning"
              class="we-scripts-empty"
            >
              {{ i18n.scriptScanning }}
            </div>
            <!-- 空态："未识别到可运行的脚本或命令"（附支持范围说明与重新识别入口） -->
            <EmptyState
              v-else-if="groups.length === 0"
              icon="mdi:magnify-close"
              icon-size="32"
              :text="i18n.scriptEmpty"
            >
              <template #action>
                <span class="we-scripts-empty-hint">{{ i18n.scriptEmptyHint }}</span>
              </template>
            </EmptyState>
            <template v-else>
              <div
                v-for="g in groups"
                :key="`${g.kind}:${g.source}`"
                class="we-scripts-group"
              >
                <div class="we-scripts-group-head">
                  <Icon
                    :icon="groupIcon(g.kind)"
                    height="12"
                  />
                  <span class="we-scripts-group-title">{{ groupTitle(g.kind) }}</span>
                  <span
                    class="we-scripts-group-source"
                    :title="g.source"
                  >{{ g.source }}</span>
                </div>
                <div
                  v-for="s in g.scripts"
                  :key="s.id"
                  class="we-scripts-row"
                  :class="{
                    'is-running': rowState(s)?.status === 'running',
                    'is-attachable': !!rowState(s),
                    'is-attached': attachedScriptId === s.id,
                  }"
                  :title="rowState(s) ? i18n.scriptViewOutput : ''"
                  @click="attachTo(s)"
                >
                  <span class="we-scripts-label">{{ scriptLabel(g.kind, s) }}</span>
                  <code
                    class="we-scripts-preview"
                    :title="s.detail || s.preview"
                  >{{ s.preview }}</code>
                  <!-- 运行（tooltip："运行"；运行经会话托管，收起/关窗不中断） -->
                  <Button
                    v-if="rowState(s)?.status !== 'running'"
                    variant="ghost"
                    size="xsmall"
                    dense
                    icon="play"
                    :title="i18n.scriptRun"
                    @click.stop="runScript(s)"
                  />
                  <!-- 停止（tooltip："停止"） -->
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
        </SplitterPanel>
        <SplitterPanel
          :size="66"
          :min-size="25"
        >
          <div class="we-scripts-console">
            <div class="we-scripts-console-head">
              <!-- 输出区标题："运行输出 · <脚本名>" -->
              <span class="we-scripts-console-title">{{ i18n.scriptOutput }}<template v-if="attachedLabel"> · {{ attachedLabel }}</template></span>
              <!-- 状态："运行中..." / "已结束（退出码 N）" / "已手动停止" -->
              <span
                v-if="attachedState?.status === 'running'"
                class="we-scripts-status is-running"
              >{{ i18n.scriptRunning }}</span>
              <span
                v-else-if="exitLabel"
                class="we-scripts-status"
                :class="{ 'is-fail': attachedState?.status === 'exited' && attachedState.exitCode !== 0 }"
              >{{ exitLabel }}</span>
              <span class="we-scripts-spacer" />
              <!-- 停止当前会话（tooltip："停止"） -->
              <Button
                v-if="attachedState?.status === 'running'"
                variant="ghost"
                size="xsmall"
                dense
                icon="stop"
                :title="i18n.scriptStop"
                @click="stopAttached"
              />
              <!-- 复制输出（反馈态："已复制"） -->
              <Button
                variant="ghost"
                size="xsmall"
                dense
                :icon="copied ? 'check' : 'contentCopy'"
                :title="copied ? i18n.workspaceFilesCopied : i18n.scriptCopyOutput"
                :disabled="!logText"
                @click="handleCopy"
              />
              <!-- 清空输出（tooltip："清空输出"） -->
              <Button
                variant="ghost"
                size="xsmall"
                dense
                icon="deleteOutline"
                :title="i18n.scriptClearOutput"
                :disabled="!logText"
                @click="clearLog"
              />
            </div>
            <!-- 一次性提示（并发上限等） -->
            <div
              v-if="notice"
              class="we-scripts-notice"
            >
              {{ notice }}
            </div>
            <!-- data-selection-menu：接入 floatingToolbar 的选中内容右键菜单（复制 / 生成二维码等） -->
            <div
              ref="consoleEl"
              class="we-scripts-output"
              data-selection-menu
            >
              <!-- 输出内容：http(s) 链接按段渲染为可点击链接（点击经系统浏览器打开） -->
              <pre v-if="logText"><template
                v-for="(seg, i) in logSegments"
                :key="i"
              ><a
                v-if="seg.url"
                class="we-scripts-link"
                :href="seg.url"
                :title="seg.url"
                @click.stop.prevent="openLogLink(seg.url)"
              >{{ seg.text }}</a><template v-else>{{ seg.text }}</template></template></pre>
              <!-- 无输出："暂无输出" / "运行脚本或点击已有会话查看输出" -->
              <div
                v-else
                class="we-scripts-output-empty"
              >
                {{ attachedScriptId ? i18n.scriptNoOutput : i18n.scriptSelectHint }}
              </div>
            </div>
          </div>
        </SplitterPanel>
      </Splitter>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 项目脚本面板：脚本识别 + 会话托管运行（收起/关窗不杀进程，重新展开回看日志）
import type { ScriptGroup, ScriptKind, ProjectScript } from "../../types/scripts"
import type { ScriptSession } from "../../managers/ScriptSessionStore"
import { Icon } from "@iconify/vue"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { DOTNET_VERB_KEYS } from "../../types/scripts"
import { resolveValidPath, scanProjectScripts, splitLogLinks } from "../../utils"
import { MAX_RUNNING_SCRIPTS } from "../../managers/ScriptSessionStore"
import { useScriptSessions } from "../../composables/useScriptSessions"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import { copyToClipboard, openExternalUrl } from "@/utils/domUtils"
import { TimerRegistry } from "@/utils/timerRegistry"
import Button from "@/components/Button.vue"
import Splitter from "@/components/Splitter.vue"
import SplitterPanel from "@/components/SplitterPanel.vue"
import EmptyState from "../common/EmptyState.vue"
import type { GitProject } from "../../types/storage"

const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
  /** 面板是否展开（受控：工作区浏览器用纵向分栏承载展开态，收起时只留一条头部栏） */
  expanded: boolean
}>()

const emit = defineEmits<{
  /** 请求切换展开/收起（实际状态由父层持有） */
  toggle: []
}>()

const { sessionVersion, statusVersion, sessionsOf, sessionOf, stateOf, store } = useScriptSessions()
const { copied, notifyCopied } = useCopyFeedback()

const scanning = ref(false)
const groups = ref<ScriptGroup[]>([])
/** 是否已完成首次识别（避免每次展开都重扫磁盘） */
let scanned = false
/** 当前查看输出的脚本会话（脚本 id） */
const attachedScriptId = ref("")
const logText = ref("")
const notice = ref("")
const consoleEl = ref<HTMLElement | null>(null)

/** 输出分段：http(s) 链接单独成段，模板据此渲染可点击链接 */
const logSegments = computed(() => splitLogLinks(logText.value))

/** 运行中会话数（面板头角标；收起态同样可见） */
const runningCount = computed(() => {
  void statusVersion.value
  return sessionsOf(props.project.id).filter((s) => s.status === "running").length
})

const runningText = computed(() =>
  String(props.i18n.scriptRunningCount).replace("{0}", String(runningCount.value)),
)

/** 在系统浏览器打开输出中的链接（统一走 @/utils/domUtils 的 openExternalUrl） */
function openLogLink(url?: string) {
  if (!url) return
  void openExternalUrl(url)
}

/** 会话日志镜像节流：store 通知高频（每 chunk），写 logText 限频 80ms */
const FLUSH_INTERVAL_MS = 80
const timers = new TimerRegistry()
let syncHandle: number | null = null

function rescan() {
  scanning.value = true
  // scanProjectScripts 内部已兜底（不可用/读取失败返回空结果），此处无需再包 try/catch
  groups.value = scanProjectScripts(resolveValidPath(props.project)).groups
  scanning.value = false
  scanned = true
}

/** 首次展开时识别；已识别过则跳过（重新识别走头部按钮） */
function ensureScanned() {
  if (!scanned) rescan()
}

/** 轻量行状态：不含日志 join，避免高频渲染时逐行重建整段输出 */
function rowState(script: ProjectScript) {
  return stateOf(props.project.id, script.id)
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

// 会话/日志变更 → 节流镜像（收起时不镜像，展开时一次性补齐）
watch(sessionVersion, () => {
  if (props.expanded) scheduleSync()
})

/** 默认接回最近会话（运行中优先）：重新展开即回现场 */
function restoreAttached() {
  if (attachedScriptId.value) return
  const list = sessionsOf(props.project.id)
  const pick = list.find((s) => s.status === "running")
    ?? [...list].sort((a, b) => b.startedAt - a.startedAt)[0]
  if (pick) attachedScriptId.value = pick.script.id
}

watch(() => props.expanded, (open) => {
  if (!open) return
  ensureScanned()
  restoreAttached()
  syncNow(true)
})

/** 点击行接入该会话的输出（运行中实时续传，已结束可回看） */
function attachTo(script: ProjectScript) {
  if (!rowState(script)) return
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

/** 停止当前接入的运行中会话（脚本列表变化后仍可收尾） */
function stopAttached() {
  if (!attachedScriptId.value) return
  store.stop(props.project.id, attachedScriptId.value)
  syncNow(true)
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

/** 控制台头部状态：轻量状态（不触发日志 join），只随状态信号重算 */
const attachedState = computed(() => {
  void statusVersion.value
  return stateOf(props.project.id, attachedScriptId.value)
})

const attachedLabel = computed(() => {
  const ss = attachedState.value
  return ss ? scriptLabel(ss.script.kind, ss.script) : ""
})

const exitLabel = computed(() => {
  const ss = attachedState.value
  if (!ss || ss.status === "running") return ""
  if (ss.status === "stopped") return String(props.i18n.scriptStopped)
  if (ss.exitCode === null) return String(props.i18n.scriptExitSignaled)
  return ss.exitCode === 0
    ? String(props.i18n.scriptExitOk)
    : String(props.i18n.scriptExitFail).replace("{0}", String(ss.exitCode))
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
  if (!props.expanded) return
  ensureScanned()
  restoreAttached()
  syncNow(true)
})

// 卸载只摘视图：进程与日志留在会话表继续跑（显式「停止」才杀进程树）
onBeforeUnmount(() => {
  timers.clearAll()
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/ScriptRunnerPanel.scss";
</style>
