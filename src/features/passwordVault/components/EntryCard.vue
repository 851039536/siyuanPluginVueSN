<!-- 密码箱条目卡片 — 展示单条记录，内置复制与显隐，编辑/删除委派父层 -->
<template>
  <div class="entry-card">
    <div class="entry-header">
      <div class="entry-title-wrapper">
        <IconWrapper
          name="file"
          :size="18"
          class="entry-icon"
        />
        <h3>{{ entry.name }}</h3>
        <span
          class="entry-category-tag"
          :style="{
            backgroundColor: `${getCategoryById(entry.category)?.color}20`,
            color: getCategoryById(entry.category)?.color,
          }"
        >
          {{ getCategoryById(entry.category)?.name || '未分类' }}
        </span>
      </div>
      <div class="entry-actions">
        <Button
          variant="ghost"
          size="xsmall"
          title="一键复制名称、账号、密码、描述"
          @click="copyAll"
        >
          一键复制
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          title="编辑"
          @click="$emit('edit', entry)"
        >
          编辑
        </Button>
        <Button
          icon="delete"
          variant="ghost"
          size="xsmall"
          title="删除"
          @click="$emit('delete', entry.id)"
        />
      </div>
    </div>
    <div
      class="entry-account"
      @click="copyAccount"
    >
      <IconWrapper
        name="file"
        :size="14"
      />
      <span class="account-text">{{ entry.account }}</span>
      <div class="action-hint">
        <IconWrapper
          name="contentCopy"
          :size="12"
        />
        点击复制
      </div>
    </div>
    <div class="entry-description">
      {{ entry.description }}
    </div>
    <div class="entry-field">
      <div class="field-label">
        <IconWrapper
          name="pageLock"
          :size="14"
        />
        密码
      </div>
      <div
        class="field-value"
        @click="copyPassword"
      >
        <span class="password-mask">{{ showPassword ? entry.password : '••••••••' }}</span>
        <div class="action-hint">
          <IconWrapper
            name="contentCopy"
            :size="12"
          />
          点击复制
        </div>
      </div>
      <Button
        :icon="showPassword ? 'eye' : 'eyeOff'"
        variant="ghost"
        size="xsmall"
        @click.stop="showPassword = !showPassword"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PasswordEntry } from "../types"
import { showMessage } from "siyuan"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard as copyToClipboardUtil } from "@/utils/domUtils"
import { usePasswordVaultData } from "../composables/usePasswordVaultData"

interface Props {
  entry: PasswordEntry
}

const props = defineProps<Props>()

defineEmits<{
  (e: "edit", entry: PasswordEntry): void
  (e: "delete", id: string): void
}>()

const { getCategoryById } = usePasswordVaultData()

const showPassword = ref(false)

const copyAndNotify = async (text: string, label: string) => {
  const ok = await copyToClipboardUtil(text)
  showMessage(ok ? `${label}已复制` : "复制失败", 2000, ok ? "info" : "error")
}

const copyAccount = () => copyAndNotify(props.entry.account, "账号")
const copyPassword = () => copyAndNotify(props.entry.password, "密码")

const copyAll = async () => {
  const entry = props.entry
  const lines = [
    entry.name,
    `账号：${entry.account}`,
    `密码：${entry.password}`,
  ]
  if (entry.description) {
    lines.push(`描述：${entry.description}`)
  }
  const ok = await copyToClipboardUtil(lines.join("\n"))
  showMessage(ok ? "条目信息已复制" : "复制失败", 2000, ok ? "info" : "error")
}
</script>

<style lang="scss" scoped>
@use '../styles/EntryCard.scss';
@use '../styles/index.scss';
</style>
