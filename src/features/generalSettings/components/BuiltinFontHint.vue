<!-- 内置字体提示条：命中随插件分发字体时显示无需系统安装的提示 -->
<template>
  <p
    v-if="isBuiltin"
    class="builtin-font-hint"
  >
    <IconWrapper
      name="checkCircle"
      :size="13"
      class="builtin-font-hint-icon"
    />
    {{ i18n.builtinFontHint }}
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { isBuiltinFontFamily } from "../utils/styles"

interface Props {
  /** 当前选中的字体族，用于判断是否命中内置字体 */
  fontFamily: string
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

/** 当前字体是否命中任一内置字体（随插件分发，无需系统安装） */
const isBuiltin = computed(() => isBuiltinFontFamily(props.fontFamily))
</script>

<style scoped lang="scss">
@use "../styles/BuiltinFontHint.scss";
</style>
