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
            v-for="path in imageAssets"
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
                class="rm-btn small"
                @click="copyPathToClipboard(path)"
              >
                {{ i18n.copyPath }}
              </button>
              <button
                class="rm-btn small"
                @click="startMoveAsset(path)"
              >
                {{ i18n.moveAsset }}
              </button>
              <button
                class="rm-btn small danger"
                @click="handleDeleteAsset(path)"
              >
                {{ i18n.deleteAsset }}
              </button>
            </div>
            <!-- 移动表单 -->
            <div
              v-if="movingAsset === path"
              class="rm-move-form"
            >
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.currentPath }}:</span>
                <span class="rm-move-form__path">{{ path }}</span>
              </div>
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.newPath }}:</span>
                <input
                  v-model="moveNewPath"
                  class="rm-move-form__input"
                  :placeholder="i18n.movePathPlaceholder"
                  @keyup.enter="handleMoveAsset(path)"
                />
              </div>
              <div class="rm-move-form__row">
                <span class="rm-move-form__label">{{ i18n.category }}:</span>
                <div class="rm-move-form__categories">
                  <button
                    v-for="cat in quickCategories"
                    :key="cat"
                    class="rm-btn small"
                    @click="applyCategory(path, cat)"
                  >
                    {{ cat }}
                  </button>
                </div>
              </div>
              <div class="rm-move-form__actions">
                <button
                  class="rm-btn small primary"
                  :disabled="!moveNewPath"
                  @click="handleMoveAsset(path)"
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
import type { Plugin } from "siyuan"
import type { ResourceManagerI18n } from "./types"
import { showMessage } from "siyuan"
import {
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
  getMissingAssets,
  getUnusedAssets,
  removeUnusedAsset,
  removeUnusedAssets,
  renameAsset,
  resolveAssetPath,
  sql,
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
const imageAssets = ref<string[]>([])
const missingAssets = ref<string[]>([])
const unusedAssets = ref<string[]>([])

// 图片资源模式
const imageMode = ref<"all" | "currentDoc" | "specifiedDoc">("all")
const specifiedDocId = ref("")

// 移动资源
const movingAsset = ref<string | null>(null)
const moveNewPath = ref("")
const quickCategories = ["图片", "截图", "图标", "背景", "头像", "其他"]

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
const onSwitchProtyle = ({ detail }: any) => {
  const docId = detail?.protyle?.block?.rootID
  if (docId) {
    savedDocId.value = docId
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
  const protyleElements = document.querySelectorAll('.protyle:not(.fn__none)')
  for (const el of protyleElements) {
    const protyleInstance = (el as any).protyle
    const rootId = protyleInstance?.block?.rootID
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
    const result = await getDocImageAssets(specifiedDocId.value.trim())
    imageAssets.value = result || []
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
  const result = await getDocImageAssets(docId)
  imageAssets.value = result || []
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
      .map((r: any) => r.path as string)
      .filter((p: string) => IMAGE_EXT.test(p))

    // 查询未使用的资源（可能是只存在磁盘但未被索引的）
    const unused = await getUnusedAssets()
    const unusedImagePaths = (unused || []).filter((p: string) => IMAGE_EXT.test(p))

    // 合并去重
    const allPaths = [...new Set([...refImagePaths, ...unusedImagePaths])].sort()
    imageAssets.value = allPaths
  }
  catch (e: any) {
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
  catch (e: any) {
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
}

/**
 * 快速分类：将资源移动到 assets/分类名/ 下
 */
function applyCategory(currentPath: string, category: string) {
  const fileName = currentPath.split("/").pop() || currentPath
  moveNewPath.value = `assets/${category}/${fileName}`
}

/**
 * 确认移动资源（使用 renameAsset API，会自动更新所有引用）
 */
async function handleMoveAsset(oldPath: string) {
  const newPath = moveNewPath.value.trim()
  if (!newPath || newPath === oldPath) {
    cancelMove()
    return
  }
  try {
    await renameAsset(oldPath, newPath)
    showMsg(props.i18n.moveSuccess)
    cancelMove()
    await refresh()
  }
  catch (e: any) {
    showMsg(`${props.i18n.moveFailed}: ${e?.message || e}`)
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
  catch (e: any) {
    insertResult.value = `${props.i18n.insertFailed}: ${e?.message || e}`
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
  catch (e: any) {
    resolvePathResult.value = `${props.i18n.resolvePathResult}: ${e?.message || "解析失败"}`
  }
}

async function handleRebuildIndex() {
  rebuildResult.value = props.i18n.rebuildIndexStart
  try {
    await fullReindexAssetContent()
    rebuildResult.value = props.i18n.rebuildIndexSuccess
    showMsg(props.i18n.rebuildIndexSuccess)
  }
  catch (e: any) {
    rebuildResult.value = `${props.i18n.rebuildIndexFailed}: ${e?.message || e}`
    showMsg(props.i18n.rebuildIndexFailed)
  }
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
