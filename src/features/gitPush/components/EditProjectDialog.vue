<!-- 编辑 Git 项目弹窗（自包含：自行加载/保存/远程操作） -->
<template>
  <div
    class="gp-mask"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--edit">
      <div class="gp-dialog-header">
        <!-- 弹窗标题："编辑项目 — 项目名" -->
        <span class="gp-dialog-title">{{ i18n.editProjectTitlePrefix }} — {{ project?.name }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <!-- 表单项："项目名称" -->
        <Input
          v-model="localName"
          :label="i18n.projectName"
          size="xsmall"
          @keydown.enter="save()"
        />
        <div class="gp-edit-row">
          <div class="gp-grow">
            <!-- 表单项："状态" -->
            <Select
              v-model="localStatus"
              :label="i18n.statusLabel"
              size="xsmall"
              :options="statusOptions"
            />
          </div>
          <div class="gp-form-group gp-edit-toggles">
            <!-- 标签："标记" -->
            <label class="gp-label">{{ i18n.markLabel }}</label>
            <div class="gp-toggle-row">
              <!-- 切换按钮："收藏" -->
              <button
                class="gp-toggle-chip"
                :class="{ active: localStarred }"
                @click="localStarred = !localStarred"
              >
                <Icon
                  :icon="localStarred ? 'mdi:star' : 'mdi:star-outline'"
                  height="12"
                />{{ i18n.favorite }}
              </button>
              <!-- 切换按钮："归档" -->
              <button
                class="gp-toggle-chip"
                :class="{ active: localArchived }"
                @click="localArchived = !localArchived"
              >
                <Icon
                  icon="mdi:archive-outline"
                  height="12"
                />{{ i18n.archivedShort }}
              </button>
            </div>
          </div>
        </div>

        <!-- 表单项："备注" -->
        <Input
          v-model="localNote"
          type="textarea"
          :label="i18n.noteLabel"
          size="xsmall"
          :rows="3"
          :placeholder="i18n.notePlaceholder"
        />
        <!-- 本地路径区块（多设备路径行） -->
        <div class="gp-form-group">
          <!-- 标签："本地路径（跨设备适配）" -->
          <label class="gp-label">{{ i18n.localPathTitle }} <span class="gp-label-hint">{{ i18n.crossDeviceHint }}</span></label>
          <div class="gp-edit-paths">
            <div
              v-for="(entry, idx) in allPathsList"
              :key="idx"
              class="gp-edit-path-row"
            >
              <Input
                v-model="entry.path"
                size="xsmall"
                :placeholder="i18n.devicePathPlaceholder.replace('{0}', String(idx + 1))"
              />
              <!-- 设备电脑名（可选）：占位符"电脑名（可选）"，新增路径时自动填入当前主机名 -->
              <div class="gp-path-device">
                <Input
                  v-model="entry.device"
                  size="xsmall"
                  :placeholder="i18n.deviceNamePlaceholder"
                />
              </div>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                :title="i18n.selectDir"
                @click="pickLocalPath(idx)"
              >
                <Icon icon="mdi:folder-outline" height="12" />
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                :title="i18n.removePath"
                :disabled="allPathsList.length <= 1"
                @click="removeLocalPath(idx)"
              >
                <Icon icon="mdi:delete-outline" height="12" />
              </button>
            </div>
          </div>
          <!-- 按钮："添加本地路径" -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-add-path-btn"
            @click="addLocalPath"
          >
            <Icon icon="mdi:plus" height="12" />
            <span>{{ i18n.addLocalPath }}</span>
          </button>
        </div>
        <!-- 仓库链接区块（手动输入的平台 URL，持久化存储） -->
        <div class="gp-form-group">
          <!-- 标签："仓库链接（手动输入，用于跨设备持久化）" -->
          <label class="gp-label">{{ i18n.repoLinkLabel }} <span class="gp-label-hint">{{ i18n.repoLinkHint }}</span></label>
          <EditableRemoteList
            :rows="repoLinkRows"
            :add-options="linkAddOptions"
            :empty-text="i18n.noRepoLinks"
            :url-placeholder="i18n.repoUrlPlaceholder"
            :error="repoLinkError"
            :i18n="i18n"
            @add="upsertRepoLink"
            @saveEdit="upsertRepoLink"
            @remove="removeRepoLink"
            @download="downloadRepoLink"
          />
        </div>
        <!-- Git 远程仓库区块（从 .git/config 自动检测，可编辑/增删） -->
        <div class="gp-form-group">
          <!-- 标签："Git 远程仓库（编辑/增删）" -->
          <label class="gp-label">{{ i18n.gitRemoteLabel }}</label>
          <EditableRemoteList
            :rows="remoteRows"
            :add-options="remoteOptions"
            :empty-text="i18n.noRemotes"
            :url-placeholder="i18n.remoteUrlPlaceholder"
            :error="remoteError"
            :i18n="i18n"
            @add="addRemote"
            @saveEdit="updateRemoteUrl"
            @remove="removeRemote"
          />
        </div>
      </div>
      <!-- 底部操作栏 -->
      <div class="gp-dialog-footer">
        <div class="gp-help-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-help-btn"
            :title="i18n.help"
            @click="showHelp = !showHelp"
          >
            <Icon icon="mdi:help-circle-outline" height="12" />
          </button>
          <!-- 帮助说明弹层 -->
          <div
            v-if="showHelp"
            class="gp-help-popover"
            @click.stop
          >
            <div class="gp-help-header">
              <Icon icon="mdi:information-outline" height="12" />
              <!-- 弹层标题："帮助说明" -->
              <span>{{ i18n.help }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm gp-help-close"
                @click="showHelp = false"
              >
                <Icon icon="mdi:close" height="12" />
              </button>
            </div>
            <div class="gp-help-body">
              <div
                v-for="item in helpItems"
                :key="item.icon"
                class="gp-help-item"
              >
                <Icon :icon="item.icon" height="12" class="gp-help-item-icon" />
                <!-- 帮助条目正文（本地路径/仓库链接/Git 远程/数据持久化说明） -->
                <p>{{ item.text }}</p>
              </div>
            </div>
            <div class="gp-help-footer">
              <!-- 按钮："知道了" -->
              <button
                class="vp-btn vp-btn--primary vp-btn--sm"
                @click="showHelp = false"
              >
                {{ i18n.gotIt }}
              </button>
            </div>
          </div>
        </div>
        <!-- 按钮："取消" -->
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.cancel }}
        </button>
        <!-- 按钮："保存" -->
        <button
          class="vp-btn vp-btn--primary"
          @click="save"
        >
          {{ i18n.save }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  GitProject,
  GitPushManager,
  GitRemoteInfo,
  ProjectStatus,
} from "../types"
import { PLATFORM_META, REMOTES, STATUS_CYCLE, STATUS_META } from "../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue"
import Input from "@/components/Input.vue"
import type { SelectOption } from "@/components/Select.vue"
import Select from "@/components/Select.vue"
import type { RemoteRowItem } from "./EditableRemoteList.vue"
import EditableRemoteList from "./EditableRemoteList.vue"
import { getCurrentDeviceName, hasPlatformRemote, resolveValidPath } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"
import { pickDirectory } from "@/utils/electronDialog"
import { usePathRows } from "../composables/usePathRows"


const props = defineProps<{
  projectId: string
  manager: GitPushManager
  i18n: Record<string, any>
}>()

const statusOptions = computed<SelectOption[]>(() =>
  STATUS_CYCLE.map((s) => ({ value: s, label: STATUS_META[s].label })),
)

const emit = defineEmits<{
  "close": []
  "saved": [] // 通知父组件刷新列表并关闭弹窗
  "urlsUpdated": [] // 通知父组件刷新列表（不关闭弹窗）
}>()

// ── 项目数据（从 manager 加载） ──
const project = ref<GitProject | null>(null)
const remoteList = ref<GitRemoteInfo[]>([])
const remoteError = ref("")

// ── 表单本地状态 ──
const localName = ref("")
const localStatus = ref<ProjectStatus>("active")
const localStarred = ref(false)
const localArchived = ref(false)
const localNote = ref("")
// 平台 URL 输入（键由 PLATFORM_META.urlProp 单一数据源驱动，避免四处硬编码键名）
const urlInputs = reactive<Record<string, string>>(
  Object.fromEntries(PLATFORM_META.map((pl) => [pl.urlProp, ""])),
)
// 本地路径行（共享 composable：增删行、目录选择、载荷构建）
const {
  rows: allPathsList,
  initFrom: initPathRows,
  addRow: addLocalPath,
  removeRow: removeLocalPath,
  pickRow: pickLocalPath,
  toPayload: pathsToPayload,
} = usePathRows(() => props.i18n.selectLocalPath)
const showHelp = ref(false)

// ── 仓库链接（EditableRemoteList 数据源与操作回调）──
const repoLinkError = ref("")

const repoLinkRows = computed<RemoteRowItem[]>(() =>
  PLATFORM_META
    .filter((pl) => urlInputs[pl.urlProp])
    .map((pl) => ({
      key: pl.key,
      name: pl.label,
      icon: pl.icon,
      url: urlInputs[pl.urlProp],
    })),
)

// 平台下拉仅列出尚未配置 URL 的平台
const linkAddOptions = computed<SelectOption[]>(() =>
  PLATFORM_META
    .filter((pl) => !urlInputs[pl.urlProp])
    .map((pl) => ({ value: pl.key, label: `${pl.label}${props.i18n.notConfiguredSuffix}` })),
)

/** 将 urlInputs 全量持久化，返回是否成功（失败写入 repoLinkError） */
async function persistUrls(): Promise<boolean> {
  if (!project.value) { return false }
  try {
    const patch: Partial<Pick<GitProject, "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl">> = {}
    for (const pl of PLATFORM_META) { patch[pl.urlProp] = urlInputs[pl.urlProp] || undefined }
    await props.manager.updateProjectMeta(props.projectId, patch)
    repoLinkError.value = ""
    emit("urlsUpdated")
    return true
  } catch (e: unknown) {
    repoLinkError.value = getErrorMessage(e) || props.i18n.errSaveRepoLinks
    return false
  }
}

/** 添加与编辑共用：写入平台 URL 后持久化 */
async function upsertRepoLink(platform: string, url: string): Promise<boolean> {
  const pl = PLATFORM_META.find((p) => p.key === platform)
  if (!pl) { return false }
  urlInputs[pl.urlProp] = url
  return persistUrls()
}

async function removeRepoLink(platform: string): Promise<boolean> {
  return upsertRepoLink(platform, "")
}

/** 下载（克隆）仓库链接：选目录 → clone 到同名子目录 → 新路径追加到路径行并立即持久化 */
async function downloadRepoLink(platform: string): Promise<boolean> {
  const pl = PLATFORM_META.find((p) => p.key === platform)
  const url = pl ? urlInputs[pl.urlProp] : ""
  if (!url) { return false }
  const dir = await pickDirectory(props.i18n.selectCloneDir)
  if (!dir) { return false }
  repoLinkError.value = ""
  try {
    const clonedPath = await props.manager.cloneRepo(dir, url)
    allPathsList.value.push({ path: clonedPath, device: getCurrentDeviceName() })
    // 立即持久化全部路径行（首行为主路径），并通知父组件刷新列表
    const payload = pathsToPayload()
    if (payload) {
      await props.manager.updateProjectMeta(props.projectId, {
        path: payload.path,
        localPaths: payload.localPaths,
        pathDevices: payload.pathDevices,
      })
    }
    emit("urlsUpdated")
    return true
  } catch (e: unknown) {
    repoLinkError.value = getErrorMessage(e) || props.i18n.errCloneRepo
    return false
  }
}

// ── Git 远程仓库（EditableRemoteList 数据源与操作回调）──
const remoteRows = computed<RemoteRowItem[]>(() =>
  remoteList.value.map((r) => ({ key: r.name, name: r.name, url: r.url })),
)

// 平台下拉仅列出尚未添加的平台（已存在的远程如 GitHub 不允许重复添加）
const remoteOptions = computed<SelectOption[]>(() =>
  REMOTES
    .filter((r) => !hasPlatformRemote(remoteList.value, r.key))
    .map((r) => ({ value: r.key, label: r.label })),
)

async function loadRemotes() {
  if (!project.value) return
  try {
    const path = resolveValidPath(project.value)
    remoteList.value = await props.manager.detectRemotes(path)
    remoteError.value = ""
  } catch (e: unknown) {
    remoteError.value = getErrorMessage(e) || props.i18n.errDetectRemotes
  }
}

/** 统一远程操作骨架：清错 → 执行 → 重新检测 + 刷新项目远程映射，失败写入 remoteError，返回是否成功 */
async function runRemoteOp(fallbackMsg: string, op: (repoPath: string) => Promise<void>): Promise<boolean> {
  if (!project.value) { return false }
  remoteError.value = ""
  try {
    await op(resolveValidPath(project.value))
    await loadRemotes()
    await props.manager.refreshRemotes(props.projectId)
    return true
  } catch (e: unknown) {
    remoteError.value = getErrorMessage(e) || fallbackMsg
    return false
  }
}

function addRemote(name: string, url: string): Promise<boolean> {
  return runRemoteOp(props.i18n.errAddRemote, (repoPath) => props.manager.addRemote(repoPath, name, url))
}

function updateRemoteUrl(name: string, url: string): Promise<boolean> {
  return runRemoteOp(props.i18n.errUpdateRemote, (repoPath) => props.manager.setRemoteUrl(repoPath, name, url))
}

function removeRemote(name: string): Promise<boolean> {
  return runRemoteOp(props.i18n.errRemoveRemote, (repoPath) => props.manager.removeRemote(repoPath, name))
}

// ── 帮助项（文案来自 i18n 分片 gitPush.json 的 help* 键）──
const helpItems = computed(() => [
  { icon: "mdi:folder-outline", text: props.i18n.helpLocalPaths },
  { icon: "mdi:link-variant", text: props.i18n.helpRepoLinks },
  { icon: "mdi:source-repository", text: props.i18n.helpGitRemotes },
  { icon: "mdi:database-outline", text: props.i18n.helpPersistence },
])

// ── 初始化：从 manager 加载项目数据 ──
onMounted(async () => {
  const projects = await props.manager.getProjects()
  const p = projects.find((pr) => pr.id === props.projectId)
  if (!p) {
    emit("close")
    return
  }
  project.value = p
  // 填充表单
  localName.value = p.name
  localStatus.value = p.status || "active"
  localStarred.value = !!p.starred
  localArchived.value = !!p.archived
  localNote.value = p.note || ""
  // 平台 URL 由 PLATFORM_META 单一数据源驱动回填
  for (const pl of PLATFORM_META) { urlInputs[pl.urlProp] = p[pl.urlProp] || "" }
  initPathRows(p.path, p.localPaths, p.pathDevices)
  // 检测远程仓库
  await loadRemotes()
})

// ── 保存 ──
async function save() {
  if (!project.value) { return }
  const payload = pathsToPayload()
  await props.manager.updateProjectMeta(props.projectId, {
    name: localName.value.trim() || project.value.name,
    status: localStatus.value,
    starred: localStarred.value,
    archived: localArchived.value,
    note: localNote.value,
    // 全部路径行为空时保留原主路径
    path: payload?.path ?? project.value.path,
    localPaths: payload?.localPaths,
    pathDevices: payload?.pathDevices,
  })
  emit("saved")
}
</script>
