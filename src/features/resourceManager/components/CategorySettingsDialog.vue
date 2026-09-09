<!-- 分类设置弹窗：集中管理可见分类（删除空分类）与被隐藏的内置分类（恢复），数据均由父层 computed 驱动 -->
<template>
  <Teleport to="body">
    <Transition name="rm-settings-fade">
      <!-- 遮罩点击关闭 -->
      <div
        class="rm-settings-mask"
        @click.self="emit('close')"
      >
        <!-- 弹窗卡片 -->
        <div class="rm-settings-dialog">
          <!-- 弹窗头部 -->
          <div class="rm-settings-dialog__header">
            <!-- 标题："分类设置" -->
            <span class="rm-settings-dialog__title">{{ i18n.categorySettings }}</span>
            <!-- 按钮："关闭" -->
            <button
              class="rm-settings-icon"
              :title="i18n.cancel"
              @click="emit('close')"
            >
              <IconWrapper
                name="close"
                :size="14"
              />
            </button>
          </div>
          <!-- 弹窗内容 -->
          <div class="rm-settings-dialog__body">
            <!-- 规则说明 -->
            <div class="rm-settings-dialog__hint">
              {{ i18n.categorySettingsHint }}
            </div>
            <!-- 可见分类区 -->
            <div class="rm-settings-section">
              <!-- 空状态："暂无可管理分类" -->
              <div
                v-if="categories.length === 0"
                class="rm-settings-empty"
              >
                {{ i18n.noCategories }}
              </div>
              <!-- 分类条目：名称 + 内置标记 + 删除（空分类可删） -->
              <div
                v-for="cat in categories"
                :key="cat.key"
                class="rm-settings-row"
              >
                <span
                  class="rm-settings-row__name"
                  :title="cat.key"
                >{{ cat.label }}</span>
                <!-- 徽标："内置" -->
                <span
                  v-if="cat.builtIn"
                  class="rm-settings-row__badge"
                >{{ i18n.categoryBuiltIn }}</span>
                <!-- 删除按钮 title："删除分类" -->
                <button
                  class="rm-settings-icon rm-settings-icon--danger"
                  :title="i18n.deleteCategory"
                  @click="emit('delete', cat)"
                >
                  <IconWrapper
                    name="delete"
                    :size="13"
                  />
                </button>
              </div>
            </div>
            <!-- 已隐藏的内置分类区 -->
            <div
              v-if="hiddenBuiltIns.length > 0"
              class="rm-settings-section"
            >
              <!-- 标题："已隐藏 (N)" -->
              <div class="rm-settings-section__title">
                {{ i18n.hiddenCategories }} ({{ hiddenBuiltIns.length }})
              </div>
              <!-- 隐藏分类条目：名称 + 恢复 -->
              <div
                v-for="item in hiddenBuiltIns"
                :key="item.key"
                class="rm-settings-row"
              >
                <span
                  class="rm-settings-row__name rm-settings-row__name--muted"
                  :title="item.key"
                >{{ item.label }}</span>
                <!-- 按钮："恢复" -->
                <button
                  class="rm-btn small"
                  @click="emit('restore', item.key)"
                >
                  {{ i18n.restore }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { CategoryItem, ResourceManagerI18n } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  i18n: ResourceManagerI18n
  /** 可见分类（内置 + 自定义），删除后由父层 computed 自动移除 */
  categories: CategoryItem[]
  /** 被隐藏的内置分类（恢复入口） */
  hiddenBuiltIns: CategoryItem[]
}

interface Emits {
  /** 关闭弹窗 */
  (e: "close"): void
  /** 请求删除分类条目 */
  (e: "delete", cat: CategoryItem): void
  /** 恢复被隐藏的内置分类 */
  (e: "restore", key: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped lang="scss">
@use "../styles/CategorySettingsDialog.scss";
@use "../styles/index.scss";
</style>
