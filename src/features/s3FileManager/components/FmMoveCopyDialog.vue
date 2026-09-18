<!-- 移动/复制目标选择弹窗 — 基于 listDir 懒加载子目录的简易层级导航，选定目标目录后确认（外壳复用共享 Dialog） -->
<template>
  <Dialog
    :visible="true"
    size="small"
    :header="title"
    @update:visible="$emit('close')"
  >
    <div class="fm-mc-body">
      <!-- 当前目标路径面包屑 -->
      <div class="fm-mc-path">
        <Button
          variant="ghost"
          text
          size="xsmall"
          icon="s3FileManager"
          :icon-size="11"
          :title="bucketLabel"
          @click="navigate(rootPrefix)"
        >
          {{ bucketLabel }}
        </Button>
        <template
          v-for="(seg, idx) in segments"
          :key="idx"
        >
          <IconWrapper
            class="fm-mc-sep"
            name="chevronRight"
            :size="10"
          />
          <Button
            variant="ghost"
            text
            size="xsmall"
            :title="seg"
            @click="navigateToSegment(idx)"
          >
            {{ seg }}
          </Button>
        </template>
      </div>

      <!-- 子目录列表 -->
      <div class="fm-mc-list">
        <div
          v-if="loading"
          class="fm-mc-state"
        >
          <Loader />
        </div>
        <template v-else>
          <!-- 错误态："目标目录加载失败" + 错误信息 -->
          <div
            v-if="loadError"
            class="fm-mc-state fm-mc-error"
          >
            {{ i18n.targetListFailed }}: {{ loadError }}
          </div>
          <!-- 空态："此文件夹下无子目录" -->
          <div
            v-else-if="folders.length === 0"
            class="fm-mc-state"
          >
            {{ i18n.noSubFolders }}
          </div>
          <Button
            v-for="folder in folders"
            :key="folder"
            class="fm-mc-folder"
            variant="ghost"
            text
            size="small"
            icon="folder"
            :icon-size="14"
            block
            @click="navigate(folder)"
          >
            {{ folderName(folder) }}
          </Button>
        </template>
      </div>
    </div>

    <template #footer>
      <!-- 当前目标提示："目标：<路径>" -->
      <span class="fm-mc-target">{{ i18n.targetLabel }} {{ currentPrefix || "/" }}</span>
      <div class="fm-dialog-footer-right">
        <Button
          variant="ghost"
          size="small"
          @click="$emit('close')"
        >
          {{ i18n.cancel }}
        </Button>
        <!-- 加载中/加载失败时禁止确认，避免误用未成功列举的目录作为目标 -->
        <Button
          variant="primary"
          size="small"
          :disabled="loading || !!loadError"
          @click="$emit('confirm', currentPrefix)"
        >
          {{ i18n.confirm }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { S3Client } from "@/utils/s3/s3Client"
import { listDir } from "@/utils/s3/s3ObjectOps"
import { getErrorMessage } from "@/utils/stringUtils"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import type { S3FileManagerI18n } from "../types"
import { nameFromKey, normalizeListing, prefixFromSegments, relativeSegments } from "../utils"

const props = defineProps<{
  title: string
  rootPrefix: string
  bucketLabel: string
  requireClient: () => S3Client
  i18n: S3FileManagerI18n
}>()

const emit = defineEmits<{
  confirm: [destPrefix: string]
  close: []
}>()

const currentPrefix = ref(props.rootPrefix)
const folders = ref<string[]>([])
const loading = ref(false)
const loadError = ref("")

/** 面包屑段：与主列表共用 relativeSegments（同一口径，此前为逐字重复的第二份实现） */
const segments = computed(() => relativeSegments(currentPrefix.value, props.rootPrefix))

function folderName(prefix: string): string {
  return nameFromKey(prefix)
}

async function navigate(prefix: string): Promise<void> {
  loading.value = true
  loadError.value = ""
  currentPrefix.value = prefix
  try {
    const listing = await listDir(props.requireClient(), prefix)
    // 与主列表 loadDir 共用 normalizeListing（服务端忽略 delimiter 时折叠出子目录，否则选不到目标文件夹）
    folders.value = normalizeListing(listing, prefix).folders
  } catch (err) {
    // 列举失败显示错误态，与“无子目录”空态区分
    console.error("[S3文件管理] 目标目录列举失败:", getErrorMessage(err))
    loadError.value = getErrorMessage(err)
    folders.value = []
  } finally {
    loading.value = false
  }
}

function navigateToSegment(index: number): Promise<void> {
  return navigate(props.rootPrefix + prefixFromSegments(segments.value, index))
}

onMounted(() => navigate(props.rootPrefix))
</script>

<style scoped lang="scss">
@use "../styles/FmMoveCopyDialog.scss";
@use "../styles/index.scss";
</style>
