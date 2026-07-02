<!-- 编辑 Git 项目弹窗 -->
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
        <span class="gp-dialog-title">编辑项目 — {{ project.name }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div class="gp-form-group">
          <label class="gp-label">项目名称</label>
          <input
            v-model="localName"
            class="gp-input"
            @keyup.enter="save"
          />
        </div>
        <div class="gp-edit-row">
          <div
            class="gp-form-group"
            style="flex:1"
          >
            <label class="gp-label">状态</label>
            <select
              v-model="localStatus"
              class="gp-select"
            >
              <option
                v-for="s in STATUS_CYCLE"
                :key="s"
                :value="s"
              >
                {{ STATUS_META[s].label }}
              </option>
            </select>
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
        <div class="gp-form-group">
          <label class="gp-label">标签</label>
          <div
            v-if="localTags.length"
            class="gp-edit-tags"
          >
            <span
              v-for="t in localTags"
              :key="t"
              class="gp-edit-tag"
            >
              {{ t }}
              <button
                class="gp-edit-tag-x"
                @click="removeTag(t)"
              >
                <Icon
                  icon="mdi:close"
                  height="12"
                />
              </button>
            </span>
          </div>
          <input
            v-model="tagInput"
            class="gp-input"
            placeholder="输入标签后回车添加"
            :list="`gp-tag-suggestions-${project.id}`"
            @keyup.enter="addTag"
          />
          <datalist :id="`gp-tag-suggestions-${project.id}`">
            <option
              v-for="t in allTags"
              :key="t"
              :value="t"
            />
          </datalist>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">备注</label>
          <textarea
            v-model="localNote"
            class="gp-input"
            rows="3"
            placeholder="项目备注（可选）"
          />
        </div>
        <div class="gp-form-group">
          <label class="gp-label">本地路径 <span class="gp-label-hint">（跨设备适配）</span></label>
          <div class="gp-edit-paths">
            <div
              v-for="(lp, idx) in allPathsList"
              :key="idx"
              class="gp-edit-path-row"
            >
              <input
                v-model="allPathsList[idx]"
                class="gp-input"
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
          <div class="gp-edit-urls">
            <div
              v-for="pl in PLATFORM_META"
              :key="pl.key"
              class="gp-edit-url-row"
            >
              <Icon
                :icon="pl.icon"
                height="12"
              />
              <input
                v-model="urlInputs[pl.urlProp]"
                class="gp-input"
                :placeholder="`${pl.label} 仓库 URL（可选）`"
              />
            </div>
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
                <input
                  v-model="editRemoteUrl"
                  class="gp-input"
                  style="flex:1"
                  @keyup.enter="saveRemoteEdit(r.name)"
                  @keyup.escape="editRemoteName = ''"
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
                  @click="$emit('edit-remove-remote', r.name)"
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
            <select
              v-model="newRemoteName"
              class="gp-select"
              style="width:110px"
            >
              <option
                value=""
                disabled
              >
                选择平台
              </option>
              <option
                v-for="r in remotesMeta"
                :key="r.key"
                :value="r.key"
              >
                {{ r.label }}
              </option>
            </select>
            <input
              v-model="newRemoteUrl"
              class="gp-input"
              placeholder="远程 URL"
              style="flex:1"
              @keyup.enter="$emit('edit-add-remote', newRemoteName.trim(), newRemoteUrl.trim()); clearAddRemote()"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newRemoteName || !newRemoteUrl.trim()"
              @click="$emit('edit-add-remote', newRemoteName.trim(), newRemoteUrl.trim()); clearAddRemote()"
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
            <Icon icon="mdi:help-circle-outline" height="14" />
          </button>
          <div
            v-if="showHelp"
            class="gp-help-popover"
            @click.stop
          >
            <div class="gp-help-header">
              <Icon icon="mdi:information-outline" height="14" />
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
                <Icon :icon="item.icon" height="13" class="gp-help-item-icon" />
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
  GitRemoteInfo,
  PlatformKey,
  ProjectStatus,
} from "../types"
import { PLATFORM_META } from "../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  reactive,
  ref,
} from "vue"


const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
  allTags: string[]
  remoteList: GitRemoteInfo[]
  remoteError: string
  remotesMeta: { key: PlatformKey, label: string }[]
  urlValues: Record<string, string>
  allPaths: string[]
}>()
const emit = defineEmits<{
  "close": []
  "save": [data: {
    name: string
    status: string
    starred: boolean
    archived: boolean
    note: string
    tags: string[]
    githubUrl?: string
    giteeUrl?: string
    giteaUrl?: string
    cnbUrl?: string
    allPaths: string[]
  }]
  "edit-add-remote": [name: string, url: string]
  "edit-remove-remote": [name: string]
  "edit-save-remote": [name: string, url: string]
  "pick-dir": []
}>()
const STATUS_META: Record<string, { color: string, label: string, icon: string }> = {
  active: {
    color: "var(--b3-theme-success)",
    label: "活跃",
    icon: "mdi:circle-medium",
  },
  maintenance: {
    color: "var(--b3-theme-primary)",
    label: "维护中",
    icon: "mdi:circle-medium",
  },
  paused: {
    color: "var(--b3-theme-on-surface)",
    label: "暂停",
    icon: "mdi:pause-circle-outline",
  },
}
const STATUS_CYCLE: ProjectStatus[] = ["active", "maintenance", "paused"]

const localName = ref(props.project.name)
const localStatus = ref<string>(props.project.status || "active")
const localStarred = ref(!!props.project.starred)
const localArchived = ref(!!props.project.archived)
const localNote = ref(props.project.note || "")
const localTags = ref<string[]>([...(props.project.tags || [])])
const tagInput = ref("")

const urlInputs = reactive<Record<string, string>>({ ...props.urlValues })

const newRemoteName = ref("github")
const newRemoteUrl = ref("")
const editRemoteName = ref("")
const editRemoteUrl = ref("")
const showHelp = ref(false)

// 语言检测：根据现有 i18n 文本判断
const isZh = computed(() => (props.i18n.cancel || '取消') === '取消')

// 帮助项（硬编码，不依赖 i18n JSON）
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

// 统一路径列表管理（所有路径平等，均可编辑删除，至少保留 1 个）
const allPathsList = ref<string[]>([...props.allPaths])

function addLocalPath() {
  allPathsList.value = [...allPathsList.value, ""]
}

function removeLocalPath(idx: number) {
  if (allPathsList.value.length <= 1) return
  allPathsList.value = allPathsList.value.filter((_, i) => i !== idx)
}

function pickLocalPath(idx: number) {
  // 通知父组件打开目录选择器，路径将回填到对应条目
  emit("pick-dir")
}
defineExpose({ setLocalPath: (idx: number, path: string) => { allPathsList.value[idx] = path } })

function addTag() {
  const t = tagInput.value.trim()
  if (t && !localTags.value.includes(t)) {
    localTags.value = [...localTags.value, t]
  }
  tagInput.value = ""
}

function removeTag(tag: string) {
  localTags.value = localTags.value.filter((t) => t !== tag)
}

function saveRemoteEdit(name: string) {
  emit("edit-save-remote", name, editRemoteUrl.value)
  editRemoteName.value = ""
}

function clearAddRemote() {
  newRemoteUrl.value = ""
}

function save() {
  const paths = allPathsList.value.map((p) => p.trim()).filter(Boolean)
  // 只发送用户实际修改过的 URL 字段（与原始值比较）
  const urlPatch: Record<string, string> = {}
  for (const key of ["githubUrl", "giteeUrl", "giteaUrl", "cnbUrl"]) {
    const original = (props.urlValues as Record<string, string>)[key] || ""
    const current = urlInputs[key].trim()
    if (current !== original) {
      urlPatch[key] = current // 空字符串代表用户主动清空
    }
  }
  emit("save", {
    name: localName.value.trim(),
    status: localStatus.value,
    starred: localStarred.value,
    archived: localArchived.value,
    note: localNote.value,
    tags: localTags.value,
    allPaths: paths.length > 0 ? paths : [props.project.path],
    ...urlPatch,
  })
}
</script>
