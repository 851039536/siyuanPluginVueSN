<template>
  <div class="skill-dialog-overlay" @click.self="$emit('close')">
    <div class="skill-dialog">
      <h3 class="skill-dialog__title">{{ isEdit ? t.editCard : t.addCard }}</h3>
      <div class="skill-dialog__body">
        <label class="skill-dialog__label">{{ t.title_ }}</label>
        <div class="skill-dialog__title-row">
          <input v-model="form.title" class="skill-dialog__input" placeholder="输入题目..." />
          <button
            class="skill-dialog__ai-btn"
            :disabled="!form.title.trim() || aiGenerating"
            @click="aiGenerate"
            :title="t.aiGenerate || 'AI 生成答案'"
          >
            <span v-if="aiGenerating" class="skill-dialog__ai-spinner" />
            <span v-else>✨</span>
          </button>
        </div>
        <div v-if="aiError" class="skill-dialog__ai-error">{{ aiError }}</div>

        <label class="skill-dialog__label">{{ t.answer }}</label>
        <textarea v-model="form.answer" class="skill-dialog__textarea" rows="3" placeholder="输入正确答案..." />

        <label class="skill-dialog__label">{{ t.distractors || '干扰项（错误选项）' }}</label>
        <input v-model="form.distractor1" class="skill-dialog__input" :placeholder="t.distractor1 || '错误选项 1'" />
        <input v-model="form.distractor2" class="skill-dialog__input" :placeholder="t.distractor2 || '错误选项 2'" />
        <input v-model="form.distractor3" class="skill-dialog__input" :placeholder="t.distractor3 || '错误选项 3'" />

        <label class="skill-dialog__label">{{ t.codeSnippet }}</label>
        <textarea v-model="form.codeSnippet" class="skill-dialog__textarea skill-dialog__code" rows="5" placeholder="输入代码片段..." spellcheck="false" />

        <div class="skill-dialog__row">
          <div class="skill-dialog__field">
            <label class="skill-dialog__label">{{ t.language }}</label>
            <select v-model="form.language" class="skill-dialog__select">
              <option value="csharp">C#</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="vue">Vue</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="skill-dialog__field">
            <label class="skill-dialog__label">{{ t.difficulty }}</label>
            <select v-model="form.difficulty" class="skill-dialog__select">
              <option value="beginner">{{ t.beginner }}</option>
              <option value="intermediate">{{ t.intermediate }}</option>
              <option value="advanced">{{ t.advanced }}</option>
            </select>
          </div>
        </div>

        <label class="skill-dialog__label">{{ t.category }}</label>
        <input v-model="form.category" class="skill-dialog__input" placeholder="如: 异步编程, 设计模式..." />

        <label class="skill-dialog__label">{{ t.tags }}</label>
        <input v-model="tagsInput" class="skill-dialog__input" placeholder="标签用逗号分隔" />
      </div>
      <div class="skill-dialog__footer">
        <button class="skill-dialog__btn skill-dialog__btn--cancel" @click="$emit('close')">
          {{ t.cancel }}
        </button>
        <button class="skill-dialog__btn skill-dialog__btn--save" @click="handleSave">
          {{ t.save }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from "vue"
import type { Plugin } from "siyuan"
import type { SkillCard, SkillI18n, CreateSkillDTO, Language, Difficulty } from "../types"
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi"

const props = defineProps<{
  i18n: SkillI18n
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
  "answer": "简洁准确的答案（1-3句话）",
  "distractors": ["错误但看似合理的选项1", "错误选项2", "错误选项3"],
  "category": "所属分类（如：异步编程、基础语法、设计模式）",
  "tags": ["标签1", "标签2", "标签3"]
}`

    const result = await callAI(prompt, aiConfig, {
      systemPrompt: "你是编程技能导师，专门为技术学习卡片生成准确答案和高质量干扰项。只输出JSON，禁止任何解释。",
      temperature: 0.5,
      maxTokens: 600,
      responseFormat: { type: "json_object" },
    })

    const parsed = JSON.parse(result)
    if (parsed.answer) form.answer = parsed.answer
    if (Array.isArray(parsed.distractors)) {
      form.distractor1 = parsed.distractors[0] || ""
      form.distractor2 = parsed.distractors[1] || ""
      form.distractor3 = parsed.distractors[2] || ""
    }
    if (parsed.category) form.category = parsed.category
    if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
      tagsInput.value = parsed.tags.join(", ")
    }
  } catch (err: any) {
    aiError.value = t.value.aiGenerateFailed || "AI 生成失败，请检查 API 配置"
    console.warn("AI 生成失败:", err.message || err)
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
