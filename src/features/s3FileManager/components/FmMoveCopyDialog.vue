<!-- 移动/复制目标选择弹窗 — 基于 listDir 懒加载子目录的简易层级导航，选定目标目录后确认 -->
<template>
  <div
    class="fm-dialog-mask"
    @click.self="$emit('close')"
  >
    <div class="fm-dialog fm-movecopy-dialog">
      <!-- 弹窗标题：由父传入（"移动到" / "复制到"） -->
      <div class="fm-dialog-header">
        <span class="fm-dialog-title">{{ title }}</span>
        <Button
          variant="ghost"
          size="xsmall"
          icon="close"
          :icon-size="14"
          @click="$emit('close')"
        />
      </div>

      <div class="fm-dialog-body">
        <!-- 当前目标路径面包屑 -->
        <div class="fm-mc-path">
          <button
            class="fm-mc-crumb"
            @click="navigate(rootPrefix)"
          >
            <IconWrapper
              name="s3FileManager"
              :size="11"
            />
            {{ bucketLabel }}
          </button>
          <template
            v-for="(seg, idx) in segments"
            :key="idx"
          >
            <span class="fm-mc-sep">&#9656;</span>
            <button
              class="fm-mc-crumb"
              @click="navigateToSegment(idx)"
            >{{ seg }}</button>
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
            <!-- 空态："此文件夹下无子目录" -->
            <div
              v-if="folders.length === 0"
              class="fm-mc-state"
            >
              {{ i18n.noSubFolders }}
            </div>
            <button
              v-for="folder in folders"
              :key="folder"
              class="fm-mc-folder"
              @click="navigate(folder)"
            >
              <IconWrapper
                name="folder"
                :size="14"
              />
              <span>{{ folderName(folder) }}</span>
            </button>
          </template>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="fm-dialog-footer">
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
          <Button
            variant="primary"
            size="small"
            @click="$emit('confirm', currentPrefix)"
          >
            {{ i18n.confirm }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import type { S3Client } from "@/utils/s3/s3Client"
import { listDir } from "@/utils/s3/s3ObjectOps"
import { getErrorMessage } from "@/utils/stringUtils"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import type { S3FileManagerI18n } from "../types"
import { nameFromKey, prefixFromSegments, splitPrefixSegments } from "../utils"

const props = defineProps<{
  title: string
  rootPrefix: string
  bucketLabel: string
  requireClient: () => S3Client
  i18n: S3FileManagerI18n
}>()

defineEmits<{
  confirm: [destPrefix: string]
  close: []
}>()

const currentPrefix = ref(props.rootPrefix)
const folders = ref<string[]>([])
const loading = ref(false)

const segments = computed(() => {
  const relative = currentPrefix.value.startsWith(props.rootPrefix)
    ? currentPrefix.value.slice(props.rootPrefix.length)
    : currentPrefix.value
  return splitPrefixSegments(relative)
})

function folderName(prefix: string): string {
  return nameFromKey(prefix)
}

async function navigate(prefix: string): Promise<void> {
  loading.value = true
  currentPrefix.value = prefix
  try {
    const listing = await listDir(props.requireClient(), prefix)
    folders.value = listing.folders
  } catch (err) {
    console.warn("[S3文件管理] 目标目录列举失败:", getErrorMessage(err))
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
