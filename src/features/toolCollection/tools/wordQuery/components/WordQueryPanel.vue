<!-- 单词查询面板 — 输入、高级选项、结果展示、复制/播放/导出操作 -->
<template>
  <div class="word-query-mode-content">
    <div class="input-section">
      <div class="input-wrapper">
        <Input
          v-model="searchWord"
          :placeholder="i18n.enterWordPlaceholder || '输入单词或词语，2秒后自动查询...'"
          @keydown.enter="handleQuery"
        />
        <Button
          class="query-btn"
          :disabled="isLoading"
          :loading="isLoading"
          @click="handleQuery"
        >
          <IconWrapper
            name="search"
            :size="16"
          />
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          :title="i18n.advancedOptions || '高级选项'"
          @click="togglePanel('advanced')"
        >
          <IconWrapper
            name="generalSettings"
            :size="18"
          />
        </Button>
      </div>
    </div>

    <div
      v-if="activePanel"
      class="common-panel"
    >
      <div class="panel-header">
        <span>
          <IconWrapper
            :name="getPanelConfig(activePanel).iconKey"
            :size="16"
          />
          {{ getPanelConfig(activePanel).title }}
        </span>
        <div class="panel-actions">
          <Button
            variant="ghost"
            size="xsmall"
            @click="togglePanel(null)"
          >
            <IconWrapper
              name="close"
              :size="16"
            />
          </Button>
        </div>
      </div>

      <div
        v-if="activePanel === 'advanced'"
        class="panel-content advanced-content"
      >
        <div class="option-group">
          <label class="option-label">
            <IconWrapper
              name="pronunciation"
              :size="16"
            />
            <span>{{ i18n.pronunciation || '发音设置' }}</span>
          </label>
          <div class="option-row">
            <label class="radio-label">
              <input
                v-model="pronunciationType"
                type="radio"
                value="uk"
              />
              <span>{{ i18n.britishPronunciation || '英式发音' }}</span>
            </label>
            <label class="radio-label">
              <input
                v-model="pronunciationType"
                type="radio"
                value="us"
              />
              <span>{{ i18n.americanPronunciation || '美式发音' }}</span>
            </label>
          </div>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input
              v-model="autoPlayPronunciation"
              type="checkbox"
            />
            <IconWrapper
              name="play"
              :size="16"
            />
            <span>{{ i18n.autoPlayPronunciation || '查询后自动播放发音' }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="query-content">
      <div
        v-if="isLoading"
        class="query-loading"
      >
        <p>{{ i18n.querying || '正在查询...' }}</p>
      </div>

      <div
        v-else-if="errorMessage"
        class="query-error"
      >
        <p>{{ errorMessage }}</p>
      </div>

      <div
        v-else-if="queryResult"
        class="query-result"
      >
        <div
          class="result-content"
          v-html="formattedResult"
        ></div>
        <div class="result-actions">
          <div ref="copyDropdownRef">
            <Button
              variant="secondary"
              size="xsmall"
              @click="toggleCopyOptions"
            >
              <IconWrapper
                name="contentCopy"
                :size="16"
              />
              {{ i18n.copy || '复制' }}
              <IconWrapper
                name="down"
                :size="12"
              />
            </Button>
            <div v-show="showCopyOptions">
              <Button
                variant="ghost"
                size="xsmall"
                @click="handleCopy('all')"
              >
                {{ i18n.copyAll || '复制全部' }}
              </Button>
              <Button
                variant="ghost"
                size="xsmall"
                @click="handleCopy('phonetic')"
              >
                {{ i18n.copyPhonetic || '复制音标' }}
              </Button>
              <Button
                variant="ghost"
                size="xsmall"
                @click="handleCopy('meaning')"
              >
                {{ i18n.copyMeaning || '复制释义' }}
              </Button>
              <Button
                v-if="extractContentParts.english"
                variant="ghost"
                size="xsmall"
                @click="handleCopy('english')"
              >
                {{ i18n.copyEnglish || '复制英文' }}
              </Button>
              <Button
                variant="ghost"
                size="xsmall"
                @click="handleCopy('pronunciation')"
              >
                {{ i18n.copyPronunciation || '复制谐音' }}
              </Button>
              <Button
                variant="ghost"
                size="xsmall"
                @click="handleCopy('example')"
              >
                {{ i18n.copyExample || '复制例句' }}
              </Button>
            </div>
          </div>

          <Button
            variant="secondary"
            size="xsmall"
            @click="playPronunciation(searchWord)"
          >
            <IconWrapper
              name="play"
              :size="16"
            />
            {{ i18n.play || '播放' }}
          </Button>

          <Button
            variant="secondary"
            size="xsmall"
            @click="handleExport"
          >
            <IconWrapper
              name="up"
              :size="16"
            />
            {{ i18n.export || '导出' }}
          </Button>

          <Button
            variant="ghost"
            size="xsmall"
            @click="clearResult"
          >
            <IconWrapper
              name="delete"
              :size="16"
            />
            {{ i18n.clear || '清除' }}
          </Button>
        </div>
      </div>

      <div
        v-else
        class="query-empty"
      >
        <div class="empty-icon">
          <IconWrapper
            name="wordQuery"
            :size="48"
          />
        </div>
        <p>{{ i18n.enterWordHint || '输入中英文单词或词语查询释义、音标、谐音等信息' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import type { WordQueryComponentProps } from "../types"
import { useWordQuery } from "../composables/useWordQuery"
import { useSettings } from "../composables/useSettings"

const props = defineProps<WordQueryComponentProps>()

const i18n = props.i18n

// 设置（发音偏好）
const {
  pronunciationType,
  autoPlayPronunciation,
  init: initSettings,
} = useSettings(props.plugin)

// 查询核心逻辑
const {
  searchWord,
  queryResult,
  isLoading,
  errorMessage,
  showCopyOptions,
  formattedResult,
  extractContentParts,
  handleQuery,
  clearResult,
  playPronunciation,
  toggleCopyOptions,
  copyResult,
  exportContent,
  clearTimer,
  handleClickOutside,
} = useWordQuery(props.plugin, pronunciationType, autoPlayPronunciation)

// 高级选项面板
const activePanel = ref<string | null>(null)

const togglePanel = (panelKey: string | null) => {
  activePanel.value = activePanel.value === panelKey ? null : panelKey
}

const panelConfig = computed(() => ({
  advanced: {
    iconKey: "settings" as const,
    title: (i18n.advancedOptions as string) || "高级选项",
  },
}))

const getPanelConfig = (panel: string) => {
  return (
    panelConfig.value[panel as keyof typeof panelConfig.value] || {
      iconKey: "settings",
      title: "",
    }
  )
}

// 复制（传递 i18n 给 composable）
const handleCopy = (type: string) => {
  copyResult(type, i18n)
}

// 导出
const handleExport = () => {
  exportContent(i18n)
}

// 点击外部关闭复制下拉
const copyDropdownRef = ref<HTMLElement | null>(null)
const onClickOutside = (event: Event) => {
  handleClickOutside(event, copyDropdownRef)
}

onMounted(async () => {
  document.addEventListener("click", onClickOutside)
  await initSettings()
})

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside)
  speechSynthesis.cancel()
  clearTimer()
})
</script>

<style scoped lang="scss">
@use "@/variables.scss" as *;

.word-query-mode-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.input-section {
  padding: $spacing-4;
  border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);
  flex-shrink: 0;

  .input-wrapper {
    display: flex;
    gap: $spacing-2;
    width: 100%;
  }

  .query-btn {
    flex-shrink: 0;
  }
}

.query-content {
  flex: 1;
  padding: $spacing-4;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;

  .query-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--b3-theme-on-background, $brand-dark);
  }

  .query-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--b3-theme-error, $brand-orange);
    text-align: center;
  }

  .query-result {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    .result-content {
      flex: 1;
      overflow-y: auto;
      margin-bottom: $spacing-4;
      padding: $spacing-4;
      background: var(--b3-theme-background, $brand-light);
      border: 1px solid var(--b3-border-color, $brand-subtle-gray);
      border-radius: $radius-base;
      min-height: 100px;
      max-height: 300px;
      word-wrap: break-word;

      :deep(.result-title) {
        margin: 0 0 $spacing-4 0;
        color: var(--b3-theme-on-background, $brand-dark);
        font-family: $font-heading;
        font-size: $font-size-base;
        font-weight: $font-weight-semibold;
        text-align: center;
        padding-bottom: $spacing-4;
        border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);
      }

      :deep(.result-label) {
        display: inline-block;
        font-weight: $font-weight-semibold;
        color: var(--b3-theme-on-background, $brand-dark);
        margin-right: $spacing-2;
        min-width: 50px;
      }

      :deep(.result-wrapper) {
        padding: $spacing-4 0;
      }

      :deep(.result-section) {
        margin-bottom: $spacing-4;
        padding: $spacing-4;
        background: var(--b3-theme-background, $brand-light);
        border: 1px solid var(--b3-border-color, $brand-subtle-gray);
        border-radius: $radius-base;
        border-left: 3px solid;
        line-height: $line-height-normal;
        font-size: $font-size-sm;

        &:last-child {
          margin-bottom: 0;
        }

        strong {
          color: var(--b3-theme-on-background, $brand-dark);
          font-weight: $font-weight-semibold;
        }

        .result-label {
          font-weight: $font-weight-semibold;
        }

        &.word-section { border-left-color: var(--b3-theme-primary, $brand-orange); }
        &.phonetic-section { border-left-color: var(--b3-theme-primary, $brand-orange); .result-label { color: var(--b3-theme-primary, $brand-orange); } }
        &.english-section { border-left-color: var(--b3-theme-success, $brand-green); .result-label { color: var(--b3-theme-success, $brand-green); } }
        &.meaning-section { border-left-color: var(--b3-theme-warning, $brand-orange); .result-label { color: var(--b3-theme-warning, $brand-orange); } }
        &.pronunciation-section { border-left-color: var(--b3-theme-primary, $brand-blue); .result-label { color: var(--b3-theme-primary, $brand-blue); } }
        &.tip-section { border-left-color: var(--b3-theme-primary, $brand-orange); .result-label { color: var(--b3-theme-primary, $brand-orange); } }
        &.example-section { border-left-color: var(--b3-theme-secondary, $brand-mid-gray); .result-label { color: var(--b3-theme-secondary, $brand-mid-gray); } }
      }
    }

    .result-actions {
      display: flex;
      gap: $spacing-2;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
  }

  .query-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: $spacing-3;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    text-align: center;
    padding: $spacing-8 $spacing-4;

    .empty-icon {
      font-size: $font-size-2xl;
      margin-bottom: $spacing-1;
      opacity: 0.5;
      line-height: 1;
    }

    p {
      font-size: $font-size-sm;
      opacity: 0.6;
    }
  }
}

.common-panel {
  border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);
  background: var(--b3-theme-surface-lighter, $brand-light-gray);
  max-width: 100%;
  overflow: hidden;
  max-height: 300px;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-3 $spacing-4;
    font-weight: $font-weight-semibold;
    font-size: $font-size-sm;
    font-family: $font-heading;
    color: var(--b3-theme-on-background, $brand-dark);
    background: var(--b3-theme-background, $brand-light);
    border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);

    .panel-actions {
      display: flex;
      gap: $spacing-2;
      align-items: center;
    }
  }

  .panel-content {
    padding: $spacing-2;
    max-height: 240px;
    overflow-y: auto;
  }

  .advanced-content {
    padding: $spacing-4;

    .option-group {
      margin-bottom: $spacing-4;

      &:last-child {
        margin-bottom: 0;
      }

      .option-label {
        display: block;
        font-weight: $font-weight-medium;
        font-size: $font-size-sm;
        font-family: $font-heading;
        margin-bottom: $spacing-2;
        color: var(--b3-theme-on-background, $brand-dark);
      }

      .option-row {
        display: flex;
        gap: $spacing-4;
        flex-wrap: wrap;
      }

      .radio-label,
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: $spacing-2;
        font-size: $font-size-sm;
        color: var(--b3-theme-on-background, $brand-dark);
        cursor: pointer;
        padding: $spacing-2;
        border-radius: $radius-base;

        &:hover {
          background-color: var(--b3-theme-surface-lighter, $brand-light-gray);
        }

        input[type="radio"],
        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      }
    }
  }
}
</style>
