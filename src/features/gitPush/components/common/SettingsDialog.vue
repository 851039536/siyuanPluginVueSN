<!-- gitPush 设置汇总弹窗：左侧分区导航（常规 / 显示 / 推送账号 / Git 配置），常规内按功能分组 -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--settings">
      <!-- 弹窗头部 -->
      <div class="gp-dialog-header">
        <!-- 弹窗标题："设置" -->
        <span class="gp-dialog-title">{{ i18n.settings }}</span>
        <!-- 关闭按钮（tooltip："关闭"） -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="close"
          :title="i18n.close"
          :aria-label="i18n.close"
          @click="$emit('close')"
        />
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
            <Icon
              :icon="sec.icon"
              height="14"
            />
            <!-- 导航项文案："常规" / "显示" / "推送账号" / "Git 配置" -->
            <span>{{ i18n[sec.labelKey] }}</span>
          </button>
          <!-- 底部固定操作（tooltip："管理分类"）：点击后关闭设置并打开分类弹窗 -->
          <button
            class="gp-settings-nav-btn gp-settings-nav-manage"
            :title="i18n.manageCategories"
            @click="$emit('openCategory')"
          >
            <Icon
              icon="mdi:tag-outline"
              height="14"
            />
            <!-- 操作文案："管理分类" -->
            <span>{{ i18n.manageCategories }}</span>
          </button>
        </nav>

        <!-- 右侧内容区 -->
        <div class="gp-settings-content">
          <!-- ── 常规分区：推送与链接 / 性能与超时 / 本地索引 / 实时探测 / 提交规则 ── -->
          <template v-if="activeSection === 'general'">
            <!-- 提示文案："改动即时保存并生效"（数字/文本项失焦或回车提交） -->
            <div class="gp-set-hint">
              {{ i18n.settingsDisplayHint }}
            </div>
            <PushLinkSettingsSection
              :i18n="i18n"
              :push-branch-mode="pushBranchMode"
              :compare-base-branch="compareBaseBranch"
              @save-branch-mode="$emit('saveBranchMode', $event)"
              @save-compare-base="$emit('saveCompareBase', $event)"
            />
            <PerformanceSettingsSection
              :i18n="i18n"
              :concurrency="concurrency"
              :network-timeout="networkTimeout"
              :local-timeout="localTimeout"
              @save="$emit('save', $event)"
              @save-network-timeout="$emit('saveNetworkTimeout', $event)"
              @save-local-timeout="$emit('saveLocalTimeout', $event)"
            />
            <IndexSettingsSection
              :i18n="i18n"
              :manager="manager"
            />
            <ProbeSettingsSection
              :i18n="i18n"
              :probe-config="probeConfig"
              :probe-watched-count="probeWatchedCount"
              @save-probe-config="$emit('saveProbeConfig', $event)"
              @probe-now="$emit('probeNow')"
            />
            <RuleCheckSettingsSection
              :i18n="i18n"
              :rule-config="ruleConfig"
              @save-rule-config="$emit('saveRuleConfig', $event)"
            />
          </template>

          <!-- ── 显示分区：提交分析显示设置 ── -->
          <template v-else-if="activeSection === 'display'">
            <!-- 提示文案："改动即时保存并生效" -->
            <div class="gp-set-hint">
              {{ i18n.settingsDisplayHint }}
            </div>
            <AnalysisSettingsForm
              :i18n="i18n"
              :view-settings="viewSettings"
              :years="yearOptions"
              @update="$emit('updateViewSettings', $event)"
            />
          </template>

          <!-- ── 推送账号分区：多账号认证 + 提交身份覆盖（自包含 CRUD）── -->
          <PushProfilesSection
            v-else-if="activeSection === 'accounts'"
            :i18n="i18n"
            :manager="manager"
          />

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
// gitPush 设置汇总弹窗外壳：分区导航 + 按分区懒渲染内容，各分区自持表单状态与保存时机
import type {
  CommitAnalysisViewSettings,
  CommitRuleConfig,
  GitPushManager,
  ProbeConfig,
} from "../../types"
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import AnalysisSettingsForm from "../CommitAnalysis/AnalysisSettingsForm.vue"
import GitConfigSection from "./GitConfigSection.vue"
import PushProfilesSection from "./PushProfilesSection.vue"
import IndexSettingsSection from "./settings/IndexSettingsSection.vue"
import PerformanceSettingsSection from "./settings/PerformanceSettingsSection.vue"
import ProbeSettingsSection from "./settings/ProbeSettingsSection.vue"
import PushLinkSettingsSection from "./settings/PushLinkSettingsSection.vue"
import RuleCheckSettingsSection from "./settings/RuleCheckSettingsSection.vue"

type SettingsSection = "general" | "display" | "accounts" | "gitconfig"

defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  concurrency: number
  /** 网络命令超时（秒） */
  networkTimeout: number
  /** 本地命令超时（秒） */
  localTimeout: number
  /** 提交规则配置（最短描述阈值 + 可选规则开关） */
  ruleConfig: CommitRuleConfig
  pushBranchMode: "all" | "head"
  /** Compare / 创建 PR 深链的基线分支（默认 main） */
  compareBaseBranch: string
  /** 提交分析显示设置（父级预载后下发，与 popover 入口同源） */
  viewSettings: CommitAnalysisViewSettings
  /** 显示设置年份选项（数据年份 ∪ 今年 ∪ 已保存年份） */
  yearOptions: number[]
  /** 实时探测配置（三层：文件监听 / 工作区轮询 / 网络轮询） */
  probeConfig: ProbeConfig
  /** 已建立 .git 文件监听的项目数（0 = 环境不支持或监听关闭，已降级到轮询层） */
  probeWatchedCount: number
}>()

defineEmits<{
  close: []
  save: [value: number]
  saveNetworkTimeout: [value: number]
  saveLocalTimeout: [value: number]
  /** 提交规则配置局部更新（阈值提交与开关即时保存共用） */
  saveRuleConfig: [patch: Partial<CommitRuleConfig>]
  saveBranchMode: [mode: "all" | "head"]
  /** Compare / 创建 PR 深链的基线分支 */
  saveCompareBase: [value: string]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
  /** 实时探测配置变更（即时保存并让运行中的探测按新配置重排） */
  saveProbeConfig: [config: ProbeConfig]
  /** 立即探测一次（清空预筛基准强制真查） */
  probeNow: []
  /** 底部「管理分类」操作：由父级关闭设置弹窗并打开分类弹窗 */
  openCategory: []
}>()

/** 分区导航元数据（图标均为本地 MDI 集已注册图标） */
const sections: { id: SettingsSection, icon: string, labelKey: string }[] = [
  {
    id: "general",
    icon: "mdi:tune",
    labelKey: "settingsSectionGeneral",
  },
  {
    id: "display",
    icon: "mdi:eye-outline",
    labelKey: "settingsSectionDisplay",
  },
  {
    id: "accounts",
    icon: "mdi:account-key-outline",
    labelKey: "settingsSectionAccounts",
  },
  {
    id: "gitconfig",
    icon: "mdi:source-branch",
    labelKey: "settingsSectionGitConfig",
  },
]

const activeSection = ref<SettingsSection>("general")
// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（同其他弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef
</script>

<style lang="scss">
@use "../../styles/SettingsDialog.scss";
@use "../../styles/index.scss";
</style>
