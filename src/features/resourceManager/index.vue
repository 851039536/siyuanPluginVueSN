<template>
  <div class="resource-manager-panel">
    <div class="rm-header">
      <span class="rm-header__title">{{ i18n.panelTitle }}</span>
      <div class="rm-header__actions">
        <button
          class="rm-btn"
          @click="refresh"
        >
          <IconWrapper
            name="refresh"
            :size="14"
          />
          {{ i18n.refresh }}
        </button>
      </div>
    </div>

    <div class="rm-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="rm-tabs__item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </div>
    </div>

    <div class="rm-content">
      <!-- 图片资源 / 文件资源（共用 UI） -->
      <div
        v-if="activeTab === 'imageAssets' || activeTab === 'fileAssets'"
        class="rm-section"
      >
        <!-- 来源筛选栏 -->
        <div class="rm-filter-bar">
          <button
            class="rm-btn small"
            :class="{ active: assetMode === 'all' }"
            @click="assetMode = 'all'; loadCurrentTabAssets()"
          >
            {{ i18n.allAssets }}
          </button>
          <button
            class="rm-btn small"
            :class="{ active: assetMode === 'currentDoc' }"
            @click="assetMode = 'currentDoc'; loadCurrentTabAssets()"
          >
            {{ i18n.currentDoc }}
          </button>
        </div>
        <!-- 加载数量 -->
        <div class="rm-filter-bar rm-filter-bar--limit">
          <span class="rm-filter-bar__label">{{ i18n.loadLimit }}:</span>
          <input
            v-model.number="loadLimit"
            type="number"
            min="1"
            max="10000"
            class="rm-limit-input"
            @change="refresh"
          />
        </div>
        <!-- 分类筛选栏 -->
        <div class="rm-filter-bar rm-filter-bar--category">
          <button
            class="rm-btn small"
            :class="{ active: categoryFilter === '' }"
            @click="categoryFilter = ''"
          >
            {{ i18n.allCategories }}
          </button>
          <button
            v-for="cat in quickCategories"
            :key="cat.key"
            class="rm-btn small"
            :class="{ active: categoryFilter === cat.key }"
            @click="categoryFilter = cat.key"
          >
            {{ cat.label }}
          </button>
        </div>
        <!-- 资源统计 -->
        <div
          v-if="!loading && currentAssetList.length > 0"
          class="rm-asset-count"
        >
          {{ i18n.assetCount }}: {{ currentAssetList.length }}
        </div>
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <div
          v-else-if="currentAssetList.length === 0"
          class="rm-empty"
        >
          {{ i18n.noAssets }}
        </div>
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="asset in currentAssetList"
            :key="asset.path"
            class="rm-asset-item"
          >
            <div class="rm-asset-item__info">
              <div
                class="rm-asset-item__name"
                :title="asset.path"
              >
                {{ asset.path }}
              </div>
            </div>
            <div class="rm-asset-item__actions">
              <button
                class="rm-btn small"
                @click="copyPathToClipboard(asset.path)"
              >
                {{ i18n.copyPath }}
              </button>
              <button
                class="rm-btn small"
                @click="startMoveAsset(asset.path)"
              >
                {{ i18n.moveAsset }}
              </button>
            </div>
            <!-- 移动表单 -->
            <div
              v-if="movingAsset === asset.path"
              class="rm-move-form"
            >
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.currentPath }}:</span>
                <span class="rm-move-form__path">{{ asset.path }}</span>
              </div>
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.newPath }}:</span>
                <input
                  v-model="moveNewPath"
                  class="rm-move-form__input"
                  :placeholder="i18n.movePathPlaceholder"
                  @keyup.enter="handleMoveAsset(asset.path)"
                />
              </div>
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.category }}:</span>
                <div class="rm-move-form__categories">
                  <button
                    v-for="cat in quickCategories"
                    :key="cat.key"
                    class="rm-btn small"
                    @click="applyCategory(asset.path, cat.key)"
                  >
                    {{ cat.label }}
                  </button>
                  <input
                    v-model="customCategory"
                    class="rm-move-form__category-input"
                    :placeholder="i18n.customCategoryPlaceholder || '自定义'"
                    @keyup.enter="applyCustomCategory(asset.path)"
                  />
                  <button
                    class="rm-btn small"
                    :disabled="!customCategory"
                    @click="applyCustomCategory(asset.path)"
                  >
                    {{ i18n.apply || "应用" }}
                  </button>
                </div>
              </div>
              <div class="rm-move-form__actions">
                <button
                  class="rm-btn small primary"
                  :disabled="!moveNewPath"
                  @click="handleMoveAsset(asset.path)"
                >
                  {{ i18n.confirmMove }}
                </button>
                <button
                  class="rm-btn small"
                  @click="cancelMove"
                >
                  {{ i18n.cancel }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- 丢失资源 -->
      <div
        v-if="activeTab === 'missingAssets'"
        class="rm-section"
      >
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <div
          v-else-if="missingAssets.length === 0"
          class="rm-empty"
        >
          {{ i18n.noMissingAssets }}
        </div>
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="path in missingAssets"
            :key="path"
            class="rm-asset-item"
          >
            <div
              class="rm-asset-item__name"
              :title="path"
            >
              {{ path }}
            </div>
          </li>
        </ul>
      </div>

      <!-- 未使用资源 -->
      <div
        v-if="activeTab === 'unusedAssets'"
        class="rm-section"
      >
        <div
          v-if="unusedAssets.length > 0 && !loading"
          class="rm-section__actions"
        >
          <button
            class="rm-btn danger small"
            :disabled="unusedAssets.length === 0"
            @click="handleDeleteAllUnused"
          >
            {{ i18n.deleteAllUnused }}
          </button>
        </div>
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <div
          v-else-if="unusedAssets.length === 0"
          class="rm-empty"
        >
          {{ i18n.noUnusedAssets }}
        </div>
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="path in unusedAssets"
            :key="path"
            class="rm-asset-item"
          >
            <div class="rm-asset-item__info">
              <div
                class="rm-asset-item__name"
                :title="path"
              >
                {{ path }}
              </div>
            </div>
            <div class="rm-asset-item__actions">
              <button
                class="rm-btn small danger"
                @click="handleDeleteUnused(path)"
              >
                {{ i18n.deleteUnused }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- 重建索引 -->
      <div
        v-if="activeTab === 'rebuildIndex'"
        class="rm-section"
      >
        <div class="rm-section__title">
          {{ i18n.rebuildIndex }}
        </div>
        <button
          class="rm-btn primary"
          :disabled="rebuildingIndex"
          @click="handleRebuildIndex"
        >
          {{ rebuildingIndex ? i18n.rebuildIndexStart : i18n.rebuildIndex }}
        </button>
        <div
          v-if="rebuildResult"
          class="rm-result"
        >
          {{ rebuildResult }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  IProtyle,
  Plugin,
} from "siyuan"
import type {
  ImageAssetInfo,
  ResourceManagerI18n,
} from "./types"
import {
  showMessage,
} from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import {
  fullReindexAssetContent,
  getBlockByID,
  getDocImageAssets,
  getMissingAssets,
  getUnusedAssets,
  putFile,
  removeUnusedAsset,
  removeUnusedAssets,
  renameFile,
  sql,
  updateBlock,
} from "@/api"
import IconWrapper from "@/components/IconWrapper.vue"
import { PluginStorage } from "@/utils/pluginStorage"

interface Props {
  i18n: ResourceManagerI18n
  plugin: Plugin
}

const props = defineProps<Props>()

const isMounted = ref(false)
const activeTab = ref("imageAssets")
const loading = ref(false)
const rebuildingIndex = ref(false)
const imageAssets = ref<ImageAssetInfo[]>([])
const fileAssets = ref<ImageAssetInfo[]>([])
const missingAssets = ref<string[]>([])
const unusedAssets = ref<string[]>([])

// 资源模式（图片/文件共用）
const assetMode = ref<"all" | "currentDoc">("all")
const categoryFilter = ref("")
const loadLimit = ref(30)

// 移动资源
const movingAsset = ref<string | null>(null)
const moveNewPath = ref("")
const customCategory = ref("")
const customCategories = ref<string[]>([])
const BUILT_IN_CATEGORY_KEYS = new Set(["images", "net", "tool", "other"])

const quickCategories = computed(() => {
  const builtIn = [
    {
      key: "images",
      label: props.i18n.categoryImages || "图片",
    },
    {
      key: "net",
      label: props.i18n.categoryNet || "NET",
    },
    {
      key: "tool",
      label: props.i18n.categoryTool || "tool",
    },
    {
      key: "other",
      label: props.i18n.categoryOther || "其他",
    },
  ]
  const custom = customCategories.value.map((cat) => ({
    key: cat,
    label: cat,
  }))
  return [...builtIn, ...custom]
})

// 从 protyle 事件中缓存当前文档 ID

const tabs = [
  {
    key: "imageAssets",
    label: props.i18n.imageAssets || "图片资源",
  },
  {
    key: "fileAssets",
    label: props.i18n.fileAssets || "文件资源",
  },
  {
    key: "missingAssets",
    label: props.i18n.missingAssets || "丢失资源",
  },
  {
    key: "unusedAssets",
    label: props.i18n.unusedAssets || "未使用资源",
  },
  {
    key: "rebuildIndex",
    label: props.i18n.rebuildIndex || "重建索引",
  },
]

// 重建索引
const rebuildResult = ref("")

// 从 protyle 事件中缓存当前文档 ID（解决面板聚焦时无法获取当前文档的问题）
const savedDocId = ref<string | null>(null)

// 监听 protyle 切换事件，更新缓存的当前文档 ID
const onSwitchProtyle = (event: CustomEvent<{ protyle: IProtyle }>) => {
  const rootID = event.detail.protyle.block.rootID
  if (rootID) {
    savedDocId.value = rootID
  }
}

const PROTYLE_EVENTS = ["switch-protyle", "loaded-protyle-dynamic", "loaded-protyle-static"] as const

onMounted(async () => {
  isMounted.value = true

  // 加载持久化的自定义分类
  try {
    const storage = new PluginStorage(props.plugin)
    const saved = await storage.load<string[]>("resourceManager-customCategories")
    if (saved) customCategories.value = saved
  }
  catch { /* ignore */ }

  PROTYLE_EVENTS.forEach((eventName) => {
    props.plugin.eventBus.on(eventName, onSwitchProtyle)
  })

  // 组件挂载时主动扫描当前可见的 protyle 获取文档 ID（不等待事件）
  if (!savedDocId.value) {
    const docId = findDocIdFromDom()
    if (docId) {
      savedDocId.value = docId
      // 如果初始加载因无 docId 而显示为空，现在补刷新
      if (activeTab.value === "imageAssets") {
        refresh()
      }
    }
  }
})

onUnmounted(() => {
  isMounted.value = false
  PROTYLE_EVENTS.forEach((eventName) => {
    props.plugin.eventBus.off(eventName, onSwitchProtyle)
  })
})

/**
 * 从 DOM 中查找当前可见 protyle 的文档 ID
 * 使用 SiYuan 标准方式：protyle DOM 元素的 .protyle 属性 → .block.rootID
 */
function findDocIdFromDom(): string | null {
  const protyleElements = document.querySelectorAll<HTMLElement & { protyle?: IProtyle }>('.protyle:not(.fn__none)')
  for (const el of protyleElements) {
    const rootId = el.protyle?.block?.rootID
    if (rootId) return rootId
  }
  return null
}

// 切换到数据页签时自动加载
watch(activeTab, () => {
  categoryFilter.value = ""
  refresh()
}, { immediate: true })

function showMsg(msg: string, timeout = 3000) {
  try {
    showMessage(msg, timeout, "info")
  }
  catch { /* ignore */ }
}

function escapeSqlLike(str: string): string {
  return str.replace(/'/g, "''")
}

async function copyPathToClipboard(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    showMsg(props.i18n.pathCopied)
  }
  catch {
    console.warn("复制到剪贴板失败:", path)
    // 兜底：使用 textarea 方式复制
    try {
      const ta = document.createElement("textarea")
      ta.value = path
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      showMsg(props.i18n.pathCopied)
    } catch {
      showMsg("复制失败，请手动复制")
    }
  }
}

async function refresh() {
  loading.value = true
  try {
    if (activeTab.value === "imageAssets" || activeTab.value === "fileAssets") {
      await loadCurrentTabAssets()
    }
    else if (activeTab.value === "missingAssets") {
      await loadMissingAssets()
    }
    else if (activeTab.value === "unusedAssets") {
      await loadUnusedAssets()
    }
  }
  finally {
    if (isMounted.value) loading.value = false
  }
}

/**
 * 获取当前光标所在的块ID
 */
function getCurrentBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector(".protyle-wysiwyg--select")
  if (selectedBlock) {
    return selectedBlock.getAttribute("data-node-id")
  }
  // 方法2: 获取光标所在的块
  const focusedBlock = document.querySelector(
    ".protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus",
  )
  if (focusedBlock) {
    return focusedBlock.getAttribute("data-node-id")
  }
  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    let node: Node | null = range.startContainer
    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute("data-node-id")
        const dataType = node.getAttribute("data-type")
        if (nodeId && dataType) {
          return nodeId
        }
      }
      node = node.parentNode
    }
  }
  return null
}

/**
 * 获取当前文档ID
 * 优先顺序：protyle 事件缓存 > 光标所在块 > DOM 实例扫描
 */
async function getCurrentDocId(): Promise<string | null> {
  // 优先方案：使用 protyle 事件缓存的文档 ID（最可靠）
  if (savedDocId.value) {
    return savedDocId.value
  }

  // 方案2：通过光标所在的块获取文档ID
  const currentBlockId = getCurrentBlockId()
  if (currentBlockId) {
    try {
      const block = await getBlockByID(currentBlockId)
      if (block?.root_id) {
        savedDocId.value = block.root_id
        return block.root_id
      }
    }
    catch { /* 降级到备用方案 */ }
  }

  // 方案3：从 DOM 中扫描当前可见 protyle 实例获取文档 ID
  const docId = findDocIdFromDom()
  if (docId) {
    savedDocId.value = docId
  }
  return docId || null
}

/** 图片扩展名 */
const IMAGE_EXT = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff|avif)$/i

/** 当前 tab 对应的资源列表（数量限制） */
const currentAssetList = computed(() => {
  const list = activeTab.value === "fileAssets" ? fileAssets.value : imageAssets.value
  return list.slice(0, loadLimit.value)
})

/** 加载当前 tab 对应的资源 */
async function loadCurrentTabAssets() {
  const isImage = activeTab.value === "imageAssets"
  if (assetMode.value === "all") {
    await loadAllAssets(isImage)
  }
  else if (assetMode.value === "currentDoc") {
    const docId = await getCurrentDocId()
    if (!docId) {
      showMsg("无法获取当前文档 ID")
      return
    }
    await loadDocAssets(docId, isImage)
  }
}

/**
 * 将原始路径列表转换为资源列表，按扩展名过滤
 */
function buildAssetList(paths: string[], isImage: boolean): ImageAssetInfo[] {
  const extFilter = isImage
    ? (p: string) => IMAGE_EXT.test(p)
    : (p: string) => !IMAGE_EXT.test(p)
  return paths.filter(extFilter).map((path) => ({ path }))
}

/**
 * 加载全部资源（图片或文件）
 */
async function loadAllAssets(isImage: boolean) {
  const target = isImage ? imageAssets : fileAssets

  try {
    const referenced = await sql("SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%'")
    const refPaths = (referenced || [])
      .map((r: { path: string }) => r.path)
      .filter((p: unknown): p is string => typeof p === "string")

    const unused = await getUnusedAssets()
    const unusedPaths = (unused || [])
      .filter((p: unknown): p is string => typeof p === "string")

    const allPaths = [...new Set([...refPaths, ...unusedPaths])].sort()
    target.value = buildAssetList(allPaths, isImage)
  }
  catch (e: unknown) {
    console.error(`加载全部${isImage ? "图片" : "文件"}资源失败:`, e)
    showMsg(props.i18n.loadFailed || "加载失败")
  }
}

/**
 * 加载指定文档的资源（图片或文件）
 */
async function loadDocAssets(docId: string, isImage: boolean) {
  const target = isImage ? imageAssets : fileAssets

  const paths = await getDocImageAssets(docId)
  const pathList = (paths || [])
    .filter((p: unknown): p is string => typeof p === "string")
  target.value = buildAssetList(pathList, isImage)
}

async function loadMissingAssets() {
  try {
    const result = await getMissingAssets()
    if (isMounted.value) missingAssets.value = result || []
  }
  catch (e: unknown) {
    console.error("加载丢失资源失败:", e)
    showMsg(props.i18n.loadFailed || "加载失败")
  }
}

async function loadUnusedAssets() {
  try {
    const result = await getUnusedAssets()
    if (isMounted.value) unusedAssets.value = result || []
  }
  catch (e: unknown) {
    console.error("加载未使用资源失败:", e)
    showMsg(props.i18n.loadFailed || "加载失败")
  }
}

async function handleDeleteUnused(path: string) {
  if (!confirm(`${props.i18n.deleteConfirm} ${path}?`)) return
  try {
    await removeUnusedAsset(path)
    if (!isMounted.value) return
    showMsg(props.i18n.deleteSuccess)
    await loadUnusedAssets()
  }
  catch {
    if (isMounted.value) showMsg(props.i18n.deleteFailed)
  }
}

async function handleDeleteAllUnused() {
  if (!confirm(`${props.i18n.deleteConfirm}?`)) return
  try {
    await removeUnusedAssets()
    if (!isMounted.value) return
    showMsg(props.i18n.deleteSuccess)
    await loadUnusedAssets()
  }
  catch {
    if (isMounted.value) showMsg(props.i18n.deleteFailed)
  }
}

/**
 * 开始移动资源：显示移动表单
 */
function startMoveAsset(path: string) {
  movingAsset.value = path
  moveNewPath.value = path
}

/**
 * 取消移动
 */
function cancelMove() {
  movingAsset.value = null
  moveNewPath.value = ""
  customCategory.value = ""
}

/**
 * 快速分类：将资源移动到 assets/分类名/ 下
 */
function applyCategory(currentPath: string, category: string) {
  const fileName = currentPath.split("/").pop() || currentPath
  moveNewPath.value = `assets/${category}/${fileName}`
}

/** 应用自定义分类，自动持久化新分类 */
async function applyCustomCategory(currentPath: string) {
  const cat = customCategory.value.trim()
  if (!cat) return
  applyCategory(currentPath, cat)

  if (!BUILT_IN_CATEGORY_KEYS.has(cat) && !customCategories.value.includes(cat)) {
    customCategories.value = [...customCategories.value, cat]
    const storage = new PluginStorage(props.plugin)
    await storage.save("resourceManager-customCategories", customCategories.value)
  }
  customCategory.value = ""
}

/**
 * 定位到图片所在的文档
 */

/**
 * 移动成功后原地更新资源列表，避免全量刷新重新扫描
 */
function updateAssetItemAfterMove(oldPath: string, newPath: string) {
  const target = activeTab.value === "fileAssets" ? fileAssets : imageAssets
  const idx = target.value.findIndex((item) => item.path === oldPath)
  if (idx === -1) return

  const moved = target.value[idx]
  const updated: ImageAssetInfo = {
    ...moved,
    path: newPath,
  }

  // 新路径不在当前分类筛选范围内则移除，否则原地替换
  if (categoryFilter.value && !newPath.startsWith(`assets/${categoryFilter.value}/`)) {
    target.value = target.value.filter((item) => item.path !== oldPath)
  }
  else {
    const next = [...target.value]
    next.splice(idx, 1, updated)
    next.sort((a, b) => a.path.localeCompare(b.path))
    target.value = next
  }
}

/**
 * 确认移动资源
 * renameAsset 不做物理移动也不更新文档内容，因此需要：
 * 1. 确保目标子目录存在（如 assets/csharp/）
 * 2. renameFile 物理移动文件（路径格式 /data/assets/...）
 * 3. 手动更新所有文档引用（SQL 查询 + updateBlock）
 * 4. 重建资产索引
 */
async function handleMoveAsset(oldPath: string) {
  const newPath = moveNewPath.value.trim()
  if (!newPath || newPath === oldPath) {
    cancelMove()
    return
  }
  try {
    // 1. 确保目标子目录存在
    const dirPart = newPath.substring(0, newPath.lastIndexOf("/"))
    if (dirPart && dirPart !== "assets") {
      try {
        await putFile(`/data/${dirPart}`, true, new File([], ""))
      }
      catch { /* 目录可能已存在，忽略 */ }
    }

    // 2. 物理移动文件（路径需要 /data/ 前缀）
    await renameFile(`/data/${oldPath}`, `/data/${newPath}`)

    // 3. 更新所有文档引用
    const escapedOldPath = escapeSqlLike(oldPath)
    const blocks = await sql(
      `SELECT id, markdown FROM blocks WHERE markdown LIKE '%${escapedOldPath}%' LIMIT 1000`,
    ) as { id: string, markdown: string }[]

    let updatedCount = 0
    for (const block of blocks) {
      try {
        const newMarkdown = block.markdown.split(oldPath).join(newPath)
        if (newMarkdown !== block.markdown) {
          await updateBlock("markdown", newMarkdown, block.id)
          updatedCount++
        }
      }
      catch { /* skip single block failure */ }
    }

    // 4. 重建资产索引，让资产数据库同步
    try {
      await fullReindexAssetContent()
    }
    catch { /* ignore */ }

    if (!isMounted.value) return
    showMsg(
      updatedCount > 0
        ? `${props.i18n.moveSuccess}（已更新 ${updatedCount} 处引用，新路径: ${newPath}）`
        : `${props.i18n.moveSuccess}（新路径: ${newPath}）`,
    )
    updateAssetItemAfterMove(oldPath, newPath)
    cancelMove()
  }
  catch (e: unknown) {
    if (isMounted.value) {
      const msg = e instanceof Error ? e.message : String(e)
      showMsg(`${props.i18n.moveFailed}: ${msg}`)
    }
  }
}

async function handleRebuildIndex() {
  if (rebuildingIndex.value) return
  rebuildingIndex.value = true
  rebuildResult.value = props.i18n.rebuildIndexStart
  try {
    await fullReindexAssetContent()
    if (isMounted.value) {
      rebuildResult.value = props.i18n.rebuildIndexSuccess
      showMsg(props.i18n.rebuildIndexSuccess)
    }
  }
  catch (e: unknown) {
    if (isMounted.value) {
      const msg = e instanceof Error ? e.message : String(e)
      rebuildResult.value = `${props.i18n.rebuildIndexFailed}: ${msg}`
      showMsg(props.i18n.rebuildIndexFailed)
    }
  }
  finally {
    if (isMounted.value) rebuildingIndex.value = false
  }
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
