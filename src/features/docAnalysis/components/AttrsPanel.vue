<template>
  <div
    v-if="visible"
    class="attrs-panel-overlay"
    @click.self="$emit('close')"
  >
    <div class="attrs-panel">
      <div class="attrs-panel-header">
        <div class="header-title">
          <Icon
            icon="mdi:information-outline"
            class="header-icon"
          />
          <span>文档属性</span>
          <span
            v-if="attrs"
            class="header-doc-title"
          >{{ attrs.title || docId }}</span>
        </div>
        <button
          class="close-btn"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <div
        v-if="loading"
        class="attrs-loading"
      >
        <Icon
          icon="mdi:loading"
          class="loading-icon"
        />
        <span>加载属性中...</span>
      </div>

      <div
        v-else-if="error"
        class="attrs-error"
      >
        <Icon
          icon="mdi:alert-circle"
          class="error-icon"
        />
        <span>{{ error }}</span>
      </div>

      <div
        v-else-if="attrs"
        class="attrs-content"
      >
        <div class="publish-status-section">
          <div class="section-title">
            <Icon icon="mdi:cloud-check-outline" />
            平台发布状态
          </div>
          <div class="platform-status-list">
            <div
              v-for="platform in platforms"
              :key="platform.id"
              class="platform-status-item"
              :class="{ published: platform.published }"
            >
              <Icon
                :icon="platform.published ? 'mdi:check-circle' : 'mdi:minus-circle-outline'"
                class="status-icon"
              />
              <span class="platform-name">{{ platform.name }}</span>
              <span class="status-text">{{ platform.published ? '已发布' : '未发布' }}</span>
            </div>
          </div>
        </div>

        <div class="attrs-table">
          <div
            v-for="item in displayItems"
            :key="item.key"
            class="attr-row"
          >
            <div class="attr-key">{{ item.label }}</div>
            <div class="attr-value">
              <template v-if="item.isYaml">
                <div
                  class="yaml-toggle"
                  @click="toggleYaml(item.key)"
                >
                  <Icon
                    :icon="expandedYaml.has(item.key) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
                    class="toggle-icon"
                  />
                  <span class="yaml-label">YAML 内容</span>
                  <span class="yaml-size">({{ countYamlLines(item.value) }} 行)</span>
                </div>
                <pre
                  v-if="expandedYaml.has(item.key)"
                  class="yaml-content"
                >{{ item.value }}</pre>
              </template>
              <template v-else>
                <span
                  v-if="item.value"
                  class="attr-text"
                >{{ item.value }}</span>
                <span
                  v-else
                  class="attr-empty"
                >—</span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="attrs-panel-footer">
        <button
          class="footer-btn"
          @click="$emit('close')"
        >
          关闭
        </button>
        <button
          class="footer-btn copy-btn"
          @click="copyAllAttrs"
        >
          <Icon icon="mdi:content-copy" />
          复制全部
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"

interface Props {
  visible: boolean
  docId: string
  attrs: Record<string, string> | null
  loading: boolean
  error: string
}

const props = defineProps<Props>()

defineEmits<{
  (e: "close"): void
}>()

const expandedYaml = ref(new Set<string>())

function toggleYaml(key: string) {
  if (expandedYaml.value.has(key)) {
    expandedYaml.value.delete(key)
  }
  else {
    expandedYaml.value.add(key)
  }
  // 触发响应式
  expandedYaml.value = new Set(expandedYaml.value)
}

function countYamlLines(value: string): number {
  return value.split("\n").length
}

const CORE_ATTRS = new Set([
  "id", "type", "title", "alias", "memo", "bookmark", "tags",
  "icon", "updated", "created",
])

interface PlatformInfo {
  id: string
  name: string
  published: boolean
  matchKeys: string[]
}

const PLATFORM_CONFIGS = [
  { id: "csdn", name: "CSDN", matchers: ["csdn"] },
  { id: "zhihu", name: "知乎", matchers: ["zhihu"] },
  { id: "juejin", name: "掘金", matchers: ["juejin"] },
  { id: "blog", name: "博客园", matchers: ["cnblogs", "blog"] },
  { id: "bibi", name: "B站", matchers: ["bili", "bibi"] },
  { id: "gzh", name: "公众号", matchers: ["gzh"] },
]

const platforms = computed<PlatformInfo[]>(() => {
  if (!props.attrs) return PLATFORM_CONFIGS.map(c => ({ id: c.id, name: c.name, published: false, matchKeys: [] }))

  const yamlKeys = Object.keys(props.attrs).filter(k => k.endsWith("-yaml"))

  return PLATFORM_CONFIGS.map(config => {
    const matchedKey = yamlKeys.find(k => {
      const lower = k.toLowerCase()
      return config.matchers.some(m => lower.includes(m))
    })
    const published = !!matchedKey && !!(props.attrs![matchedKey]?.trim())
    const matchKeys = matchedKey ? [matchedKey] : []
    return { id: config.id, name: config.name, published, matchKeys }
  })
})

const ATTR_LABELS: Record<string, string> = {
  id: "ID",
  type: "类型",
  title: "标题",
  alias: "别名",
  memo: "备注",
  bookmark: "书签",
  tags: "标签",
  icon: "图标",
  updated: "更新时间",
  created: "创建时间",
}

interface DisplayItem {
  key: string
  label: string
  value: string
  isYaml: boolean
}

const displayItems = computed<DisplayItem[]>(() => {
  if (!props.attrs) return []

  const items: DisplayItem[] = []

  const sortedKeys = Object.keys(props.attrs).sort((a, b) => {
    const aCore = CORE_ATTRS.has(a) ? 0 : 1
    const bCore = CORE_ATTRS.has(b) ? 0 : 1
    return aCore - bCore
  })

  for (const key of sortedKeys) {
    const value = props.attrs[key]
    const isYaml = key.startsWith("custom-") && key.endsWith("-yaml")

    let label = key
    if (isYaml) {
      // 提取平台名：custom-csdn-yaml -> CSDN
      const platformName = key
        .replace(/^custom-/, "")
        .replace(/-yaml$/, "")
        .replace(/^custom-/, "")
      label = `${platformName} 配置`
    }
    else if (ATTR_LABELS[key]) {
      label = ATTR_LABELS[key]
    }

    items.push({ key, label, value, isYaml })
  }

  return items
})

async function copyAllAttrs() {
  if (!props.attrs) return
  const text = Object.entries(props.attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
  try {
    await navigator.clipboard.writeText(text)
  }
  catch {
    // fallback
  }
}
</script>

<style lang="scss" scoped>
.attrs-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.attrs-panel {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.attrs-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--b3-border-color);

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    min-width: 0;

    .header-icon {
      font-size: 18px;
      color: var(--b3-theme-primary);
      flex-shrink: 0;
    }

    .header-doc-title {
      font-size: 13px;
      font-weight: 400;
      color: var(--b3-theme-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-left: 12px;
      padding-left: 12px;
      border-left: 1px solid var(--b3-border-color);
    }
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--b3-theme-on-surface-variant);
    cursor: pointer;
    font-size: 18px;
    flex-shrink: 0;

    &:hover {
      background: var(--b3-theme-surface-light);
      color: var(--b3-theme-on-background);
    }
  }
}

.attrs-loading,
.attrs-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 14px;
  gap: 10px;

  .loading-icon {
    font-size: 32px;
    color: var(--b3-theme-primary);
  }

  .error-icon {
    font-size: 32px;
    color: var(--b3-theme-error, #ef4444);
  }
}

.attrs-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-scroll-color);
    border-radius: 3px;
  }
}

.publish-status-section {
  padding: 14px 18px;
  border-bottom: 1px solid var(--b3-border-color);

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    margin-bottom: 10px;
  }

  .platform-status-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .platform-status-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 12px;
    background: var(--b3-theme-surface-light);
    color: var(--b3-theme-on-surface-variant);

    .status-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .platform-name {
      font-weight: 500;
    }

    .status-text {
      opacity: 0.7;
      font-size: 11px;
    }

    &.published {
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;

      .status-icon {
        color: #22c55e;
      }
    }
  }
}

.attrs-table {
  .attr-row {
    display: flex;
    border-bottom: 1px solid var(--b3-border-color-light, rgba(0, 0, 0, 0.04));

    &:last-child {
      border-bottom: none;
    }
  }

  .attr-key {
    width: 160px;
    flex-shrink: 0;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-surface-variant);
    background: var(--b3-theme-surface, rgba(0, 0, 0, 0.02));
    word-break: break-all;
  }

  .attr-value {
    flex: 1;
    padding: 10px 16px;
    font-size: 13px;
    color: var(--b3-theme-on-background);
    word-break: break-all;
    min-width: 0;

    .attr-text {
      line-height: 1.5;
    }

    .attr-empty {
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.5;
    }
  }

  .yaml-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 2px 0;
    user-select: none;

    .toggle-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .yaml-label {
      font-weight: 500;
    }

    .yaml-size {
      font-size: 12px;
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.7;
    }

    &:hover {
      color: var(--b3-theme-primary);
    }
  }

  .yaml-content {
    margin-top: 8px;
    padding: 10px 14px;
    background: var(--b3-theme-surface, rgba(0, 0, 0, 0.03));
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--b3-border-color-light, rgba(0, 0, 0, 0.06));

    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--b3-scroll-color);
      border-radius: 2px;
    }
  }
}

.attrs-panel-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--b3-border-color);

  .footer-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    cursor: pointer;

    &:hover {
      background: var(--b3-theme-surface-light);
    }
  }

  .copy-btn {
    color: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);

    &:hover {
      background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
    }
  }
}
</style>
