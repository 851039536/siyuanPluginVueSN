<!-- 编辑 Git 项目弹窗（自包含：加载/保存项目资料，链接与远程的即时操作由 composable 承担） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--edit">
      <div class="gp-dialog-header">
        <!-- 弹窗标题："编辑项目 — 项目名" -->
        <span class="gp-dialog-title">{{ i18n.editProjectTitlePrefix }} — {{ project?.name }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs"
          :title="i18n.close"
          @click="$emit('close')"
        >
          <Icon
            icon="mdi:close"
            height="10"
          />
        </button>
      </div>
      <div class="gp-dialog-body">
        <!-- 表单项："项目名称" + "标记" 同行 -->
        <div class="gp-edit-row">
          <Input
            v-model="localName"
            :label="i18n.projectName"
            size="xsmall"
            class="gp-edit-name"
            @keydown.enter="save()"
          />
          <div class="gp-form-group gp-edit-toggles">
            <!-- 标签："标记" -->
            <label class="gp-label">{{ i18n.markLabel }}</label>
            <div class="gp-toggle-row">
              <!-- 切换按钮："收藏" -->
              <button
                class="gp-toggle-chip"
                :class="{ active: localStarred }"
                :aria-pressed="localStarred"
                @click="localStarred = !localStarred"
              >
                <Icon
                  :icon="localStarred ? 'mdi:star' : 'mdi:star-outline'"
                  height="10"
                />{{ i18n.favorite }}
              </button>
              <!-- 切换按钮："归档" -->
              <button
                class="gp-toggle-chip"
                :class="{ active: localArchived }"
                :aria-pressed="localArchived"
                @click="localArchived = !localArchived"
              >
                <Icon
                  icon="mdi:archive-outline"
                  height="10"
                />{{ i18n.archivedShort }}
              </button>
            </div>
          </div>
        </div>

        <!-- 表单项："分类"（保存时仅在实际变化时经 moveProject 持久化） -->
        <Select
          v-model="localCategoryId"
          :label="i18n.category"
          size="xsmall"
          :options="categoryOptions"
        />

        <!-- 表单项："推送账号"（空 = 跟随全局默认；系统配置 = 不套用任何账号） -->
        <div class="gp-form-group">
          <label class="gp-label">
            {{ i18n.pushProfileBound }}
            <span class="gp-label-hint">{{ i18n.pushProfileHint }}</span>
          </label>
          <Select
            v-model="localPushProfileId"
            size="xsmall"
            :options="pushProfileOptions"
          />
        </div>

        <!-- 表单项："备注" -->
        <Textarea
          v-model="localNote"
          :label="i18n.noteLabel"
          size="xsmall"
          :rows="3"
          :placeholder="i18n.notePlaceholder"
        />
        <!-- 表单项："标签"（逗号分隔，用于列表视图的标签筛选） -->
        <Input
          v-model="localTagsText"
          :label="i18n.tagsLabel"
          size="xsmall"
          :placeholder="i18n.tagsPlaceholder"
        />

        <!-- 本地路径区块（多设备路径行，与添加弹窗共用编辑器） -->
        <div class="gp-form-group">
          <!-- 标签："本地路径（跨设备适配）" -->
          <label class="gp-label">{{ i18n.localPathTitle }} <span class="gp-label-hint">{{ i18n.crossDeviceHint }}</span></label>
          <PathRowsEditor
            :rows="allPathsList"
            :i18n="i18n"
            :disabled="cloning"
            @add="addLocalPath"
            @remove="removeLocalPath"
            @pick="pickLocalPath"
            @submit="save()"
          />
        </div>

        <!-- 仓库链接区块（手动输入的平台 URL；修改后立即持久化） -->
        <div class="gp-form-group">
          <!-- 标签："仓库链接（手动输入，用于跨设备持久化）" -->
          <label class="gp-label">{{ i18n.repoLinkLabel }} <span class="gp-label-hint">{{ i18n.repoLinkHint }}{{ i18n.immediateSaveHint }}</span></label>
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
            @copy="copyRepoLink"
            @download="downloadRepoLink"
          />
          <!-- 克隆日志面板：下载时实时显示 git clone 进度输出 -->
          <CloneLogPanel
            :lines="cloneLog.lines.value"
            :running="cloneLog.running.value"
            :i18n="i18n"
            @clear="cloneLog.clear"
          />
        </div>

        <!-- Git 远程仓库区块（从 .git/config 自动检测，可编辑/增删；修改后立即生效） -->
        <div class="gp-form-group">
          <!-- 标签："Git 远程仓库（编辑/增删）" -->
          <label class="gp-label">{{ i18n.gitRemoteLabel }} <span class="gp-label-hint">{{ i18n.immediateSaveHint }}</span></label>
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
            @copy="copyRemoteUrl"
          />
        </div>
      </div>
      <!-- 底部操作栏 -->
      <div class="gp-dialog-footer">
        <HelpPopover :i18n="i18n" />
        <!-- 按钮："取消" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          {{ i18n.cancel }}
        </button>
        <!-- 按钮："保存"（克隆进行中 / 名称或路径为空时禁用） -->
        <button
          class="vp-btn vp-btn--primary vp-btn--sm"
          :disabled="saving || cloning || !localName.trim() || !hasValidPath"
          @click="save"
        >
          {{ i18n.save }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GitProject, GitPushManager, ProjectCategory, PushProfileView } from "../../types"
import { PUSH_PROFILE_SYSTEM_ID } from "../../types"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Textarea from "@/components/Textarea.vue"
import { pickDirectory } from "@/utils/electronDialog"
import { getErrorMessage } from "@/utils/stringUtils"
import { useCloneLog } from "../../composables/useCloneLog"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import { usePathRows } from "../../composables/usePathRows"
import { useProjectRemotes } from "../../composables/useProjectRemotes"
import { useRepoLinks } from "../../composables/useRepoLinks"
import {
  getCurrentDeviceName,
  parseProjectTags,
  resolveValidPathFromPaths,
} from "../../utils"
import CloneLogPanel from "./CloneLogPanel.vue"
import EditableRemoteList from "./EditableRemoteList.vue"
import HelpPopover from "./HelpPopover.vue"
import PathRowsEditor from "./PathRowsEditor.vue"

const props = defineProps<{
  projectId: string
  manager: GitPushManager
  i18n: Record<string, any>
}>()

const emit = defineEmits<{
  close: []
  saved: [] // 通知父组件刷新列表并关闭弹窗
  urlsUpdated: [] // 通知父组件刷新列表（不关闭弹窗）
}>()

// 弹窗打开时自动聚焦遮罩，使 Esc 关闭生效
const { rootRef } = useDialogKeyboard()
void rootRef

// ── 生命周期与异步守卫 ──
const isUnmounted = ref(false)
const cloning = ref(false)
const saving = ref(false)
/** 初始化路径行期间抑制路径 watch（避免与显式 loadRemotes 重复） */
const isInitializingPaths = ref(false)

/** 组件仍挂载时返回 true（异步落点的统一守卫） */
function alive(): boolean {
  return !isUnmounted.value
}

const project = ref<GitProject | null>(null)

// ── 表单本地状态 ──
const localName = ref("")
const localStarred = ref(false)
const localArchived = ref(false)
const localNote = ref("")
const localTagsText = ref("")
const localCategoryId = ref("")
const categories = ref<ProjectCategory[]>([])
const localPushProfileId = ref("")
const pushProfileViews = ref<PushProfileView[]>([])
const defaultPushProfileLabel = ref("")

const categoryOptions = computed(() =>
  categories.value.map((c) => ({ value: c.id, label: c.name })),
)

/** 账号选项：跟随默认 / 系统配置 / 已配置账号（绑定已失效时补占位项，避免下拉显示空白） */
const pushProfileOptions = computed(() => {
  const followLabel = defaultPushProfileLabel.value
    ? props.i18n.pushProfileFollowDefaultLabel.replace("{0}", defaultPushProfileLabel.value)
    : props.i18n.pushProfileFollowDefaultNone
  const options = [
    { value: "", label: followLabel },
    { value: PUSH_PROFILE_SYSTEM_ID, label: props.i18n.pushProfileUseSystem },
    ...pushProfileViews.value.map((p) => ({ value: p.id, label: p.label })),
  ]
  const current = localPushProfileId.value
  if (current && current !== PUSH_PROFILE_SYSTEM_ID && !pushProfileViews.value.some((p) => p.id === current)) {
    options.push({ value: current, label: props.i18n.pushProfileInvalid })
  }
  return options
})

// 本地路径行（共享 composable：增删行、目录选择、载荷构建）
const {
  rows: allPathsList,
  initFrom: initPathRows,
  addRow: addLocalPath,
  removeRow: removeLocalPath,
  pickRow: pickLocalPath,
  hasValidPath,
  toPayload: pathsToPayload,
} = usePathRows(() => props.i18n.selectDir)

/** 路径候选（仓库路径解析与防抖检测共用） */
const pathCandidates = computed(() => allPathsList.value.map((r) => r.path))

// ── 仓库链接（即时持久化）──
const {
  error: repoLinkError,
  rows: repoLinkRows,
  addOptions: linkAddOptions,
  initFrom: initRepoLinks,
  upsert: upsertRepoLink,
  remove: removeRepoLink,
  copy: copyRepoLink,
} = useRepoLinks({
  projectId: () => props.projectId,
  manager: () => props.manager,
  i18n: () => props.i18n,
  alive,
  onUpdated: () => emit("urlsUpdated"),
})

// ── Git 远程仓库（检测 + 即时增删改）──
const {
  rows: remoteRows,
  addOptions: remoteOptions,
  error: remoteError,
  load: loadRemotes,
  add: addRemote,
  update: updateRemoteUrl,
  remove: removeRemote,
  copy: copyRemoteUrl,
  syncAfterSave,
} = useProjectRemotes({
  projectId: () => props.projectId,
  manager: () => props.manager,
  i18n: () => props.i18n,
  alive,
  project: () => project.value,
  getPath: strict => resolveValidPathFromPaths(pathCandidates.value, { strict }),
  pathKey: () => pathCandidates.value.join("\n"),
  enabled: () => !!project.value && !isInitializingPaths.value,
})

// 克隆实时日志（\r 进度行原地刷新由 composable 解析）
const cloneLog = useCloneLog()

/**
 * 下载（克隆）仓库链接：选目录 → 克隆 → 由 manager 按持久化数据并入项目路径。
 * 克隆编排在 manager 内完成，弹窗中途关闭也不会丢失结果；本方法只负责日志与行内 UI 同步。
 */
async function downloadRepoLink(platform: string): Promise<boolean> {
  const url = repoLinkRows.value.find((r) => r.key === platform)?.url ?? ""
  if (!url) {
    return false
  }
  const dir = await pickDirectory(props.i18n.selectCloneDir)
  if (!dir || !alive()) {
    return false
  }
  repoLinkError.value = ""
  cloneLog.start(`$ git clone --progress ${url}`)
  cloning.value = true
  try {
    const { path: clonedPath, persisted } = await props.manager.cloneRepoToProject(
      props.projectId,
      dir,
      url,
      (chunk) => {
        if (alive()) {
          cloneLog.append(chunk)
        }
      },
    )
    if (!alive()) {
      // 弹窗已关闭：manager 已完成路径落库，无需再更新 UI
      return persisted
    }
    if (!persisted) {
      const persistErr = props.i18n.errSavePathsFailed
      repoLinkError.value = persistErr
      cloneLog.finish(`${persistErr}: ${clonedPath}`)
      return false
    }
    // 同步到当前路径行（持久化已由 manager 完成，避免草稿覆盖）
    allPathsList.value.push({ path: clonedPath, device: getCurrentDeviceName() })
    emit("urlsUpdated")
    const doneMsg = props.i18n.cloneSuccess.replace("{0}", clonedPath)
    cloneLog.finish(doneMsg)
    showMessage(doneMsg, 4000, "info")
    return true
  } catch (e: unknown) {
    const errMsg = getErrorMessage(e) || props.i18n.errCloneRepo
    if (alive()) {
      repoLinkError.value = errMsg
      cloneLog.finish(`${props.i18n.errCloneRepo}: ${errMsg}`)
    }
    return false
  } finally {
    if (alive()) {
      cloning.value = false
    }
  }
}

// ── 初始化：从 manager 加载项目数据 ──
onMounted(async () => {
  try {
    const p = await props.manager.getProjectById(props.projectId)
    if (!p) {
      emit("close")
      return
    }
    project.value = p
    localName.value = p.name
    localStarred.value = !!p.starred
    localArchived.value = !!p.archived
    localNote.value = p.note || ""
    localTagsText.value = (p.tags || []).join(", ")
    localCategoryId.value = p.categoryId
    localPushProfileId.value = p.pushProfileId || ""
    initRepoLinks(p)
    // 路径行填充后等一次 watch 刷新再放开自动检测，由下方显式 loadRemotes 完成初始检测
    isInitializingPaths.value = true
    initPathRows(p.path, p.localPaths, p.pathDevices)
    await nextTick()
    isInitializingPaths.value = false
    // 远程检测与分类 / 账号加载互不依赖，并行执行；分类与账号失败不阻塞弹窗打开
    const catsPromise = props.manager.getCategories().catch(() => [] as ProjectCategory[])
    const profilesPromise = props.manager.getPushProfileViews().catch(() => [] as PushProfileView[])
    const defaultLabelPromise = props.manager.getDefaultPushProfileLabel().catch(() => "")
    await loadRemotes()
    const [cats, profiles, defaultLabel] = await Promise.all([catsPromise, profilesPromise, defaultLabelPromise])
    categories.value = cats
    pushProfileViews.value = profiles
    defaultPushProfileLabel.value = defaultLabel
  } catch (e: unknown) {
    if (alive()) {
      showMessage(getErrorMessage(e) || props.i18n.errSaveProject, 4000, "error")
      emit("close")
    }
  }
})

onUnmounted(() => {
  isUnmounted.value = true
})

// ── 保存 ──
/** 由实时路径行构建持久化载荷（无有效路径时返回 null，由调用方拦截） */
function buildPathPatch() {
  const payload = pathsToPayload()
  if (!payload) {
    return null
  }
  return {
    path: payload.path,
    localPaths: payload.localPaths,
    pathDevices: payload.pathDevices,
  }
}

async function save(): Promise<void> {
  if (!project.value || saving.value || cloning.value) {
    return
  }
  const name = localName.value.trim()
  if (!name) {
    showMessage(props.i18n.errNeedName, 3000, "error")
    return
  }
  const pathPatch = buildPathPatch()
  if (!pathPatch) {
    showMessage(props.i18n.errNeedPath, 3000, "error")
    return
  }
  saving.value = true
  try {
    const updated = await props.manager.updateProjectMeta(props.projectId, {
      name,
      starred: localStarred.value,
      archived: localArchived.value,
      note: localNote.value,
      tags: parseProjectTags(localTagsText.value),
      pushProfileId: localPushProfileId.value,
      ...pathPatch,
    })
    if (!updated) {
      showMessage(props.i18n.errSaveProject, 4000, "error")
      return
    }
    if (!alive()) {
      return
    }
    // 分类变更：主资料已保存成功，此处失败只提示为部分成功，不误报整体失败
    if (localCategoryId.value !== project.value.categoryId) {
      try {
        await props.manager.moveProject(props.projectId, localCategoryId.value)
      } catch {
        showMessage(props.i18n.errMoveCategoryPartial, 4000, "error")
      }
    }
    // 保存后同步远程映射：失败不阻塞关闭，但需提示，避免映射与实际 .git/config 不一致
    const synced = await syncAfterSave(pathPatch.path)
    if (!synced) {
      showMessage(props.i18n.errRefreshRemotes, 4000, "error")
    }
    if (!alive()) {
      return
    }
    emit("saved")
  } catch (e: unknown) {
    showMessage(getErrorMessage(e) || props.i18n.errSaveProject, 4000, "error")
  } finally {
    if (alive()) {
      saving.value = false
    }
  }
}
</script>
