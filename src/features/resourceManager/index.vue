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
      <!-- 图片资源 -->
      <div
        v-if="activeTab === 'imageAssets'"
        class="rm-section"
      >
        <!-- 模式切换栏 -->
        <div class="rm-filter-bar">
          <button
            class="rm-btn small"
            :class="{ active: imageMode === 'all' }"
            @click="imageMode = 'all'; loadImageAssets()"
          >
            {{ i18n.allAssets }}
          </button>
          <button
            class="rm-btn small"
            :class="{ active: imageMode === 'currentDoc' }"
            @click="imageMode = 'currentDoc'; loadImageAssets()"
          >
            {{ i18n.currentDoc }}
          </button>
          <button
            class="rm-btn small"
            :class="{ active: imageMode === 'specifiedDoc' }"
            @click="imageMode = 'specifiedDoc'"
          >
            {{ i18n.specifiedDoc }}
          </button>
        </div>
        <!-- 指定文档输入 -->
        <div
          v-if="imageMode === 'specifiedDoc'"
          class="rm-input-row"
        >
          <label>{{ i18n.targetDocId }}:</label>
          <input
            v-model="specifiedDocId"
            :placeholder="i18n.docIdPlaceholder"
            @keyup.enter="loadImageAssets"
          />
          <button
            class="rm-btn small primary"
            @click="loadImageAssets"
          >
            {{ i18n.refresh }}
          </button>
        </div>
        <!-- 资源统计 -->
        <div
          v-if="!loading && imageAssets.length > 0"
          class="rm-asset-count"
        >
          {{ i18n.assetCount }}: {{ imageAssets.length }}
        </div>
        <div
          v-if="loading"
          class="rm-empty"
        >
          {{ i18n.loading }}
        </div>
        <div
          v-else-if="imageAssets.length === 0"
          class="rm-empty"
        >
          {{ i18n.noAssets }}
        </div>
        <ul
          v-else
          class="rm-asset-list"
        >
          <li
            v-for="asset in imageAssets"
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
              <button
                class="rm-btn small danger"
                @click="handleDeleteAsset(asset.path)"
              >
                {{ i18n.deleteAsset }}
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

      <!-- 重命名资源 -->
      <div
        v-if="activeTab === 'renameAsset'"
        class="rm-section"
      >
        <div class="rm-section__title">
          {{ i18n.renameAsset }}
        </div>
        <div class="rm-input-row">
          <label>{{ i18n.assetPath }}:</label>
          <input
            v-model="renameForm.oldPath"
            placeholder="assets/xxx.png"
          />
        </div>
        <div class="rm-input-row">
          <label>{{ i18n.newPath }}:</label>
          <input
            v-model="renameForm.newPath"
            placeholder="assets/yyy.png"
          />
        </div>
        <button
          class="rm-btn primary"
          @click="handleRenameAsset"
        >
          {{ i18n.renameAsset }}
        </button>
        <div
          v-if="renameResult"
          class="rm-result"
        >
          {{ renameResult }}
        </div>
      </div>

      <!-- 上传本地资源 -->
      <div
        v-if="activeTab === 'insertLocalAssets'"
        class="rm-section"
      >
        <div class="rm-section__title">
          {{ i18n.insertLocalAssets }}
        </div>
        <div class="rm-input-row">
          <label>{{ i18n.selectFiles }}:</label>
          <input
            type="file"
            multiple
            @change="handleFileSelect"
          />
        </div>
        <div class="rm-input-row">
          <label>{{ i18n.targetDocId }}:</label>
          <input
            v-model="insertForm.targetId"
            placeholder="20231027130500-xxxx（可选，上传后自动插入文档）"
          />
        </div>
        <button
          class="rm-btn primary"
          :disabled="insertForm.selectedFiles.length === 0"
          @click="handleInsertAssets"
        >
          {{ i18n.insertLocalAssets }}
        </button>
        <div
          v-if="insertResult"
          class="rm-result"
        >
          {{ insertResult }}
        </div>
      </div>

      <!-- 解析路径 -->
      <div
        v-if="activeTab === 'resolvePath'"
        class="rm-section"
      >
        <div class="rm-section__title">
          {{ i18n.resolvePath }}
        </div>
        <div class="rm-input-row">
          <label>{{ i18n.assetPath }}:</label>
          <input
            v-model="resolvePathInput"
            placeholder="assets/xxx.png"
          />
        </div>
        <button
          class="rm-btn primary"
          @click="handleResolvePath"
        >
          {{ i18n.resolvePath }}
        </button>
        <div
          v-if="resolvePathResult"
          class="rm-result"
        >
          {{ resolvePathResult }}
        </div>
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
  fetchSyncPost,
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
  appendBlock,
  fullReindexAssetContent,
  getBlockByID,
  getDocImageAssets,
  getFile,
  getMissingAssets,
  getUnusedAssets,
  removeUnusedAsset,
  removeUnusedAssets,
  renameAsset,
  resolveAssetPath,
  sql,
  updateBlock,
  upload,
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
const missingAssets = ref<string[]>([])
const unusedAssets = ref<string[]>([])

// 图片资源模式
const imageMode = ref<"all" | "currentDoc" | "specifiedDoc">("all")
const specifiedDocId = ref("")

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

// 重命名表单
const renameForm = ref({
  oldPath: "",
  newPath: "",
})
const renameResult = ref("")

// 插入资源表单
const insertForm = ref({
  targetId: "",
  selectedFiles: [] as File[],
})
const insertResult = ref("")

// 解析路径
const resolvePathInput = ref("")
const resolvePathResult = ref("")

// 重建索引
const rebuildResult = ref("")

const tabs = [
  {
    key: "imageAssets",
    label: props.i18n.imageAssets || "图片资源",
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
    key: "renameAsset",
    label: props.i18n.renameAsset || "重命名",
  },
  {
    key: "insertLocalAssets",
    label: props.i18n.insertLocalAssets || "插入资源",
  },
  {
    key: "resolvePath",
    label: props.i18n.resolvePath || "解析路径",
  },
  {
    key: "rebuildIndex",
    label: props.i18n.rebuildIndex || "重建索引",
  },
]

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

async function loadImageAssets() {
  if (imageMode.value === "all") {
    await loadAllImageAssets()
  }
  else if (imageMode.value === "currentDoc") {
    await loadCurrentDocImageAssets()
  }
  else if (imageMode.value === "specifiedDoc") {
    if (!specifiedDocId.value.trim()) {
      showMsg(props.i18n.docIdRequired || "请输入文档 ID")
      return
    }
    const paths = await getDocImageAssets(specifiedDocId.value.trim())
    const pathList = paths || []
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
  const paths = await getDocImageAssets(docId)
  const pathList = paths || []
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
  const IMAGE_EXT = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff|avif)$/i
  try {
    // 查询已引用的资源路径
    const referenced = await sql("SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%'")
    const refImagePaths = (referenced || [])
      .map((r: { path: string }) => r.path)
      .filter((p: string) => IMAGE_EXT.test(p))

    // 查询未使用的资源（可能是只存在磁盘但未被索引的）
    const unused = await getUnusedAssets()
    const unusedImagePaths = (unused || []).filter((p: string) => IMAGE_EXT.test(p))

    // 合并去重
    const allPaths = [...new Set([...refImagePaths, ...unusedImagePaths])].sort()

    // 批量查询关联文档
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
 * 删除当前文档中的资源文件
 * @param path 资源相对路径（如 assets/xxx.png）
 *
 * 注意：imageAssets 页签中的资源均被文档引用，
 * removeUnusedAsset 仅处理无引用的资源，
 * 对于有引用的资源会失败，请先移除文档中的引用。
 */
async function handleDeleteAsset(path: string) {
  const isReferenced = activeTab.value === "imageAssets"
  const warning = isReferenced
    ? "\n\n⚠️ 警告：该资源当前被文档引用，删除后文档中将出现断链！"
    : ""
  if (!confirm(`${props.i18n.deleteAssetConfirm} ${path}?${warning}`)) return
  try {
    await removeUnusedAsset(path)
    showMsg(props.i18n.deleteSuccess)
  }
  catch {
    const msg = isReferenced
      ? `${props.i18n.deleteFailed}（资源被引用时无法直接删除，请先移除文档中的引用）`
      : props.i18n.deleteFailed
    showMsg(msg)
  }
  // 刷新当前页签数据
  if (activeTab.value === "imageAssets") {
    await loadImageAssets()
  }
  else if (activeTab.value === "unusedAssets") {
    await loadUnusedAssets()
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
 * 使用 upload API（资产上传接口，已验证支持 FormData）copy 文件，
 * 再更新文档引用，最后清理旧文件
 */
async function handleMoveAsset(oldPath: string) {
  const newPath = moveNewPath.value.trim()
  if (!newPath || newPath === oldPath) {
    cancelMove()
    return
  }
  try {
    // 1. 读取原文件
    const fileData = await getFile(oldPath)
    if (!fileData || !(fileData instanceof Blob) || fileData.size === 0) {
      throw new Error("读取源文件失败")
    }

    // 2. 通过资产上传 API 写入目标目录
    const targetDir = newPath.substring(0, newPath.lastIndexOf("/"))
    const fileName = newPath.split("/").pop() || "file"
    const fileObj = new File([fileData], fileName, { type: fileData.type || "image/png" })

    const uploadForm = new FormData()
    uploadForm.append("assetsDirPath", targetDir)
    uploadForm.append("file[]", fileObj)
    const uploadResp = await fetchSyncPost("/api/asset/upload", uploadForm)

    if (uploadResp.code !== 0 || !uploadResp.data) {
      throw new Error(`上传失败: ${uploadResp.msg || `code ${uploadResp.code}`}`)
    }

    const succMap = (uploadResp.data as { succMap?: Record<string, string>, errFiles?: string[] }).succMap || {}
    const errFiles = (uploadResp.data as { errFiles?: string[] }).errFiles || []
    const actualNewPath = succMap[fileName]

    if (errFiles.includes(fileName) || !actualNewPath) {
      throw new Error("文件上传失败，目标目录可能不支持")
    }

    // 3. 更新文档引用（用上传返回的实际路径）
    const blocks = await sql(
      `SELECT id, markdown FROM blocks WHERE markdown LIKE '%${oldPath}%'`,
    ) as { id: string, markdown: string }[]

    let updatedCount = 0
    for (const block of blocks) {
      try {
        const newMarkdown = block.markdown.split(oldPath).join(actualNewPath)
        if (newMarkdown !== block.markdown) {
          await updateBlock("markdown", newMarkdown, block.id)
          updatedCount++
        }
      }
      catch { /* skip single block failure */ }
    }

    // 4. 删除旧文件（优先 removeUnusedAsset，它能清理资产数据库）
    try {
      await removeUnusedAsset(oldPath)
    }
    catch {
      try {
        // 兜底：用内核 renameFile 把旧路径的文件 "覆盖" 到新路径（将触发删除）
        await renameAsset(oldPath, actualNewPath)
      }
      catch { /* 忽略清理失败 */ }
    }

    // 5. 重建资产索引
    try {
      await fullReindexAssetContent()
    }
    catch { /* skip */ }

    showMsg(
      updatedCount > 0
        ? `${props.i18n.moveSuccess}（已更新 ${updatedCount} 处引用，新路径: ${actualNewPath}）`
        : `${props.i18n.moveSuccess}（新路径: ${actualNewPath}）`,
    )
    cancelMove()
    await refresh()
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    showMsg(`${props.i18n.moveFailed}: ${msg}`)
  }
}

async function handleRenameAsset() {
  if (!renameForm.value.oldPath || !renameForm.value.newPath) return
  try {
    await renameAsset(renameForm.value.oldPath, renameForm.value.newPath)
    renameResult.value = props.i18n.renameSuccess
    showMsg(props.i18n.renameSuccess)
  }
  catch {
    renameResult.value = props.i18n.renameFailed
    showMsg(props.i18n.renameFailed)
  }
}

async function handleInsertAssets() {
  if (insertForm.value.selectedFiles.length === 0) return
  try {
    // 使用 upload API（multipart form 上传），兼容 HTML <input type="file"> 的 File 对象
    const result = await upload("/assets/", insertForm.value.selectedFiles)
    const succMap = result?.succMap || {}
    const errFiles = result?.errFiles || []
    const successCount = Object.keys(succMap).length
    const failCount = errFiles.length
    let msg = `${props.i18n.insertSuccess}: ${successCount} 成功, ${failCount} 失败`

    // 如果指定了目标文档 ID，将上传的资源引用插入文档尾部
    if (insertForm.value.targetId && successCount > 0) {
      for (const assetPath of Object.values(succMap)) {
        try {
          await appendBlock("markdown", `![](${assetPath})`, insertForm.value.targetId)
        } catch { /* 跳过单个插入失败 */ }
      }
      msg += "，已插入到文档"
    }

    insertResult.value = msg
    showMsg(msg)
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    insertResult.value = `${props.i18n.insertFailed}: ${msg}`
    showMsg(props.i18n.insertFailed)
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) {
    insertForm.value.selectedFiles = Array.from(input.files)
  }
}

async function handleResolvePath() {
  if (!resolvePathInput.value) return
  try {
    const result = await resolveAssetPath(resolvePathInput.value)
    if (result) {
      resolvePathResult.value = `${props.i18n.resolvePathResult}: ${result}`
    } else {
      resolvePathResult.value = `${props.i18n.resolvePathResult}: 文件不存在或路径无效`
    }
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    resolvePathResult.value = `${props.i18n.resolvePathResult}: ${msg}`
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
