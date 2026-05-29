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
              <div
                v-if="asset.docNames.length > 0"
                class="rm-asset-item__docs"
              >
                <span class="rm-asset-item__docs-label">{{ i18n.referencingDocs }}:</span>
                <span class="rm-asset-item__docs-list">{{ asset.docNames.join("、") }}</span>
              </div>
              <div
                v-else
                class="rm-asset-item__docs rm-asset-item__docs--empty"
              >
                {{ i18n.noReferencingDocs }}
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
              <button
                v-if="asset.docIds.length > 0"
                class="rm-btn small"
                @click="locateDoc(asset)"
              >
                {{ i18n.locateDoc }}
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
          @click="handleRebuildIndex"
        >
          {{ i18n.rebuildIndex }}
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

interface Props {
  i18n: ResourceManagerI18n
  plugin: Plugin
}

const props = defineProps<Props>()

const activeTab = ref("imageAssets")
const loading = ref(false)
const imageAssets = ref<ImageAssetInfo[]>([])
const fileAssets = ref<ImageAssetInfo[]>([])
const missingAssets = ref<string[]>([])
const unusedAssets = ref<string[]>([])

// 资源模式（图片/文件共用）
const assetMode = ref<"all" | "currentDoc">("all")
const categoryFilter = ref("")

// 移动资源
const movingAsset = ref<string | null>(null)
const moveNewPath = ref("")
const customCategory = ref("")
const quickCategories = computed(() => [
  {
    key: "images",
    label: props.i18n.categoryImages || "图片",
  },
  {
    key: "csharp",
    label: "csharp",
  },
  {
    key: "vue",
    label: "vue",
  },
])

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

onMounted(() => {
  props.plugin.eventBus.on("switch-protyle", onSwitchProtyle)
  props.plugin.eventBus.on("loaded-protyle-dynamic", onSwitchProtyle)
  props.plugin.eventBus.on("loaded-protyle-static", onSwitchProtyle)

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
  props.plugin.eventBus.off("switch-protyle", onSwitchProtyle)
  props.plugin.eventBus.off("loaded-protyle-dynamic", onSwitchProtyle)
  props.plugin.eventBus.off("loaded-protyle-static", onSwitchProtyle)
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
    if (activeTab.value === "imageAssets") {
      await loadImageAssets()
    }
    else if (activeTab.value === "fileAssets") {
      await loadFileAssets()
    }
    else if (activeTab.value === "missingAssets") {
      await loadMissingAssets()
    }
    else if (activeTab.value === "unusedAssets") {
      await loadUnusedAssets()
    }
  }
  finally {
    loading.value = false
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

/** 当前 tab 对应的资源列表（按分类过滤） */
const currentAssetList = computed(() => {
  const list = activeTab.value === "fileAssets" ? fileAssets.value : imageAssets.value
  if (!categoryFilter.value) return list
  const prefix = `assets/${categoryFilter.value}/`
  return list.filter(item => item.path.startsWith(prefix))
})

/** 加载当前 tab 对应的资源 */
async function loadCurrentTabAssets() {
  if (activeTab.value === "fileAssets") {
    await loadFileAssets()
  }
  else {
    await loadImageAssets()
  }
}

async function loadImageAssets() {
  if (assetMode.value === "all") {
    await loadAllImageAssets()
  }
  else if (assetMode.value === "currentDoc") {
    await loadCurrentDocImageAssets()
  }
}

async function loadFileAssets() {
  if (assetMode.value === "all") {
    await loadAllFileAssets()
  }
  else if (assetMode.value === "currentDoc") {
    await loadCurrentDocFileAssets()
  }
}

/**
 * 加载指定文档的图片资源（供 currentDoc / specifiedDoc 模式共用）
 */
async function loadDocImageAssets(docId: string) {
  const paths = await getDocImageAssets(docId)
  const pathList = (paths || [])
    .filter((p: unknown): p is string => typeof p === "string")
    .filter((p: string) => IMAGE_EXT.test(p))
  const docMap = await loadDocNamesForImages(pathList)
  imageAssets.value = pathList.map((path) => {
    const info = docMap.get(path)
    return {
      path,
      docNames: info?.docNames || [],
      docIds: info?.docIds || [],
    }
  })
}

/**
 * 加载指定文档的文件资源（供 currentDoc / specifiedDoc 模式共用）
 */
async function loadDocFileAssets(docId: string) {
  const paths = await getDocImageAssets(docId)
  const pathList = (paths || [])
    .filter((p: unknown): p is string => typeof p === "string")
    .filter((p: string) => !IMAGE_EXT.test(p))
  const docMap = await loadDocNamesForImages(pathList)
  fileAssets.value = pathList.map((path) => {
    const info = docMap.get(path)
    return {
      path,
      docNames: info?.docNames || [],
      docIds: info?.docIds || [],
    }
  })
}

/**
 * 加载当前文档的图片资源
 */
async function loadCurrentDocImageAssets() {
  const docId = await getCurrentDocId()
  if (!docId) {
    showMsg("无法获取当前文档 ID")
    return
  }
  await loadDocImageAssets(docId)
}

/**
 * 加载当前文档的文件资源
 */
async function loadCurrentDocFileAssets() {
  const docId = await getCurrentDocId()
  if (!docId) {
    showMsg("无法获取当前文档 ID")
    return
  }
  await loadDocFileAssets(docId)
}

/**
 * 批量查询图片资产的关联文档名称
 * 使用受控并发（5 个一批）避免同时发送过多 SQL 请求
 */
async function loadDocNamesForImages(
  paths: string[],
): Promise<Map<string, { docNames: string[], docIds: string[] }>> {
  const result = new Map<string, { docNames: string[], docIds: string[] }>()
  const CONCURRENCY = 5

  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const batch = paths.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(async (path) => {
      const fileName = path.split("/").pop() || path
      try {
        const rows = await sql(
          `SELECT DISTINCT b2.id, b2.content
           FROM blocks b1
           JOIN blocks b2 ON b1.root_id = b2.id
           WHERE b2.type = 'd'
           AND b1.markdown LIKE '%${fileName}%'
           LIMIT 10`,
        ) as { id: string, content: string }[]
        const docNames = (rows || []).map((r) => r.content || "(无标题)")
        const docIds = (rows || []).map((r) => r.id)
        return {
          path,
          docNames,
          docIds,
        }
      }
      catch {
        return {
          path,
          docNames: [] as string[],
          docIds: [] as string[],
        }
      }
    }))
    for (const item of batchResults) {
      result.set(item.path, {
        docNames: item.docNames,
        docIds: item.docIds,
      })
    }
  }
  return result
}

/**
 * 加载全部图片资源（整个项目）
 * 通过 SQL 查询已引用的资源 + 未使用资源 API 合并
 */
async function loadAllImageAssets() {
  try {
    const referenced = await sql("SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%'")
    const refImagePaths = (referenced || [])
      .map((r: { path: string }) => r.path)
      .filter((p: unknown): p is string => typeof p === "string")
      .filter((p: string) => IMAGE_EXT.test(p))

    const unused = await getUnusedAssets()
    const unusedImagePaths = (unused || [])
      .filter((p: unknown): p is string => typeof p === "string")
      .filter((p: string) => IMAGE_EXT.test(p))

    const allPaths = [...new Set([...refImagePaths, ...unusedImagePaths])].sort()
    const docMap = await loadDocNamesForImages(allPaths)

    imageAssets.value = allPaths.map((path) => {
      const info = docMap.get(path)
      return {
        path,
        docNames: info?.docNames || [],
        docIds: info?.docIds || [],
      }
    })
  }
  catch (e: unknown) {
    console.error("加载全部图片资源失败:", e)
    showMsg(props.i18n.loadFailed || "加载失败")
  }
}

/**
 * 加载全部文件资源（整个项目）
 * 过滤逻辑与图片相反：排除图片扩展名
 */
async function loadAllFileAssets() {
  try {
    const referenced = await sql("SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%'")
    const refFilePaths = (referenced || [])
      .map((r: { path: string }) => r.path)
      .filter((p: unknown): p is string => typeof p === "string")
      .filter((p: string) => !IMAGE_EXT.test(p))

    const unused = await getUnusedAssets()
    const unusedFilePaths = (unused || [])
      .filter((p: unknown): p is string => typeof p === "string")
      .filter((p: string) => !IMAGE_EXT.test(p))

    const allPaths = [...new Set([...refFilePaths, ...unusedFilePaths])].sort()
    const docMap = await loadDocNamesForImages(allPaths)

    fileAssets.value = allPaths.map((path) => {
      const info = docMap.get(path)
      return {
        path,
        docNames: info?.docNames || [],
        docIds: info?.docIds || [],
      }
    })
  }
  catch (e: unknown) {
    console.error("加载全部文件资源失败:", e)
    showMsg(props.i18n.loadFailed || "加载失败")
  }
}

async function loadMissingAssets() {
  const result = await getMissingAssets()
  missingAssets.value = result || []
}

async function loadUnusedAssets() {
  const result = await getUnusedAssets()
  unusedAssets.value = result || []
}

async function handleDeleteUnused(path: string) {
  if (!confirm(`${props.i18n.deleteConfirm} ${path}?`)) return
  try {
    await removeUnusedAsset(path)
    showMsg(props.i18n.deleteSuccess)
    await loadUnusedAssets()
  }
  catch {
    showMsg(props.i18n.deleteFailed)
  }
}

async function handleDeleteAllUnused() {
  if (!confirm(`${props.i18n.deleteConfirm}?`)) return
  try {
    await removeUnusedAssets()
    showMsg(props.i18n.deleteSuccess)
    await loadUnusedAssets()
  }
  catch {
    showMsg(props.i18n.deleteFailed)
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

/** 应用自定义分类 */
function applyCustomCategory(currentPath: string) {
  const cat = customCategory.value.trim()
  if (!cat) return
  applyCategory(currentPath, cat)
  customCategory.value = ""
}

/**
 * 定位到图片所在的文档
 */
function locateDoc(asset: ImageAssetInfo) {
  if (asset.docIds.length > 0) {
    window.open(`siyuan://blocks/${asset.docIds[0]}`)
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
    const blocks = await sql(
      `SELECT id, markdown FROM blocks WHERE markdown LIKE '%${oldPath}%'`,
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

    showMsg(
      updatedCount > 0
        ? `${props.i18n.moveSuccess}（已更新 ${updatedCount} 处引用，新路径: ${newPath}）`
        : `${props.i18n.moveSuccess}（新路径: ${newPath}）`,
    )
    cancelMove()
    await refresh()
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    showMsg(`${props.i18n.moveFailed}: ${msg}`)
  }
}

async function handleRebuildIndex() {
  rebuildResult.value = props.i18n.rebuildIndexStart
  try {
    await fullReindexAssetContent()
    rebuildResult.value = props.i18n.rebuildIndexSuccess
    showMsg(props.i18n.rebuildIndexSuccess)
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    rebuildResult.value = `${props.i18n.rebuildIndexFailed}: ${msg}`
    showMsg(props.i18n.rebuildIndexFailed)
  }
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
