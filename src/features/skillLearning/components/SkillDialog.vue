<!-- 技能学习 - 新建/编辑卡片弹窗 -->
<template>
  <div
    class="skill-dialog-overlay"
    @click.self="$emit('close')"
  >
    <div class="skill-dialog">
      <h3 class="skill-dialog__title">
        {{ isEdit ? t.editCard : t.addCard }}
      </h3>
      <div class="skill-dialog__body">
        <label class="skill-dialog__label">{{ t.title_ }}</label>
        <div class="skill-dialog__title-row">
          <input
            v-model="form.title"
            class="skill-dialog__input"
            placeholder="输入题目..."
          />
          <button
            class="skill-dialog__ai-btn"
            :disabled="!form.title.trim() || aiGenerating"
            :title="t.aiGenerate"
            @click="aiGenerate"
          >
            <span
              v-if="aiGenerating"
              class="skill-dialog__ai-spinner"
            />
            <span v-else><IconWrapper name="sparkles" /></span>
          </button>
        </div>
        <div
          v-if="aiError"
          class="skill-dialog__ai-error"
        >
          {{ aiError }}
        </div>

        <label class="skill-dialog__label">{{ t.answer }}</label>
        <textarea
          v-model="form.answer"
          class="skill-dialog__textarea"
          rows="3"
          placeholder="输入正确答案..."
        />

        <label class="skill-dialog__label">{{ t.distractors }}</label>
        <input
          v-model="form.distractor1"
          class="skill-dialog__input"
          :placeholder="t.distractor1"
        />
        <input
          v-model="form.distractor2"
          class="skill-dialog__input"
          :placeholder="t.distractor2"
        />
        <input
          v-model="form.distractor3"
          class="skill-dialog__input"
          :placeholder="t.distractor3"
        />

        <label class="skill-dialog__label">{{ t.codeSnippet }}</label>
        <textarea
          v-model="form.codeSnippet"
          class="skill-dialog__textarea skill-dialog__code"
          rows="5"
          placeholder="输入代码片段..."
          spellcheck="false"
        />

        <div class="skill-dialog__row">
          <div class="skill-dialog__field">
            <label class="skill-dialog__label">{{ t.language }}</label>
            <!-- 下拉：共享 Select（纯受控 ⇒ 显式回写 form） -->
            <Select
              class="skill-dialog__select"
              :model-value="form.language"
              :options="languageSelectOptions"
              size="xsmall"
              :aria-label="t.language"
              @update:model-value="(v) => form.language = toStr(v)"
            />
          </div>
          <div class="skill-dialog__field">
            <label class="skill-dialog__label">{{ t.difficulty }}</label>
            <Select
              class="skill-dialog__select"
              :model-value="form.difficulty"
              :options="difficultySelectOptions"
              size="xsmall"
              :aria-label="t.difficulty"
              @update:model-value="(v) => form.difficulty = toStr(v) as Difficulty"
            />
          </div>
        </div>

        <label class="skill-dialog__label">{{ t.category }}</label>
        <input
          v-model="form.category"
          class="skill-dialog__input"
          placeholder="如: 异步编程, 设计模式..."
        />

        <label class="skill-dialog__label">{{ t.tags }}</label>
        <input
          v-model="tagsInput"
          class="skill-dialog__input"
          placeholder="标签用逗号分隔"
        />
      </div>
      <div class="skill-dialog__footer">
        <button
          class="skill-dialog__btn skill-dialog__btn--cancel"
          @click="$emit('close')"
        >
          {{ t.cancel }}
        </button>
        <button
          class="skill-dialog__btn skill-dialog__btn--save"
          @click="handleSave"
        >
          {{ t.save }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  CreateSkillDTO,
  Difficulty,
  Language,
  SkillCard,
  SkillI18n,
} from "../types"
import {
  computed,
  reactive,
  ref,
} from "vue"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import { LANGUAGE_OPTIONS } from "../composables/useLangLabel"
import { DIFFICULTY_I18N_KEYS } from "../types"

const props = defineProps<{
  i18n: Required<SkillI18n>
  plugin: Plugin
  editCard?: SkillCard | null
}>()

const emit = defineEmits<{
  save: [dto: CreateSkillDTO]
  update: [id: string, dto: CreateSkillDTO]
  close: []
}>()

const isEdit = computed(() => !!props.editCard)
const t = computed(() => props.i18n)

/** Select 载荷归一为字符串（组件载荷为 string | number | boolean | null） */
function toStr(value: string | number | boolean | null): string {
  return value === null ? "" : String(value)
}

/** 语言下拉选项（LANGUAGE_OPTIONS 用 key，需映射为 Select 的 value） */
const languageSelectOptions = computed(() =>
  LANGUAGE_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label })),
)

/** 难度下拉选项（标签复用 DIFFICULTY_I18N_KEYS，与 DifficultyBadge 同源） */
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"]
const difficultySelectOptions = computed(() =>
  DIFFICULTIES.map((d) => ({ value: d, label: props.i18n[DIFFICULTY_I18N_KEYS[d]] })),
)

const tagsInput = ref(props.editCard?.tags.join(", ") || "")
const aiGenerating = ref(false)
const aiError = ref("")

const form = reactive({
  title: props.editCard?.title || "",
  answer: props.editCard?.answer || "",
  distractor1: props.editCard?.distractors?.[0] || "",
  distractor2: props.editCard?.distractors?.[1] || "",
  distractor3: props.editCard?.distractors?.[2] || "",
  codeSnippet: props.editCard?.codeSnippet || "",
  language: (props.editCard?.language || "other") as Language,
  category: props.editCard?.category || "",
  difficulty: (props.editCard?.difficulty || "beginner") as Difficulty,
})

// --- AI 生成 ---
async function aiGenerate() {
  const title = form.title.trim()
  if (!title || aiGenerating.value) return

  aiGenerating.value = true
  aiError.value = ""
  try {
    const aiConfig = getApiConfigFromPlugin(props.plugin)
    const prompt = `为以下技术题目生成学习卡片内容：
题目：${title}

请输出严格 JSON（不要任何前缀或解释）：
{
  "title": "润色后的题目（更清晰专业，保留原意）",
  "answer": "简洁准确的答案（1-3句话）",
  "codeSnippet": "与题目相关的代表性代码示例（5-15行，语言根据题目推断）",
  "distractors": ["错误但看似合理的选项1", "错误选项2", "错误选项3"],
  "category": "所属分类（如：异步编程、基础语法、设计模式）",
  "tags": ["标签1", "标签2", "标签3"]
}

关键要求：
- distractors 每条字符串长度必须与 answer 接近（±30%），避免因长度差异被轻易排除
- codeSnippet 用真实可运行的代码，标注语言类型
`

    const result = await callAI(prompt, aiConfig, {
      systemPrompt: "你是编程技能导师，专门为技术学习卡片生成高质量内容。题目润色要专业清晰，答案要简洁准确，代码要真实可运行，干扰项要看似合理且长度与答案匹配。只输出JSON，禁止任何解释。",
      temperature: 0.5,
      maxTokens: 1000,
      responseFormat: { type: "json_object" },
    })

    const parsed = JSON.parse(result)
    if (parsed.title) form.title = parsed.title
    if (parsed.answer) form.answer = parsed.answer
    if (parsed.codeSnippet) form.codeSnippet = parsed.codeSnippet
    if (Array.isArray(parsed.distractors)) {
      form.distractor1 = parsed.distractors[0] || ""
      form.distractor2 = parsed.distractors[1] || ""
      form.distractor3 = parsed.distractors[2] || ""
    }
    if (parsed.category) form.category = parsed.category
    if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
      tagsInput.value = parsed.tags.join(", ")
    }
  } catch (err: unknown) {
    aiError.value = t.value.aiGenerateFailed
    console.warn("AI 生成失败:", err)
  } finally {
    aiGenerating.value = false
  }
}

function handleSave() {
  if (!form.title.trim() || !form.answer.trim()) return
  const distractors = [form.distractor1, form.distractor2, form.distractor3]
    .map((d) => d.trim())
    .filter(Boolean)
  const dto: CreateSkillDTO = {
    title: form.title.trim(),
    answer: form.answer.trim(),
    distractors: distractors.length > 0 ? distractors : undefined,
    codeSnippet: form.codeSnippet.trim(),
    language: form.language,
    category: form.category.trim() || "默认",
    difficulty: form.difficulty,
    tags: tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean),
  }
  if (isEdit.value) {
    emit("update", props.editCard!.id, dto)
  } else {
    emit("save", dto)
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/SkillDialog.scss";
</style>
