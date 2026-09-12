<!-- 已存储校验值列表区 — 单条/全部验证与删除，验证状态组件内聚 -->
<template>
  <section class="card-section">
    <!-- 区块标题 + 操作按钮 -->
    <div class="section-header">
      <!-- 标题："已存储校验值" -->
      <h4>{{ i18n.storedChecksums }}</h4>
      <div class="section-header-actions">
        <!-- 按钮："验证全部" -->
        <Button
          v-if="storedItems.length > 0"
          variant="ghost"
          size="xsmall"
          :disabled="isVerifyingAll"
          @click="verifyAll"
        >
          {{ i18n.verifyAll }}
        </Button>
        <!-- 按钮："清空" -->
        <Button
          v-if="storedItems.length > 0"
          variant="ghost"
          size="xsmall"
          @click="confirmClearAll"
        >
          {{ i18n.clearAll }}
        </Button>
      </div>
    </div>
    <!-- 校验值列表 -->
    <div v-if="storedItems.length > 0" class="checksum-list">
      <div
        v-for="item in storedItems"
        :key="item.fileName"
        class="checksum-item"
        :class="{ 'verify-mismatch': verifyResults[item.fileName] === false, 'verify-match': verifyResults[item.fileName] === true }"
      >
        <div class="checksum-main">
          <!-- 文件名 -->
          <span class="checksum-name">{{ item.fileName }}</span>
          <!-- 文件路径提示图标 -->
          <span class="checksum-path-icon" :title="item.filePath" :aria-label="item.filePath">
            <Icon icon="mdi:information-outline" />
          </span>
          <!-- 文件大小 + 时间 -->
          <span class="checksum-meta">
            <span class="checksum-size">{{ formatFileSize(item.fileSize) }}</span>
            <span class="checksum-sep">·</span>
            <span class="checksum-time">{{ formatTime(item.time) }}</span>
            <!-- 相对时间（如"5分钟前"） -->
            <span class="checksum-relative">{{ formatRelativeTime(item.time) }}</span>
          </span>
          <!-- 操作按钮区 -->
          <div class="checksum-actions">
            <!-- 按钮："验证"（始终显示，支持单条重验） -->
            <Button
              variant="ghost"
              size="xsmall"
              :disabled="verifyingItems[item.fileName] || isVerifyingAll"
              @click="verifyOne(item)"
            >
              {{ i18n.verify }}
            </Button>
            <!-- 徽章："匹配" -->
            <Tag
              v-if="verifyResults[item.fileName] === true"
              variant="success"
              size="xsmall"
            >
              {{ i18n.match }}
            </Tag>
            <!-- 徽章："不匹配" -->
            <Tag
              v-else-if="verifyResults[item.fileName] === false"
              variant="danger"
              size="xsmall"
            >
              {{ i18n.mismatch }}
            </Tag>
            <!-- 按钮："删除" -->
            <Button
              variant="ghost"
              size="xsmall"
              @click="confirmRemoveOne(item.fileName)"
            >
              {{ i18n.removeChecksum }}
            </Button>
          </div>
        </div>
        <!-- 校验值哈希（截取前 16 位） -->
        <div class="checksum-hash">
          <code class="checksum-hash-value">{{ item.checksum.slice(0, 16) }}...</code>
        </div>
      </div>
    </div>
    <!-- 空状态 -->
    <div v-else class="empty-state">
      <!-- 提示："暂无校验值" -->
      <p>{{ i18n.noChecksums }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import { formatFileSize, formatRelativeTime, formatTime } from "@/utils/format"
import { getErrorMessage } from "@/utils/stringUtils"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"
import type { FileChecksum } from "../../types"

const props = defineProps<{
  storedItems: FileChecksum[]
  /** 计算文件 SHA-256（由父容器注入，工作区未就绪时返回 null） */
  computeHash: (filePath: string) => Promise<string | null>
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "clear"): void
  (e: "removeOne", fileName: string): void
}>()

// ========== 验证状态 ==========

const verifyResults = ref<Record<string, boolean | undefined>>({})
const verifyingItems = ref<Record<string, boolean>>({})
const isVerifyingAll = ref(false)

/** storedItems 变化时剔除已不存在的校验记录（useChecksums 为原地 splice/unshift，必须 deep 监听） */
watch(() => props.storedItems, (items) => {
  const names = new Set(items.map((i) => i.fileName))
  for (const key of Object.keys(verifyResults.value)) {
    if (!names.has(key)) { delete verifyResults.value[key] }
  }
  for (const key of Object.keys(verifyingItems.value)) {
    if (!names.has(key)) { delete verifyingItems.value[key] }
  }
}, { deep: true })

async function verifyOne(item: FileChecksum): Promise<void> {
  verifyingItems.value[item.fileName] = true
  try {
    const hash = await props.computeHash(item.filePath)
    if (hash === null) { return }
    verifyResults.value[item.fileName] = hash === item.checksum
  } catch (err: unknown) {
    verifyResults.value[item.fileName] = false
    showMessage(`${item.fileName}: ${getErrorMessage(err)}`, 3000, "error")
  } finally {
    verifyingItems.value[item.fileName] = false
  }
}

async function verifyAll(): Promise<void> {
  isVerifyingAll.value = true
  for (const item of props.storedItems) {
    await verifyOne(item)
  }
  isVerifyingAll.value = false
}

function confirmRemoveOne(fileName: string): void {
  const confirmed = confirm(props.i18n.confirmRemoveChecksum)
  if (!confirmed) { return }
  emit("removeOne", fileName)
}

function confirmClearAll(): void {
  const confirmed = confirm(props.i18n.confirmClearAll)
  if (!confirmed) { return }
  emit("clear")
}
</script>

<style scoped lang="scss">
@use "../../styles/StoredChecksumsSection.scss";
@use "../../styles/index.scss";
</style>
