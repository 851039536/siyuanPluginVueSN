<!-- 高级搜索语法帮助面板：语法标签（共享 Button）点击插入到搜索框 -->
<template>
  <div class="vp-adv-help">
    <div class="vp-adv-help__header">
      <!-- 面板标题："高级搜索语法" -->
      <span class="vp-adv-help__label">{{ i18n.advHelpTitle }}</span>
      <!-- 面板提示："点击标签插入到搜索框" -->
      <span class="vp-adv-help__hint">{{ i18n.advHelpHint }}</span>
    </div>
    <div class="vp-adv-help__tags">
      <!-- 语法标签（label/desc 走 i18n：扩展名/文件大小/修改日期等）
           ⚠️ 选 Button 而非 Tag：这些标签是「点击即执行动作」的按钮（插入语法），
           不是行内标签/徽标 —— Tag 自身无原生 button 语义，需靠透传 role/tabindex 硬凑，
           且其语义边界（AGENTS.md § 共享组件库 3）明确限定在「自身即内容」的展示场景 -->
      <Button
        v-for="item in syntaxList"
        :key="item.keyword"
        class="vp-adv-help__tag"
        variant="ghost"
        outlined
        size="xsmall"
        :title="item.desc"
        :aria-label="`${item.keyword} ${item.label}`"
        @click="insertSyntax(item.keyword)"
      >
        <code class="vp-adv-help__code">{{ item.keyword }}</code>
        <span class="vp-adv-help__desc">{{ item.label }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Button from "@/components/Button.vue"

interface Props {
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

/** 语法标签渲染项 */
interface SyntaxItem {
  /** Everything 语法关键字（不翻译） */
  keyword: string
  /** 中文名（i18n） */
  label: string
  /** 用法示例（i18n） */
  desc: string
}

interface Emits {
  (e: "insert", keyword: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 语法说明列表的键序（keyword 为 Everything 语法不翻译，label/desc 取 i18n 文案键） */
const SYNTAX_KEYS: readonly [keyword: string, labelKey: string, descKey: string][] = [
  ["ext:", "extension", "syntaxExtDesc"],
  ["size:", "fileSize", "syntaxSizeDesc"],
  ["date:", "modDate", "syntaxDateDesc"],
  ["attrib:", "syntaxAttrib", "syntaxAttribDesc"],
  ["child:", "syntaxChild", "syntaxChildDesc"],
  ["parent:", "syntaxParent", "syntaxParentDesc"],
  ["type:", "syntaxType", "syntaxTypeDesc"],
  ["dupe:", "syntaxDupe", "syntaxDupeDesc"],
  ["empty:", "syntaxEmpty", "syntaxEmptyDesc"],
  ["len:", "syntaxLen", "syntaxLenDesc"],
  ["|", "syntaxOr", "syntaxOrDesc"],
  ["!", "syntaxNot", "syntaxNotDesc"],
  ["\"\"", "syntaxExact", "syntaxExactDesc"],
  ["\\ ", "syntaxEscape", "syntaxEscapeDesc"],
]

/** 语法说明列表（i18n 文案 → 渲染项，集中在 computed 内一次映射） */
const syntaxList = computed<SyntaxItem[]>(() =>
  SYNTAX_KEYS.map(([keyword, labelKey, descKey]) => ({
    keyword,
    label: props.i18n[labelKey] ?? labelKey,
    desc: props.i18n[descKey] ?? descKey,
  })),
)

/** 点击语法标签：派发 keyword 给父层插入搜索框 */
const insertSyntax = (keyword: string) => {
  emit("insert", keyword)
}
</script>

<style scoped lang="scss">
@use "../styles/AdvancedHelpPanel.scss";
</style>
