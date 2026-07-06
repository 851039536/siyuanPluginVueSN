<!-- 编辑 Git 项目弹窗（自包含：自行加载/保存/远程操作） -->
<template>
  <div
    class="gp-mask"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 580px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">编辑项目 — {{ project?.name }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <Input
          v-model="localName"
          label="项目名称"
          size="small"
          @keydown="$event.key === 'Enter' && save()"
        />
        <div class="gp-edit-row">
          <div style="flex:1">
            <Select
              v-model="localStatus"
              label="状态"
              size="small"
              :options="statusOptions"
            />
          </div>
          <div class="gp-form-group gp-edit-toggles">
            <label class="gp-label">标记</label>
            <div class="gp-toggle-row">
              <button
                class="gp-toggle-chip"
                :class="{ active: localStarred }"
                @click="localStarred = !localStarred"
              >
                <Icon
                  :icon="localStarred ? 'mdi:star' : 'mdi:star-outline'"
                  height="12"
                />收藏
              </button>
              <button
                class="gp-toggle-chip"
                :class="{ active: localArchived }"
                @click="localArchived = !localArchived"
              >
                <Icon
                  icon="mdi:archive-outline"
                  height="12"
                />归档
              </button>
            </div>
          </div>
        </div>

        <Input
          v-model="localNote"
          type="textarea"
          label="备注"
          size="small"
          :rows="3"
          placeholder="项目备注（可选）"
        />
        <div class="gp-form-group">
          <label class="gp-label">本地路径 <span class="gp-label-hint">（跨设备适配）</span></label>
          <div class="gp-edit-paths">
            <div
              v-for="(_lp, idx) in allPathsList"
              :key="idx"
              class="gp-edit-path-row"
            >
              <Input
                v-model="allPathsList[idx]"
                size="small"
                :placeholder="`设备 ${idx + 1} 的本地路径...`"
              />
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="选择目录"
                @click="pickLocalPath(idx)"
              >
                <Icon icon="mdi:folder-outline" height="12" />
              </button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="移除此路径"
                :disabled="allPathsList.length <= 1"
                @click="removeLocalPath(idx)"
              >
                <Icon icon="mdi:delete-outline" height="12" />
              </button>
            </div>
          </div>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-add-path-btn"
            @click="addLocalPath"
          >
            <Icon icon="mdi:plus" height="12" />
            <span>{{ i18n.addLocalPath || '添加路径' }}</span>
          </button>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">仓库链接</label>
          <div
            v-if="repoLinkList.length"
            class="gp-remote-list"
          >
            <div
              v-for="link in repoLinkList"
              :key="link.key"
              class="gp-remote-row"
            >
              <Icon
                :icon="link.icon"
                height="12"
              />
              <span class="gp-remote-name">{{ link.label }}</span>
              <template v-if="editLinkPlatform === link.key">
                <Input
                  v-model="editLinkUrl"
                  size="small"
                  style="flex:1"
                  @keydown="$event.key === 'Enter' && saveRepoLinkEdit(link)"
                  @keydown.escape="cancelRepoLinkEdit()"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveRepoLinkEdit(link)"
                >
                  保存
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  @click="cancelRepoLinkEdit()"
                >
                  取消
                </button>
              </template>
              <template v-else>
                <span
                  class="gp-remote-url"
                  :title="link.url"
                >{{ link.url }}</span>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  @click="editLinkPlatform = link.key; editLinkUrl = link.url"
                >
                  编辑
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                  @click="handleDeleteRepoLink(link.urlProp)"
                >
                  删除
                </button>
              </template>
            </div>
          </div>
          <div
            v-else
            class="gp-remote-empty"
          >
            暂无仓库链接
          </div>
          <div
            v-if="linkAddOptions.length > 0"
            class="gp-remote-add"
            style="margin-top:4px"
          >
            <Select
              v-model="newLinkPlatform"
              size="small"
              style="width:130px"
              :options="linkAddOptions"
              placeholder="选择平台"
            />
            <Input
              v-model="newLinkUrl"
              size="small"
              placeholder="仓库 URL"
              style="flex:1"
              @keydown="$event.key === 'Enter' && handleAddRepoLink()"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newLinkPlatform || !newLinkUrl.trim()"
              @click="handleAddRepoLink"
            >
              添加
            </button>
          </div>
          <div
            v-if="repoLinkError"
            class="gp-error"
            style="margin-top:4px"
          >
            {{ repoLinkError }}
          </div>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">Git 远程仓库（编辑/增删）</label>
          <div
            v-if="remoteList.length"
            class="gp-remote-list"
          >
            <div
              v-for="r in remoteList"
              :key="r.name"
              class="gp-remote-row"
            >
              <span class="gp-remote-name">{{ r.name }}</span>
              <template v-if="editRemoteName === r.name">
                <Input
                  v-model="editRemoteUrl"
                  size="small"
                  style="flex:1"
                  @keydown="$event.key === 'Enter' && saveRemoteEdit(r.name)"
                  @keydown.escape="editRemoteName = ''"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveRemoteEdit(r.name)"
                >
                  保存
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  @click="editRemoteName = ''"
                >
                  取消
                </button>
              </template>
              <template v-else>
                <span
                  class="gp-remote-url"
                  :title="r.url"
                >{{ r.url }}</span>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  @click="editRemoteName = r.name; editRemoteUrl = r.url"
                >
                  编辑
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                  @click="handleRemoveRemote(r.name)"
                >
                  删除
                </button>
              </template>
            </div>
          </div>
          <div
            v-else
            class="gp-remote-empty"
          >
            暂无远程仓库
          </div>
          <div
            class="gp-remote-add"
            style="margin-top:4px"
          >
            <Select
              v-model="newRemoteName"
              size="small"
              style="width:130px"
              :options="remoteOptions"
              placeholder="选择平台"
            />
            <Input
              v-model="newRemoteUrl"
              size="small"
              placeholder="远程 URL"
              style="flex:1"
              @keydown="$event.key === 'Enter' && handleAddRemote()"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newRemoteName || !newRemoteUrl.trim()"
              @click="handleAddRemote"
            >
              添加
            </button>
          </div>
          <div
            v-if="remoteError"
            class="gp-error"
            style="margin-top:4px"
          >
            {{ remoteError }}
          </div>
        </div>
      </div>
      <div class="gp-dialog-footer">
        <div class="gp-help-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-help-btn"
            :title="isZh ? '帮助说明' : 'Help'"
            @click="showHelp = !showHelp"
          >
            <Icon icon="mdi:help-circle-outline" height="12" />
          </button>
          <div
            v-if="showHelp"
            class="gp-help-popover"
            @click.stop
          >
            <div class="gp-help-header">
              <Icon icon="mdi:information-outline" height="12" />
              <span>{{ isZh ? '帮助说明' : 'Help' }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                style="margin-left:auto"
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
                <p>{{ isZh ? item.textZh : item.textEn }}</p>
              </div>
            </div>
            <div class="gp-help-footer">
              <button
                class="vp-btn vp-btn--primary vp-btn--sm"
                @click="showHelp = false"
              >
                {{ isZh ? '知道了' : 'Got it' }}
              </button>
            </div>
          </div>
        </div>
        <button
          class="vp-btn vp-btn--ghost"
          @click="$emit('close')"
        >
          {{ i18n.cancel || '取消' }}
        </button>
        <button
          class="vp-btn vp-btn--primary"
          @click="save"
        >
          {{ i18n.save || '保存' }}
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
import { resolveValidPath } from "../utils"
import { pickDirectory } from "../composables/useDirectoryPicker"


const props = defineProps<{
  projectId: string
  manager: GitPushManager
  i18n: Record<string, any>
}>()

const statusOptions = computed<SelectOption[]>(() =>
  STATUS_CYCLE.map((s) => ({ value: s, label: STATUS_META[s].label })),
)

const remoteOptions = computed<SelectOption[]>(() =>
  REMOTES.map((r) => ({ value: r.key, label: r.label })),
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
const localStatus = ref("active")
const localStarred = ref(false)
const localArchived = ref(false)
const localNote = ref("")
const urlInputs = reactive<Record<string, string>>({
  githubUrl: "",
  giteeUrl: "",
  giteaUrl: "",
  cnbUrl: "",
})
const allPathsList = ref<string[]>([])
const newRemoteName = ref("github")
const newRemoteUrl = ref("")
const editRemoteName = ref("")
const editRemoteUrl = ref("")
const showHelp = ref(false)

// ── 仓库链接列表操作 ──
const repoLinkError = ref("")
const editLinkPlatform = ref("")
const editLinkUrl = ref("")
const newLinkPlatform = ref("")
const newLinkUrl = ref("")

const repoLinkList = computed(() =>
  PLATFORM_META
    .filter((pl) => urlInputs[pl.urlProp])
    .map((pl) => ({
      key: pl.key,
      icon: pl.icon,
      label: pl.label,
      urlProp: pl.urlProp,
      url: urlInputs[pl.urlProp],
    })),
)

const availablePlatforms = computed(() =>
  PLATFORM_META.filter((pl) => !urlInputs[pl.urlProp]),
)

const linkAddOptions = computed<SelectOption[]>(() =>
  availablePlatforms.value.map((pl) => ({
    value: pl.key,
    label: `${pl.label}（未配置）`,
  })),
)

async function persistUrls() {
  if (!project.value) { return }
  try {
    await props.manager.updateProjectMeta(props.projectId, {
      githubUrl: urlInputs.githubUrl || undefined,
      giteeUrl: urlInputs.giteeUrl || undefined,
      giteaUrl: urlInputs.giteaUrl || undefined,
      cnbUrl: urlInputs.cnbUrl || undefined,
    })
    repoLinkError.value = ""
    emit("urlsUpdated")
  } catch (e: any) {
    repoLinkError.value = e?.message || "保存仓库链接失败"
  }
}

async function handleAddRepoLink() {
  const pl = PLATFORM_META.find((p) => p.key === newLinkPlatform.value)
  if (!pl) { return }
  urlInputs[pl.urlProp] = newLinkUrl.value.trim()
  await persistUrls()
  newLinkPlatform.value = ""
  newLinkUrl.value = ""
  const next = availablePlatforms.value[0]
  if (next) { newLinkPlatform.value = next.key }
}

async function handleDeleteRepoLink(urlProp: string) {
  urlInputs[urlProp] = ""
  await persistUrls()
}

async function saveRepoLinkEdit(link: { key: string; urlProp: string; url: string }) {
  urlInputs[link.urlProp] = editLinkUrl.value
  await persistUrls()
  editLinkPlatform.value = ""
}

function cancelRepoLinkEdit() {
  editLinkPlatform.value = ""
}

// ── 语言检测 ──
const isZh = computed(() => (props.i18n.cancel || '取消') === '取消')

// ── 帮助项 ──
const helpItems = [
  {
    icon: 'mdi:folder-outline',
    textZh: '🗂️ 本地路径（跨设备适配）\n为同一项目配置多台电脑上的本地路径。Git 操作时会按顺序检测，自动使用第一个存在的有效路径。例如：家里电脑路径 E:\\projects\\repo，公司电脑路径 D:\\work\\repo，无需手动切换。路径可随时编辑、删除、新增，至少保留一个。',
    textEn: '🗂️ Local Paths (Cross-Device)\nConfigure multiple local paths for the same project across different computers. Git operations detect the first valid path automatically. Example: home PC at E:\\projects\\repo, office PC at D:\\work\\repo — no manual switching needed. Paths can be edited, deleted, or added anytime; keep at least one.',
  },
  {
    icon: 'mdi:link-variant',
    textZh: '🔗 仓库链接（持久化存储）\n手动填写的远程仓库 URL（GitHub/Gitee/Gitea/CNB），通过思源插件存储 API 持久化保存到 workspace/data/storage/petal/ 目录。即使本地 .git/config 中没有配置 remote，URL 也不会丢失。使用思源同步（S3/WebDAV）后，换电脑可自动恢复所有链接。',
    textEn: '🔗 Repo URLs (Persistent Storage)\nManually entered remote repository URLs (GitHub/Gitee/Gitea/CNB), persisted via the SiYuan plugin storage API to workspace/data/storage/petal/. URLs are preserved even when the local .git/config has no remote configured. After workspace sync (S3/WebDAV), all URLs auto-recover on other devices.',
  },
  {
    icon: 'mdi:source-repository',
    textZh: '📦 Git 远程仓库（自动检测）\n从当前有效本地路径的 .git/config 中通过 git remote -v 自动检测。系统会自动识别平台类型（GitHub/Gitee 等）并映射到对应字段。点击「编辑」可修改 URL，点击「删除」移除 remote 配置。修改会同时作用于本地 git 仓库和持久化数据。若当前电脑路径不存在，将显示「暂无远程仓库」。',
    textEn: '📦 Git Remotes (Auto-Detection)\nDetected from the valid local path\'s .git/config via git remote -v. The system auto-identifies platform types (GitHub/Gitee, etc.) and maps them to the correct fields. Click Edit to modify a URL, Delete to remove a remote. Changes apply to both the local git repo and persistent data. If no valid local path exists, "No remotes" will be shown.',
  },
  {
    icon: 'mdi:database-outline',
    textZh: '💾 数据持久化机制\n所有项目数据（名称、路径、标签、分类、状态、备注、远程仓库 URL 等）均通过思源原生 plugin.saveData() API 保存为 JSON 文件，存储于当前工作空间的 data/storage/petal/<插件名>/ 目录下。数据随工作空间同步（S3/WebDAV）自动跨设备可用，无需额外配置。',
    textEn: '💾 Data Persistence\nAll project data (name, paths, tags, categories, status, notes, remote URLs, etc.) is saved via SiYuan\'s native plugin.saveData() API as JSON files under workspace/data/storage/petal/<plugin>/. Data syncs automatically with workspace sync (S3/WebDAV) for seamless cross-device access.',
  },
]

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
  urlInputs.githubUrl = p.githubUrl || ""
  urlInputs.giteeUrl = p.giteeUrl || ""
  urlInputs.giteaUrl = p.giteaUrl || ""
  urlInputs.cnbUrl = p.cnbUrl || ""
  allPathsList.value = [p.path, ...(p.localPaths || [])]
  // 初始化添加行默认平台
  const first = PLATFORM_META.find((pl) => !urlInputs[pl.urlProp])
  if (first) { newLinkPlatform.value = first.key }
  // 检测远程仓库
  await loadRemotes()
})

async function loadRemotes() {
  if (!project.value) return
  try {
    const path = resolveValidPath(project.value)
    remoteList.value = await props.manager.detectRemotes(path)
    remoteError.value = ""
  } catch (e: any) {
    remoteError.value = e?.message || "检测远程仓库失败"
  }
}

// ── 路径管理 ──
function addLocalPath() {
  allPathsList.value = [...allPathsList.value, ""]
}

function removeLocalPath(idx: number) {
  if (allPathsList.value.length <= 1) { return }
  allPathsList.value = allPathsList.value.filter((_, i) => i !== idx)
}

async function pickLocalPath(idx: number) {
  const dir = await pickDirectory("选择本地路径")
  if (dir) { allPathsList.value[idx] = dir }
}

// ── 远程仓库操作 ──
async function handleAddRemote() {
  if (!project.value) { return }
  remoteError.value = ""
  try {
    await props.manager.addRemote(
      resolveValidPath(project.value),
      newRemoteName.value.trim(),
      newRemoteUrl.value.trim(),
    )
    newRemoteUrl.value = ""
    await loadRemotes()
    await props.manager.refreshRemotes(props.projectId)
  } catch (e: any) { remoteError.value = e?.message || "添加失败" }
}

async function handleRemoveRemote(name: string) {
  if (!project.value) { return }
  remoteError.value = ""
  try {
    await props.manager.removeRemote(resolveValidPath(project.value), name)
    await loadRemotes()
    await props.manager.refreshRemotes(props.projectId)
  } catch (e: any) { remoteError.value = e?.message || "删除失败" }
}

async function saveRemoteEdit(name: string) {
  if (!project.value) { return }
  remoteError.value = ""
  try {
    await props.manager.setRemoteUrl(
      resolveValidPath(project.value),
      name,
      editRemoteUrl.value,
    )
    editRemoteName.value = ""
    await loadRemotes()
    await props.manager.refreshRemotes(props.projectId)
  } catch (e: any) { remoteError.value = e?.message || "修改失败" }
}

// ── 保存 ──
async function save() {
  if (!project.value) { return }
  const paths = allPathsList.value.map((p) => p.trim()).filter(Boolean)
  const firstPath = paths[0] || project.value.path
  const restPaths = paths.slice(1)
  await props.manager.updateProjectMeta(props.projectId, {
    name: localName.value.trim() || project.value.name,
    status: localStatus.value as ProjectStatus,
    starred: localStarred.value,
    archived: localArchived.value,
    note: localNote.value,
    path: firstPath,
    localPaths: restPaths.length > 0 ? restPaths : undefined,
  })
  emit("saved")
}
</script>
