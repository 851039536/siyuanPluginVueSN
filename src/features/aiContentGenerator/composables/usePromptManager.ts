/**
 * 提示词管理 Composable
 * 封装 saveCurrentPrompt/loadPrompt/deletePrompt/clearCurrentPrompt/savePromptsToStorage/loadPromptsFromStorage
 */
import { ref, computed, type Ref } from "vue"
import { showMessage } from "siyuan"
import type { SavedPrompt } from "@/types/ai"
import type { AIGeneratorStorage } from "../types/storage"

export interface UsePromptManagerDeps {
  systemPrompt: Ref<string>
  temperature: Ref<number>
  maxTokens: Ref<number>
  currentPromptName: Ref<string>
}

export function usePromptManager(deps: UsePromptManagerDeps) {
  const { systemPrompt, temperature, maxTokens, currentPromptName } = deps

  const savedPrompts = ref<SavedPrompt[]>([])
  const showPromptSelector = ref(false)
  const newPromptName = ref("")
  let storage: AIGeneratorStorage | null = null

  /** 分页提示词（当前不需要分页，直接返回全部） */
  const paginatedPrompts = computed(() => savedPrompts.value)

  /** 初始化存储引用 */
  const initStorage = (s: AIGeneratorStorage) => {
    storage = s
  }

  /** 安全存储操作 */
  const safeStorageOperation = async <T>(
    operation: () => Promise<T>,
    errorMsg: string,
  ): Promise<T | null> => {
    if (!storage) return null
    try {
      return await operation()
    } catch (error) {
      console.error(errorMsg, error)
      return null
    }
  }

  /** 应用提示词配置到当前状态 */
  const applyPromptConfig = (prompt: SavedPrompt) => {
    systemPrompt.value = prompt.systemPrompt
    temperature.value = prompt.temperature
    maxTokens.value = prompt.maxTokens
    currentPromptName.value = prompt.name
  }

  /** 保存到存储 */
  const savePromptsToStorage = async () => {
    await safeStorageOperation(
      () => storage!.prompts.save(savedPrompts.value),
      "保存提示词配置失败:",
    )
  }

  /** 从存储加载 */
  const loadPromptsFromStorage = async () => {
    if (!storage) return
    try {
      const prompts = await storage.prompts.loadOrDefault()
      if (prompts) {
        savedPrompts.value = prompts
      }
      const loadedName = await storage.currentPrompt.load()
      if (loadedName) {
        const idx = savedPrompts.value.findIndex((p) => p.name === loadedName)
        if (idx !== -1) {
          loadPrompt(idx)
        }
      }
    } catch (error) {
      console.error("从插件存储加载提示词配置失败:", error)
    }
  }

  /** 聚焦配置名输入框时自动填充 */
  const onPromptNameFocus = () => {
    if (currentPromptName.value && !newPromptName.value) {
      newPromptName.value = currentPromptName.value
    }
  }

  /** 保存当前提示词配置 */
  const saveCurrentPrompt = async () => {
    const promptName = newPromptName.value.trim() || currentPromptName.value
    if (!promptName) {
      showMessage("请输入配置名称", 2000, "info")
      return
    }

    const existingIndex = savedPrompts.value.findIndex((p) => p.name === promptName)

    const promptConfig: SavedPrompt = {
      id: existingIndex >= 0 ? savedPrompts.value[existingIndex].id : Date.now().toString(),
      name: promptName,
      systemPrompt: systemPrompt.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      createdAt: existingIndex >= 0 ? savedPrompts.value[existingIndex].createdAt : Date.now(),
    }

    if (existingIndex >= 0) {
      savedPrompts.value[existingIndex] = promptConfig
    } else {
      savedPrompts.value.push(promptConfig)
    }

    await savePromptsToStorage()
    newPromptName.value = ""
    currentPromptName.value = promptName
  }

  /** 加载提示词 */
  const loadPrompt = async (index: number) => {
    const prompt = savedPrompts.value[index]
    if (!prompt) return
    applyPromptConfig(prompt)
    showPromptSelector.value = false
    await safeStorageOperation(
      () => storage!.currentPrompt.save(prompt.name),
      "保存当前提示词失败:",
    )
  }

  /** 编辑提示词 */
  const editPrompt = (index: number) => {
    const prompt = savedPrompts.value[index]
    if (!prompt) return
    applyPromptConfig(prompt)
    showSettings.value = true
    showPromptSelector.value = false
  }

  /** 删除提示词 */
  const deletePrompt = (index: number) => {
    const prompt = savedPrompts.value[index]
    if (!prompt) return
    if (confirm(`确定删除配置: ${prompt.name}?`)) {
      savedPrompts.value.splice(index, 1)
      savePromptsToStorage()
    }
  }

  /** 清除当前提示词 */
  const clearCurrentPrompt = async () => {
    currentPromptName.value = ""
    await safeStorageOperation(
      () => storage!.currentPrompt.remove(),
      "清除当前提示词失败:",
    )
  }

  // ===== 设置面板（供 editPrompt 使用）=====
  const showSettings = ref(false)

  return {
    savedPrompts,
    showPromptSelector,
    newPromptName,
    currentPromptName,
    paginatedPrompts,
    showSettings,
    initStorage,
    loadPromptsFromStorage,
    saveCurrentPrompt,
    loadPrompt,
    editPrompt,
    deletePrompt,
    clearCurrentPrompt,
    onPromptNameFocus,
  }
}
