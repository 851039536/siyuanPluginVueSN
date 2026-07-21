/**
 * 技能学习 - 纯工具函数（不依赖 Vue 响应式）
 */
import type { SkillCard } from "./types"

interface CardOption {
  text: string
  correct: boolean
}
export interface QuizItem {
  card: SkillCard
  options: CardOption[]
  selectedIndex: number | null
  isCorrect: boolean | null
}

/** Fisher-Yates 洗牌算法 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 构建答题池：预建按语言分组的答案池，为每张卡片生成 3 个干扰项 */
function buildDistractorPool(cards: SkillCard[]) {
  const byLang = new Map<string, { id: string; text: string }[]>()
  for (const c of cards) {
    if (c.answer && c.answer.trim()) {
      if (!byLang.has(c.language)) byLang.set(c.language, [])
      byLang.get(c.language)!.push({ id: c.id, text: c.answer })
    }
  }
  const allPool = [...byLang.values()].flat()
  return { byLang, allPool }
}

/** 为单张卡片生成干扰项 */
function pickDistractors(
  card: SkillCard,
  pool: { byLang: Map<string, { id: string; text: string }[]>; allPool: { id: string; text: string }[] },
): CardOption[] {
  if (card.distractors && card.distractors.length > 0) {
    return card.distractors
      .filter(Boolean)
      .slice(0, 3)
      .map((d: string) => ({ text: d.trim(), correct: false }))
  }

  const sameLang = (pool.byLang.get(card.language) || [])
    .filter((a) => a.id !== card.id)
  const rest = pool.allPool.filter(
    (a) => a.id !== card.id && !sameLang.some((s) => s.id === a.id),
  )

  const candidates = [...shuffle(sameLang), ...shuffle(rest)]
  const seen = new Set<string>()
  const distractors: CardOption[] = []
  for (const a of candidates) {
    if (distractors.length >= 3) break
    if (!seen.has(a.text) && a.text !== card.answer) {
      seen.add(a.text)
      distractors.push({ text: a.text, correct: false })
    }
  }

  while (distractors.length < 3) {
    distractors.push({ text: "——", correct: false })
  }
  return distractors
}

/** 为闪卡测验生成题目列表（打乱顺序 + 干扰项） */
export function buildQuiz(cards: SkillCard[]): QuizItem[] {
  if (cards.length === 0) return []

  const shuffled = shuffle([...cards])
  const pool = buildDistractorPool(shuffled)

  return shuffled.map((card) => {
    const correctOpt: CardOption = { text: card.answer, correct: true }
    const distractors = pickDistractors(card, pool)
    const options = shuffle([correctOpt, ...distractors])
    return { card, options, selectedIndex: null, isCorrect: null }
  })
}
