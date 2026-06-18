<template>
  <div class="gp-mask" @click.self="$emit('close')">
    <div class="gp-dialog" style="width: 420px;">
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">编辑项目 — {{ project.name }}</span>
        <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="$emit('close')">
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div class="gp-form-group">
          <label class="gp-label">项目名称</label>
          <input v-model="localName" class="gp-input" @keyup.enter="save" />
        </div>
        <div class="gp-edit-row">
          <div class="gp-form-group" style="flex:1">
            <label class="gp-label">状态</label>
            <select v-model="localStatus" class="gp-select">
              <option v-for="s in STATUS_CYCLE" :key="s" :value="s">{{ STATUS_META[s].label }}</option>
            </select>
          </div>
          <div class="gp-form-group gp-edit-toggles">
            <label class="gp-label">标记</label>
            <div class="gp-toggle-row">
              <button class="gp-toggle-chip" :class="{ active: localStarred }" @click="localStarred = !localStarred">
                <Icon :icon="localStarred ? 'mdi:star' : 'mdi:star-outline'" height="13" />收藏
              </button>
              <button class="gp-toggle-chip" :class="{ active: localArchived }" @click="localArchived = !localArchived">
                <Icon icon="mdi:archive-outline" height="13" />归档
              </button>
            </div>
          </div>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">标签</label>
          <div v-if="localTags.length" class="gp-edit-tags">
            <span v-for="t in localTags" :key="t" class="gp-edit-tag">
              {{ t }}
              <button class="gp-edit-tag-x" @click="removeTag(t)">
                <Icon icon="mdi:close" height="11" />
              </button>
            </span>
          </div>
          <input
            v-model="tagInput"
            class="gp-input"
            placeholder="输入标签后回车添加"
            :list="'gp-tag-suggestions-' + project.id"
            @keyup.enter="addTag"
          />
          <datalist :id="'gp-tag-suggestions-' + project.id">
            <option v-for="t in allTags" :key="t" :value="t" />
          </datalist>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">备注</label>
          <textarea v-model="localNote" class="gp-input" rows="3" placeholder="项目备注（可选）" />
        </div>
        <div class="gp-form-group">
          <label class="gp-label">仓库链接</label>
          <div class="gp-edit-urls">
            <div v-for="pl in PLATFORM_META" :key="pl.key" class="gp-edit-url-row">
              <Icon :icon="pl.icon" height="14" />
              <input v-model="urlInputs[pl.urlProp]" class="gp-input" :placeholder="pl.label + ' 仓库 URL（可选）'" />
            </div>
          </div>
        </div>
        <div class="gp-form-group">
          <label class="gp-label">Git 远程仓库（编辑/增删）</label>
          <div v-if="remoteList.length" class="gp-remote-list">
            <div v-for="r in remoteList" :key="r.name" class="gp-remote-row">
              <span class="gp-remote-name">{{ r.name }}</span>
              <template v-if="editRemoteName === r.name">
                <input v-model="editRemoteUrl" class="gp-input" style="flex:1" @keyup.enter="saveRemoteEdit(r.name)" @keyup.escape="editRemoteName = ''" />
                <button class="vp-btn vp-btn--primary vp-btn--sm" @click="saveRemoteEdit(r.name)">保存</button>
                <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="editRemoteName = ''">取消</button>
              </template>
              <template v-else>
                <span class="gp-remote-url" :title="r.url">{{ r.url }}</span>
                <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="editRemoteName = r.name; editRemoteUrl = r.url">编辑</button>
                <button class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger" @click="$emit('edit-remove-remote', r.name)">删除</button>
              </template>
            </div>
          </div>
          <div v-else class="gp-remote-empty">暂无远程仓库</div>
          <div class="gp-remote-add" style="margin-top:4px">
            <select v-model="newRemoteName" class="gp-select" style="width:110px">
              <option value="" disabled>选择平台</option>
              <option v-for="r in remotesMeta" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
            <input v-model="newRemoteUrl" class="gp-input" placeholder="远程 URL" style="flex:1" @keyup.enter="$emit('edit-add-remote', newRemoteName.trim(), newRemoteUrl.trim()); clearAddRemote()" />
            <button class="vp-btn vp-btn--primary vp-btn--sm" :disabled="!newRemoteName || !newRemoteUrl.trim()" @click="$emit('edit-add-remote', newRemoteName.trim(), newRemoteUrl.trim()); clearAddRemote()">添加</button>
          </div>
          <div v-if="remoteError" class="gp-error" style="margin-top:4px">{{ remoteError }}</div>
        </div>
      </div>
      <div class="gp-dialog-footer">
        <button class="vp-btn vp-btn--ghost" @click="$emit('close')">
          {{ i18n.cancel || '取消' }}
        </button>
        <button class="vp-btn vp-btn--primary" @click="save">
          {{ i18n.save || '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue"
import { Icon } from "@iconify/vue"
import { PLATFORM_META, type PlatformKey } from "../types"
import type { GitRemoteInfo, GitProject, ProjectStatus } from "../types"

const STATUS_META: Record<string, { color: string; label: string; icon: string }> = {
  active: { color: "var(--b3-theme-success)", label: "活跃", icon: "mdi:circle-medium" },
  maintenance: { color: "var(--b3-theme-primary)", label: "维护中", icon: "mdi:circle-medium" },
  paused: { color: "var(--b3-theme-on-surface)", label: "暂停", icon: "mdi:pause-circle-outline" },
}
const STATUS_CYCLE: ProjectStatus[] = ["active", "maintenance", "paused"]

const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
  allTags: string[]
  remoteList: GitRemoteInfo[]
  remoteError: string
  remotesMeta: { key: PlatformKey; label: string }[]
  urlValues: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  save: [data: {
    name: string; status: string; starred: boolean; archived: boolean
    note: string; tags: string[]
    githubUrl: string; giteeUrl: string; giteaUrl: string; cnbUrl: string
  }]
  "edit-add-remote": [name: string, url: string]
  "edit-remove-remote": [name: string]
  "edit-save-remote": [name: string, url: string]
}>()

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

function addTag() {
  const t = tagInput.value.trim()
  if (t && !localTags.value.includes(t)) {
    localTags.value = [...localTags.value, t]
  }
  tagInput.value = ""
}

function removeTag(tag: string) {
  localTags.value = localTags.value.filter(t => t !== tag)
}

function saveRemoteEdit(name: string) {
  emit("edit-save-remote", name, editRemoteUrl.value)
  editRemoteName.value = ""
}

function clearAddRemote() {
  newRemoteUrl.value = ""
}

function save() {
  emit("save", {
    name: localName.value.trim(),
    status: localStatus.value,
    starred: localStarred.value,
    archived: localArchived.value,
    note: localNote.value,
    tags: localTags.value,
    githubUrl: urlInputs.githubUrl || "",
    giteeUrl: urlInputs.giteeUrl || "",
    giteaUrl: urlInputs.giteaUrl || "",
    cnbUrl: urlInputs.cnbUrl || "",
  })
}
</script>
