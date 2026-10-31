<!-- gitPush 推送账号设置区块：多账号认证（HTTPS 令牌 / SSH 私钥）+ 提交身份覆盖，自包含 CRUD -->
<template>
  <div class="gp-pp">
    <!-- 顶部说明与新增入口 -->
    <div class="gp-pp-header">
      <span class="gp-pp-desc">{{ i18n.pushProfilesHint }}</span>
      <div class="gp-grow" />
      <Button
        v-if="!form"
        variant="ghost"
        size="small"
        icon="plus"
        @click="startCreate"
      >
        {{ i18n.pushProfileAdd }}
      </Button>
    </div>

    <!-- Git 版本过低：令牌不会生效（提交身份仍生效） -->
    <div
      v-if="gitSupport === false"
      class="gp-pp-warn"
    >
      {{ i18n.pushProfileGitVersionTooOld }}
    </div>

    <!-- 新增 / 编辑表单 -->
    <div
      v-if="form"
      class="gp-pp-form"
    >
      <Input
        v-model="form.label"
        :label="i18n.pushProfileLabel"
        :placeholder="i18n.pushProfileLabelPlaceholder"
        size="small"
      />
      <div class="gp-pp-grid">
        <Input
          v-model="form.gitName"
          :label="i18n.pushProfileGitName"
          size="small"
        />
        <Input
          v-model="form.gitEmail"
          :label="i18n.pushProfileGitEmail"
          size="small"
        />
      </div>
      <Input
        v-model="form.sshKeyPath"
        :label="i18n.pushProfileSshKey"
        :placeholder="i18n.pushProfileSshKeyPlaceholder"
        size="small"
      />
      <div class="gp-pp-hint">
        {{ i18n.pushProfileSshHint }}
      </div>

      <!-- HTTPS 令牌（按主机隔离） -->
      <div class="gp-pp-creds">
        <div class="gp-pp-creds-head">
          <label class="gp-label">{{ i18n.pushProfileCreds }}</label>
          <Button
            variant="ghost"
            size="xsmall"
            icon="plus"
            @click="addCred"
          >
            {{ i18n.pushProfileAddCred }}
          </Button>
        </div>
        <div
          v-for="(cred, index) in form.credentials"
          :key="index"
          class="gp-pp-cred"
        >
          <Input
            v-model="cred.host"
            :placeholder="i18n.pushProfileHost"
            size="xsmall"
          />
          <Input
            v-model="cred.username"
            :placeholder="i18n.pushProfileUsername"
            size="xsmall"
          />
          <Input
            v-model="cred.token"
            type="password"
            :placeholder="cred.hasToken ? i18n.pushProfileTokenSaved : i18n.pushProfileToken"
            size="xsmall"
          />
          <Button
            variant="ghost"
            size="xsmall"
            icon="deleteOutline"
            :title="i18n.pushProfileRemoveCred"
            @click="removeCred(index)"
          />
        </div>
        <div class="gp-pp-hint">
          {{ i18n.pushProfileCredsHint }}
        </div>
      </div>

      <div
        v-if="formError"
        class="gp-pp-error"
      >
        {{ formError }}
      </div>

      <div class="gp-pp-actions">
        <Button
          variant="ghost"
          size="small"
          @click="cancelEdit"
        >
          {{ i18n.cancel }}
        </Button>
        <Button
          variant="primary"
          size="small"
          :loading="saving"
          @click="save"
        >
          {{ i18n.save }}
        </Button>
      </div>
    </div>

    <!-- 空态 -->
    <div
      v-if="!form && views.length === 0"
      class="gp-pp-empty"
    >
      {{ i18n.pushProfileEmpty }}
    </div>

    <!-- 账号列表 -->
    <div
      v-else-if="!form"
      class="gp-pp-list"
    >
      <div
        v-for="profile in views"
        :key="profile.id"
        class="gp-pp-item"
      >
        <div class="gp-pp-item-main">
          <div class="gp-pp-item-title">
            <span class="gp-pp-item-label">{{ profile.label }}</span>
            <Tag
              v-if="profile.id === defaultId"
              size="xsmall"
              variant="primary"
              :content="i18n.pushProfileDefault"
            />
          </div>
          <div class="gp-pp-item-meta">
            <span v-if="profile.gitName || profile.gitEmail">{{ identityText(profile) }}</span>
            <span v-if="profile.sshKeyPath">{{ i18n.pushProfileSshShort }}</span>
            <span
              v-for="cred in profile.credentials"
              :key="cred.host"
              class="gp-pp-host"
            >{{ cred.host }}</span>
          </div>
        </div>
        <div class="gp-pp-item-actions">
          <Button
            v-if="profile.id !== defaultId"
            variant="ghost"
            size="xsmall"
            icon="starOutline"
            :title="i18n.pushProfileSetDefault"
            @click="setDefault(profile.id)"
          />
          <Button
            variant="ghost"
            size="xsmall"
            icon="pencilOutline"
            :title="i18n.edit"
            @click="startEdit(profile)"
          />
          <Button
            variant="ghost"
            size="xsmall"
            :class="{ 'gp-pp-danger': deleteConfirmId === profile.id }"
            :icon="deleteConfirmId === profile.id ? 'check' : 'deleteOutline'"
            :title="deleteConfirmId === profile.id ? i18n.pushProfileDeleteConfirm : i18n.delete"
            @click="requestDelete(profile.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 推送账号设置区块（自包含：直接经 manager 读写，父级只管展示）
import type { GitPushManager, PushProfileInput, PushProfileView } from "../../types"
import { onMounted, ref } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Tag from "@/components/Tag.vue"
import { PushProfileError } from "../../managers/PushProfileStore"

interface CredForm {
  host: string
  username: string
  token: string
  /** 已保存过令牌（token 输入框留空 = 保留原值） */
  hasToken: boolean
}

interface ProfileForm {
  id: string
  label: string
  gitName: string
  gitEmail: string
  sshKeyPath: string
  credentials: CredForm[]
}

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
}>()

const views = ref<PushProfileView[]>([])
const defaultId = ref("")
const form = ref<ProfileForm | null>(null)
const saving = ref(false)
const formError = ref("")
const deleteConfirmId = ref("")
const gitSupport = ref<boolean | null>(null)

/** 保存失败原因 → i18n（存储层只返回 code，文案留在视图层） */
function errorText(code: string): string {
  const map: Record<string, string> = {
    needLabel: props.i18n.pushProfileNeedLabel,
    needAuth: props.i18n.pushProfileNeedAuth,
    needHost: props.i18n.pushProfileNeedHost,
    needToken: props.i18n.pushProfileNeedToken,
    duplicateHost: props.i18n.pushProfileDuplicateHost,
    saveFailed: props.i18n.errSavePushProfile,
  }
  return map[code] || props.i18n.errSavePushProfile
}

async function reload(): Promise<void> {
  try {
    const [list, def] = await Promise.all([
      props.manager.getPushProfileViews(),
      props.manager.getDefaultPushProfileId(),
    ])
    views.value = list
    defaultId.value = def
  } catch {
    views.value = []
    defaultId.value = ""
  }
}

onMounted(async () => {
  await reload()
  gitSupport.value = await props.manager.checkGitConfigEnvSupport().catch(() => null)
})

/** 列表行身份摘要：姓名 <邮箱>（缺失项省略） */
function identityText(profile: PushProfileView): string {
  if (profile.gitName && profile.gitEmail) return `${profile.gitName} <${profile.gitEmail}>`
  return profile.gitName || profile.gitEmail
}

function startCreate(): void {
  deleteConfirmId.value = ""
  formError.value = ""
  form.value = {
    id: "",
    label: "",
    gitName: "",
    gitEmail: "",
    sshKeyPath: "",
    credentials: [{ host: "", username: "", token: "", hasToken: false }],
  }
}

function startEdit(profile: PushProfileView): void {
  deleteConfirmId.value = ""
  formError.value = ""
  form.value = {
    id: profile.id,
    label: profile.label,
    gitName: profile.gitName,
    gitEmail: profile.gitEmail,
    sshKeyPath: profile.sshKeyPath,
    credentials: profile.credentials.map((c) => ({
      host: c.host,
      username: c.username,
      token: "",
      hasToken: c.hasToken,
    })),
  }
}

function cancelEdit(): void {
  form.value = null
  formError.value = ""
}

function addCred(): void {
  form.value?.credentials.push({ host: "", username: "", token: "", hasToken: false })
}

function removeCred(index: number): void {
  form.value?.credentials.splice(index, 1)
}

async function save(): Promise<void> {
  const current = form.value
  if (!current || saving.value) return
  formError.value = ""
  saving.value = true
  const input: PushProfileInput = {
    id: current.id || undefined,
    label: current.label,
    gitName: current.gitName,
    gitEmail: current.gitEmail,
    sshKeyPath: current.sshKeyPath,
    // 三项全空的行视为未填写，避免新增行的空壳触发校验
    credentials: current.credentials
      .filter((c) => c.host.trim() || c.username.trim() || c.token.trim())
      .map((c) => ({ host: c.host, username: c.username, token: c.token })),
  }
  try {
    const saved = await props.manager.savePushProfile(input)
    await reload()
    // 首个账号自动成为默认，避免「加了账号却没人用」的困惑
    if (!defaultId.value && views.value.length === 1) {
      await props.manager.setDefaultPushProfileId(saved.id)
      await reload()
    }
    form.value = null
  } catch (e: unknown) {
    formError.value = e instanceof PushProfileError ? errorText(e.code) : props.i18n.errSavePushProfile
  } finally {
    saving.value = false
  }
}

async function setDefault(id: string): Promise<void> {
  try {
    await props.manager.setDefaultPushProfileId(id)
    await reload()
  } catch {
    formError.value = props.i18n.errSavePushProfile
  }
}

async function requestDelete(id: string): Promise<void> {
  if (deleteConfirmId.value !== id) {
    deleteConfirmId.value = id
    return
  }
  deleteConfirmId.value = ""
  try {
    await props.manager.deletePushProfile(id)
    await reload()
  } catch {
    formError.value = props.i18n.errDeletePushProfile
  }
}
</script>

<style scoped lang="scss">
@use "../../styles/PushProfilesSection.scss";
</style>
