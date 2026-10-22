<!-- gitPush 项目脚本弹窗：识别前端/.NET/脚本文件命令并点击运行 -->
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
                :class="{ 'gp-sr-row--running': runningId === s.id }"
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
                <!-- 悬停提示："运行" / "停止" -->
                <Button
                  v-if="runningId !== s.id"
                  variant="ghost"
                  size="xsmall"
                  dense
                  icon="play"
                  :title="i18n.scriptRun"
                  :disabled="!!runningId"
                  @click="runScript(s)"
                />
                <Button
                  v-else
                  variant="ghost"
                  size="xsmall"
                  dense
                  icon="stop"
                  :title="i18n.scriptStop"
                  @click="stopScript"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- 运行输出 -->
        <div class="gp-sr-console-wrap">
          <div class="gp-sr-console-head">
            <span class="gp-sr-console-title">{{ i18n.scriptOutput }}</span>
            <span
              v-if="runningId"
              class="gp-sr-status gp-sr-status--running"
            >{{ i18n.scriptRunning }}</span>
            <span
              v-else-if="exitLabel"
              class="gp-sr-status"
              :class="{ 'gp-sr-status--fail': exitCode !== 0 }"
            >{{ exitLabel }}</span>
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
            ref="consoleEl"
            class="gp-sr-console"
          >
            <pre>{{ logText }}</pre>
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
// gitPush 项目脚本弹窗：自扫描脚本命令、单条运行 + 流式日志、停止杀进程树
import type { ScriptGroup, ScriptKind, ProjectScript } from "../../types/scripts"
import { Icon } from "@iconify/vue"
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"
import { DOTNET_VERB_KEYS } from "../../types/scripts"
import { resolveValidPath, scanProjectScripts } from "../../utils"
import { runProjectScript, type ScriptRunHandle } from "../../managers/ScriptExecutor"
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

const scanning = ref(false)
const groups = ref<ScriptGroup[]>([])
const runningId = ref("")
const logText = ref("")
const exitCode = ref<number | null>(null)
const stopped = ref(false)
const consoleEl = ref<HTMLElement | null>(null)
let handle: ScriptRunHandle | null = null
/** 防 error/exit 双事件重复收尾 */
let finished = true

/** 日志展示上限与保留水位（超出裁掉头部，防长时间运行把内存吃满） */
const LOG_CAP = 300_000
const LOG_KEEP = 250_000
/** 输出节流间隔：块缓冲 + 定时合并刷新，避免逐 chunk 全量重渲染 */
const FLUSH_INTERVAL_MS = 80
const timers = new TimerRegistry()
let logChunks: string[] = []
let logLen = 0
let flushHandle: number | null = null

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

/** 输出先进块缓冲，由定时器合并刷新（高频输出下避免 O(n) 字符串拷贝与逐块重排） */
function appendLog(chunk: string) {
  if (!chunk) return
  logChunks.push(chunk)
  logLen += chunk.length
  if (logLen > LOG_CAP) trimBuffer()
  if (flushHandle === null) {
    flushHandle = timers.setTimeout(() => {
      flushHandle = null
      flushLog()
    }, FLUSH_INTERVAL_MS)
  }
}

/** 裁掉旧块，尾部保留 LOG_KEEP 字符 */
function trimBuffer() {
  while (logLen > LOG_KEEP && logChunks.length > 1) {
    logLen -= logChunks.shift()!.length
  }
  if (logChunks.length === 1 && logLen > LOG_KEEP) {
    logChunks[0] = logChunks[0].slice(logLen - LOG_KEEP)
    logLen = LOG_KEEP
  }
}

/** 合并缓冲写入 logText 并滚到底（每 ~80ms 一次，而非每 chunk 一次） */
function flushLog() {
  if (logChunks.length === 0) return
  logText.value += logChunks.join("")
  logChunks = []
  logLen = 0
  if (logText.value.length > LOG_CAP) {
    logText.value = logText.value.slice(logText.value.length - LOG_KEEP)
  }
  void nextTick(() => {
    const el = consoleEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function clearLog() {
  timers.clear(flushHandle)
  flushHandle = null
  logChunks = []
  logLen = 0
  logText.value = ""
  exitCode.value = null
  stopped.value = false
}

function runScript(script: ProjectScript) {
  if (runningId.value) return
  clearLog()
  runningId.value = script.id
  finished = false
  appendLog(`> ${script.preview}\n`)
  handle = runProjectScript(script, {
    onOutput: appendLog,
    onExit: (code) => {
      if (finished) return
      finished = true
      runningId.value = ""
      handle = null
      flushLog()
      exitCode.value = code
    },
  })
  if (!handle) {
    finished = true
    runningId.value = ""
  }
}

function stopScript() {
  if (!handle) return
  stopped.value = true
  try {
    handle.kill()
  } catch { /* 已退出 */ }
  handle = null
  flushLog()
  // 进程树终止后 exit 事件不一定回来，直接收尾保证 UI 可再运行
  if (!finished) {
    finished = true
    runningId.value = ""
  }
}

function handleClose() {
  stopScript()
  emit("close")
}

const exitLabel = computed(() => {
  if (runningId.value || exitCode.value === null) return ""
  if (stopped.value) return String(props.i18n.scriptStopped)
  return exitCode.value === 0
    ? String(props.i18n.scriptExitOk)
    : String(props.i18n.scriptExitFail).replace("{0}", String(exitCode.value))
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

onMounted(rescan)
onBeforeUnmount(() => {
  stopScript()
  timers.clearAll()
})
</script>

<style lang="scss" scoped>
@use "../../styles/ScriptRunnerDialog";
</style>
