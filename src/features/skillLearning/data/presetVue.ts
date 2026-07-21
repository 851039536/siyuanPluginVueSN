/**
 * 技能学习 - 内置预设卡片数据（Vue 5 张）
 */
import type { CreateSkillDTO } from "../types"

export const PRESET_CARDS_VUE: CreateSkillDTO[] = [
  {
    title: "Vue 3 Composition API 中 ref 和 reactive 的区别？",
    answer: "ref 用于基本类型和任意值，需要 .value 访问；reactive 用于对象类型，直接访问属性无需 .value。ref 在模板中会自动解包。",
    distractors: [
      "ref 和 reactive 完全相同，没有任何区别",
      "reactive 在模板中也需要 .value 访问",
      "ref 只能用于对象，reactive 只能用于基本类型",
    ],
    codeSnippet:
      "import { ref, reactive } from 'vue';\n\n// ref - 基本类型\nconst count = ref(0);\nconsole.log(count.value); // 0\n\n// reactive - 对象\nconst state = reactive({\n  user: { name: 'Alice' },\n  items: [],\n});\nstate.user.name = 'Bob'; // 直接访问\n\n// 模板中 ref 自动解包\n// <span>{{ count }}</span> 而非 count.value",
    language: "vue",
    category: "Composition API",
    difficulty: "beginner",
    tags: ["ref", "reactive", "响应式"],
  },
  {
    title: "Vue 3 的 computed 和 watch 有什么区别？",
    answer: "computed 用于派生状态（有缓存，依赖变化才重算），watch 用于监听变化并执行副作用（如 API 调用、DOM 操作）。",
    distractors: [
      "computed 没有缓存，每次访问都重新计算",
      "watch 会自动缓存计算结果",
      "computed 可以直接执行异步操作",
    ],
    codeSnippet:
      "import { ref, computed, watch } from 'vue';\n\nconst firstName = ref('John');\nconst lastName = ref('Doe');\n\n// computed - 派生状态，有缓存\nconst fullName = computed(() => `${firstName.value} ${lastName.value}`);\n\n// watch - 执行副作用\nwatch([firstName, lastName], ([newFirst, newLast]) => {\n  console.log(`Name changed to: ${newFirst} ${newLast}`);\n  saveToLocalStorage({ first: newFirst, last: newLast });\n});",
    language: "vue",
    category: "Composition API",
    difficulty: "beginner",
    tags: ["computed", "watch", "响应式"],
  },
  {
    title: "Vue 3 的生命周期钩子有哪些？",
    answer: "setup 替代 beforeCreate/created。常用：onMounted、onUpdated、onUnmounted。调试用：onBeforeMount、onBeforeUpdate、onBeforeUnmount。",
    distractors: [
      "Vue 3 中 beforeCreate 和 created 仍然是最常用的钩子",
      "onMounted 在组件创建之前执行",
      "onUnmounted 会在组件更新时触发",
    ],
    codeSnippet:
      "import { onMounted, onUnmounted, onUpdated } from 'vue';\n\nexport default {\n  setup() {\n    onMounted(() => {\n      console.log('组件已挂载');\n      fetchData();\n    });\n\n    onUpdated(() => {\n      console.log('组件已更新');\n    });\n\n    onUnmounted(() => {\n      console.log('组件即将卸载');\n      clearInterval(timer);\n    });\n  },\n};",
    language: "vue",
    category: "组件基础",
    difficulty: "beginner",
    tags: ["生命周期", "hooks"],
  },
  {
    title: "Vue 中 v-if 和 v-show 的区别？",
    answer: "v-if 条件为假时元素不会渲染到 DOM（有切换开销），v-show 始终渲染但通过 CSS display 控制可见性（有初始渲染开销）。频繁切换用 v-show，条件很少改变用 v-if。",
    distractors: [
      "v-show 在条件为假时会完全移除 DOM 元素",
      "v-if 性能始终优于 v-show，无论使用场景",
      "v-show 支持 v-else，v-if 不支持",
    ],
    codeSnippet:
      '<!-- v-if: 条件假时 DOM 不存在 -->\n<div v-if="isLoggedIn">欢迎回来，用户！</div>\n<div v-else>请先登录</div>\n\n<!-- v-show: 始终渲染，通过 display 切换 -->\n<div v-show="isModalOpen">\n  <Modal />\n</div>\n\n<!-- 建议：频繁切换用 v-show，一次性判断用 v-if -->',
    language: "vue",
    category: "模板语法",
    difficulty: "beginner",
    tags: ["v-if", "v-show", "指令"],
  },
  {
    title: "Vue 3 的 Teleport 组件有什么用？",
    answer: "Teleport 将组件内容渲染到 DOM 中指定的目标元素下（如 body 末尾），常用于模态框、通知、下拉菜单等需要脱离组件层级约束的场景。",
    distractors: [
      "Teleport 用于在组件间传递数据，类似 props",
      "Teleport 可以让组件内容在多个位置同时渲染",
      "Teleport 是 Vue Router 的功能，用于页面跳转",
    ],
    codeSnippet:
      '<!-- Modal.vue -->\n<template>\n  <Teleport to="body">\n    <div class="modal-overlay" @click.self="$emit(\'close\')">\n      <div class="modal-content">\n        <h2>{{ title }}</h2>\n        <slot />\n        <button @click="$emit(\'close\')">关闭</button>\n      </div>\n    </div>\n  </Teleport>\n</template>\n<!-- 渲染后 modal 出现在 <body> 末尾，不受父组件 overflow/层级影响 -->',
    language: "vue",
    category: "组件进阶",
    difficulty: "intermediate",
    tags: ["Teleport", "模态框", "Portal"],
  },
]
