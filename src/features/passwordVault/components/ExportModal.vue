<!-- 密码箱导出弹窗 — 两步确认（明文警告 + 主密码校验），校验通过后导出明文 JSON -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="password-vault-overlay modal-overlay"
        @click="$emit('close')"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="password-vault-dialog small"
            @click.stop
          >
            <div class="dialog-header">
              <h2>导出确认</h2>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="$emit('close')"
              />
            </div>

            <div class="dialog-body">
              <!-- Step 1: 警告提示 + 确认 -->
              <template v-if="!showPasswordStep">
                <div class="export-warning">
                  <svg
                    class="warning-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                    />
                    <line
                      x1="12"
                      y1="8"
                      x2="12"
                      y2="12"
                    />
                    <line
                      x1="12"
                      y1="16"
                      x2="12.01"
                      y2="16"
                    />
                  </svg>
                  <p class="warning-text">
                    导出数据为 <strong>明文 JSON 格式</strong>，包含所有密码、账号等敏感信息。
                  </p>
                  <p class="warning-sub">
                    请确保将文件保存在安全位置，使用完毕后及时删除。
                  </p>
                  <p class="warning-count">
                    当前共 <strong>{{ entries.length }} 条</strong>密码记录将被导出。
                  </p>
                </div>

                <div class="form-actions">
                  <Button
                    variant="ghost"
                    size="xsmall"
                    @click="$emit('close')"
                  >
                    取消
                  </Button>
                  <Button
                    variant="primary"
                    size="xsmall"
                    @click="goToPasswordStep"
                  >
                    确认导出
                  </Button>
                </div>
              </template>

              <!-- Step 2: 密码验证 -->
              <template v-else>
                <div class="export-verify">
                  <p class="verify-hint">
                    请输入主密码以确认身份并导出数据
                  </p>
                  <Input
                    v-model="password"
                    type="password"
                    size="xsmall"
                    placeholder="请输入主密码"
                    :visible="showPwd"
                    @keyup.enter="verifyAndExport"
                    @toggle="showPwd = $event"
                  />
                  <p
                    v-if="errorMessage"
                    class="error-text"
                  >
                    {{ errorMessage }}
                  </p>
                </div>

                <div class="form-actions">
                  <Button
                    variant="ghost"
                    size="xsmall"
                    @click="backToWarning"
                  >
                    返回
                  </Button>
                  <Button
                    variant="primary"
                    size="xsmall"
                    :disabled="!password.trim()"
                    @click="verifyAndExport"
                  >
                    验证并导出
                  </Button>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import { usePasswordVaultAuth } from "../composables/usePasswordVaultAuth"
import { usePasswordVaultData } from "../composables/usePasswordVaultData"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const {
  entries,
  exportAllData,
} = usePasswordVaultData()
const { verifyMasterPassword } = usePasswordVaultAuth()

const showPasswordStep = ref(false)
const password = ref("")
const errorMessage = ref("")
const showPwd = ref(false)

// 打开/关闭时重置为第一步
watch(
  () => props.visible,
  () => {
    showPasswordStep.value = false
    password.value = ""
    errorMessage.value = ""
    showPwd.value = false
  },
)

const goToPasswordStep = () => {
  showPasswordStep.value = true
  password.value = ""
  errorMessage.value = ""
}

const backToWarning = () => {
  showPasswordStep.value = false
  password.value = ""
  errorMessage.value = ""
}

const verifyAndExport = async () => {
  const pwd = password.value.trim()
  if (!pwd) return
  errorMessage.value = ""

  const valid = await verifyMasterPassword(pwd)
  if (!valid) {
    errorMessage.value = "密码错误"
    return
  }

  exportAllData()
  emit("close")
}
</script>

<style lang="scss" scoped>
@use '../styles/ExportModal.scss';
@use '../styles/index.scss';
</style>
