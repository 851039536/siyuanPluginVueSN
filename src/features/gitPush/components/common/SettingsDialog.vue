<!-- gitPush 设置汇总弹窗：左侧分区导航（常规=并发数+分支模式 / 显示=分析显示设置 / Git 配置=全局配置管理） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @keydown.enter="onEnterKey"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--settings">
      <!-- 弹窗头部 -->
      <div class="gp-dialog-header">
        <!-- 弹窗标题："设置" -->
        <span class="gp-dialog-title">{{ i18n.settings }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>

      <div class="gp-settings-layout">
        <!-- 左侧分区导航 -->
        <nav class="gp-settings-nav">
          <button
            v-for="sec in sections"
            :key="sec.id"
            class="gp-settings-nav-btn"
            :class="{ active: activeSection === sec.id }"
            :title="i18n[sec.labelKey]"
            @click="activeSection = sec.id"
          >
            <Icon :icon="sec.icon" height="14" />
            <!-- 导航项文案："常规"/"显示"/"Git 配置" -->
            <span>{{ i18n[sec.labelKey] }}</span>
          </button>
          <!-- 底部固定操作（tooltip："管理分类"）：点击后关闭设置并打开分类弹窗 -->
          <button
            class="gp-settings-nav-btn gp-settings-nav-manage"
            :title="i18n.manageCategories"
            @click="$emit('openCategory')"
          >
            <Icon icon="mdi:tag-outline" height="14" />
            <!-- 操作文案："管理分类" -->
            <span>{{ i18n.manageCategories }}</span>
          </button>
        </nav>

        <!-- 右侧内容区 -->
        <div class="gp-settings-content">
          <!-- ── 常规分区：并发数 + 推送分支模式 ── -->
          <template v-if="activeSection === 'general'">
            <!-- 并发数设置行 -->
            <div class="gp-set-row">
              <!-- 设置项标签："Git 并发数" -->
              <label class="gp-set-label">{{ i18n.gitConcurrency }}</label>
              <div class="gp-set-input-row">
                <Input
                  :model-value="localConcurrency"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  @update:model-value="localConcurrency = clampGitConcurrency(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveConcurrency"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："同时执行的 git 子进程数上限（1~10）" -->
            <div class="gp-set-hint">
              {{ i18n.concurrencyHint }}
            </div>
            <!-- 推送分支模式设置行 -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："推送分支模式" -->
              <label class="gp-set-label">{{ i18n.pushBranchModeLabel }}</label>
              <div class="gp-set-radio-group">
                <label class="gp-set-radio">
                  <input
                    v-model="localBranchMode"
                    type="radio"
                    value="all"
                  >
                  <!-- 选项文案："全部分支 (--all)" -->
                  <span>{{ i18n.pushBranchAllOpt }}</span>
                </label>
                <label class="gp-set-radio">
                  <input
                    v-model="localBranchMode"
                    type="radio"
                    value="head"
                  >
                  <!-- 选项文案："仅当前分支 (HEAD)" -->
                  <span>{{ i18n.pushBranchHeadOpt }}</span>
                </label>
              </div>
            </div>
            <!-- 提示文案："仅当前分支模式更快，避免推送无变更的其他分支" -->
            <div class="gp-set-hint">
              {{ i18n.pushBranchHint }}
            </div>
            <!-- 网络超时设置行 -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："网络超时（秒）" -->
              <label class="gp-set-label">{{ i18n.networkTimeout }}</label>
              <div class="gp-set-input-row">
                <Input
                  :model-value="localNetworkTimeout"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  @update:model-value="localNetworkTimeout = clampNetworkTimeout(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveNetworkTimeout"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："网络/推送命令超时上限（30~600 秒），推送大仓库时网络较慢可将值调大" -->
            <div class="gp-set-hint">
              {{ i18n.networkTimeoutHint }}
            </div>
          </template>

          <!-- ── 显示分区：提交分析显示设置 ── -->
          <template v-else-if="activeSection === 'display'">
            <!-- 提示文案："改动即时保存并生效" -->
            <div class="gp-set-hint">{{ i18n.settingsDisplayHint }}</div>
            <AnalysisSettingsForm
              :i18n="i18n"
              :view-settings="viewSettings"
              :years="yearOptions"
              @update="$emit('updateViewSettings', $event)"
            />
          </template>

          <!-- ── Git 配置分区：全局 Git 配置管理（自包含，直接写入 ~/.gitconfig）── -->
          <GitConfigSection
            v-else
            :i18n="i18n"
            :manager="manager"
            scope="global"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 设置汇总弹窗（分区导航：常规 / 显示 / Git 配置，各分区改动即时或按钮保存）
import type { CommitAnalysisViewSettings, GitPushManager } from "../../types"
import { Icon } from "@iconify/vue"
import { ref, watch } from "vue"
import Input from "@/components/Input.vue"
import GitConfigSection from "./GitConfigSection.vue"
import AnalysisSettingsForm from "../CommitAnalysis/AnalysisSettingsForm.vue"
import { clampGitConcurrency, clampNetworkTimeout } from "../../types"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

type SettingsSection = "general" | "display" | "gitconfig"

/** 分区导航元数据（图标均为本地 MDI 集已注册图标） */
const sections: { id: SettingsSection, icon: string, labelKey: string }[] = [
  { id: "general", icon: "mdi:tune", labelKey: "settingsSectionGeneral" },
  { id: "display", icon: "mdi:eye-outline", labelKey: "settingsSectionDisplay" },
  { id: "gitconfig", icon: "mdi:source-branch", labelKey: "settingsSectionGitConfig" },
]

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  concurrency: number
  /** 网络命令超时（秒） */
  networkTimeout: number
  pushBranchMode: "all" | "head"
  /** 提交分析显示设置（父级预载后下发，与 popover 入口同源） */
  viewSettings: CommitAnalysisViewSettings
  /** 显示设置年份选项（数据年份 ∪ 今年 ∪ 已保存年份） */
  yearOptions: number[]
}>()

const emit = defineEmits<{
  close: []
  save: [value: number]
  saveNetworkTimeout: [value: number]
  saveBranchMode: [mode: "all" | "head"]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
  /** 底部「管理分类」操作：由父级关闭设置弹窗并打开分类弹窗 */
  openCategory: []
}>()

const localConcurrency = ref(clampGitConcurrency(props.concurrency))
const localNetworkTimeout = ref(clampNetworkTimeout(props.networkTimeout))
const localBranchMode = ref<"all" | "head">(props.pushBranchMode)
const activeSection = ref<SettingsSection>("general")
const { rootRef } = useDialogKeyboard()

// 分支模式即时保存（radio 切换立即持久化，无需保存按钮）
watch(localBranchMode, (mode) => emit("saveBranchMode", mode))

/** 保存并发数（保存按钮 / Enter 键共用；汇总页多分区场景保存后不关闭弹窗） */
function saveConcurrency() {
  emit("save", localConcurrency.value)
}

/** 保存网络超时（保存按钮 / Enter 键共用） */
function saveNetworkTimeout() {
  emit("saveNetworkTimeout", localNetworkTimeout.value)
}

/** Enter 键仅在常规分区保存并发数与网络超时（Git 配置分区输入由组件内 stop 拦截，显示分区无提交语义） */
function onEnterKey() {
  if (activeSection.value === "general") {
    saveConcurrency()
    saveNetworkTimeout()
  }
}
</script>

<style lang="scss">
@use "../../styles/SettingsDialog.scss";
@use "../../styles/index.scss";
</style>
