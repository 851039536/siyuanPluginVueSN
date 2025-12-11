<template>
  <div class="api-usage-panel">
    <!-- 头部 -->
    <div class="api-usage-header">
      <div class="header-title">
        <span class="icon">🔌</span>
        <h2>{{ i18n.apiUsage?.title || '思源笔记API使用参考' }}</h2>
      </div>
      <button class="close-btn" @click="handleClose">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M2.146 2.146a.5.5 0 0 1 .708 0L8 7.293 11.146 4.146a.5.5 0 0 1 .708.708L8.707 8l3.147 3.146a.5.5 0 0 1-.708.708L8 8.707l-3.146 3.147a.5.5 0 0 1-.708-.708L7.293 8 4.146 4.854a.5.5 0 0 1 0-.708z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <!-- 快捷键提示 -->
    <div class="shortcut-hint">
      <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>A</kbd> {{ i18n.apiUsage?.shortcutHint || '快速打开此面板' }}
    </div>

    <!-- 内容区域 -->
    <div class="api-usage-content">
      <!-- 左侧目录 -->
      <div class="api-nav">
        <h3>{{ i18n.apiUsage?.toc || '目录' }}</h3>
        <ul>
          <li v-for="(section, index) in sections" :key="index">
            <a href="#" @click.prevent="scrollToSection(index)" :class="{ active: currentSection === index }">
              {{ section.title }}
            </a>
          </li>
        </ul>
      </div>

      <!-- 右侧内容 -->
      <div class="api-content" ref="contentRef" @scroll="handleScroll">
        <div class="content-section">
          <h2>📖 {{ i18n.apiUsage?.introduction || '简介' }}</h2>
          <p>{{ i18n.apiUsage?.introDesc || '思源笔记提供了丰富的API接口，支持自动化操作和插件开发。' }}</p>

          <div class="info-box">
            <h3>{{ i18n.apiUsage?.endpoint || 'API端点' }}</h3>
            <code>http://127.0.0.1:6806</code>
          </div>

          <div class="info-box">
            <h3>{{ i18n.apiUsage?.method || '请求方法' }}</h3>
            <code>POST</code>
          </div>

          <div class="info-box">
            <h3>{{ i18n.apiUsage?.auth || '鉴权' }}</h3>
            <p>{{ i18n.apiUsage?.authDesc || '在请求头中包含: Authorization: Token <你的token>' }}</p>
          </div>
        </div>

        <!-- 笔记本操作 -->
        <div class="content-section">
          <h2>📚 {{ i18n.apiUsage?.notebook || '笔记本操作' }}</h2>

          <div class="api-item">
            <h3>lsNotebooks - {{ i18n.apiUsage?.listNotebooks || '列出笔记本' }}</h3>
            <div class="endpoint">POST /api/notebook/lsNotebooks</div>
            <div class="description">{{ i18n.apiUsage?.listNotebooksDesc || '获取所有笔记本列表' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "code": 0,
  "data": {
    "notebooks": [
      {
        "id": "20210817205410-2kvfpfn",
        "name": "测试笔记本",
        "icon": "1f41b",
        "sort": 0,
        "closed": false
      }
    ]
  }
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>createNotebook - {{ i18n.apiUsage?.createNotebook || '创建笔记本' }}</h3>
            <div class="endpoint">POST /api/notebook/createNotebook</div>
            <div class="description">{{ i18n.apiUsage?.createNotebookDesc || '创建新的笔记本' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "notebook": "笔记本ID",
  "name": "新笔记本名称"
}</code></pre>
            </div>
          </div>
        </div>

        <!-- 文档操作 -->
        <div class="content-section">
          <h2>📄 {{ i18n.apiUsage?.document || '文档操作' }}</h2>

          <div class="api-item">
            <h3>createDocWithMd - {{ i18n.apiUsage?.createDoc || '创建文档' }}</h3>
            <div class="endpoint">POST /api/filetree/createDocWithMd</div>
            <div class="description">{{ i18n.apiUsage?.createDocDesc || '通过Markdown内容创建新文档' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "notebook": "笔记本ID",
  "path": "/文档路径",
  "markdown": "# 文档标题\n\n内容..."
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>renameDocByID - {{ i18n.apiUsage?.renameDoc || '重命名文档' }}</h3>
            <div class="endpoint">POST /api/filetree/renameDocByID</div>
            <div class="description">{{ i18n.apiUsage?.renameDocDesc || '通过ID重命名文档' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "id": "文档ID",
  "title": "新标题"
}</code></pre>
            </div>
          </div>
        </div>

        <!-- 块操作 -->
        <div class="content-section">
          <h2>🧱 {{ i18n.apiUsage?.block || '块操作' }}</h2>

          <div class="api-item">
            <h3>insertBlock - {{ i18n.apiUsage?.insertBlock || '插入块' }}</h3>
            <div class="endpoint">POST /api/block/insertBlock</div>
            <div class="description">{{ i18n.apiUsage?.insertBlockDesc || '在指定位置插入新块' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "dataType": "markdown",
  "data": "插入的内容",
  "previousID": "前一块ID",
  "parentID": "父块ID"
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>updateBlock - {{ i18n.apiUsage?.updateBlock || '更新块' }}</h3>
            <div class="endpoint">POST /api/block/updateBlock</div>
            <div class="description">{{ i18n.apiUsage?.updateBlockDesc || '更新指定块的内容' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "id": "块ID",
  "dataType": "markdown",
  "data": "新内容"
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>deleteBlock - {{ i18n.apiUsage?.deleteBlock || '删除块' }}</h3>
            <div class="endpoint">POST /api/block/deleteBlock</div>
            <div class="description">{{ i18n.apiUsage?.deleteBlockDesc || '删除指定的块' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "id": "块ID"
}</code></pre>
            </div>
          </div>
        </div>

        <!-- 属性操作 -->
        <div class="content-section">
          <h2>🏷️ {{ i18n.apiUsage?.attribute || '属性操作' }}</h2>

          <div class="api-item">
            <h3>setBlockAttrs - {{ i18n.apiUsage?.setBlockAttrs || '设置块属性' }}</h3>
            <div class="endpoint">POST /api/attr/setBlockAttrs</div>
            <div class="description">{{ i18n.apiUsage?.setBlockAttrsDesc || '为块设置自定义属性' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "id": "块ID",
  "attrs": {
    "custom-attr1": "值"
  }
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>getBlockAttrs - {{ i18n.apiUsage?.getBlockAttrs || '获取块属性' }}</h3>
            <div class="endpoint">POST /api/attr/getBlockAttrs</div>
            <div class="description">{{ i18n.apiUsage?.getBlockAttrsDesc || '获取块的所有属性' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "id": "块ID"
}</code></pre>
            </div>
          </div>
        </div>

        <!-- SQL查询 -->
        <div class="content-section">
          <h2>🔍 {{ i18n.apiUsage?.sql || 'SQL查询' }}</h2>

          <div class="api-item">
            <h3>sql - {{ i18n.apiUsage?.querySql || '执行SQL查询' }}</h3>
            <div class="endpoint">POST /api/query/sql</div>
            <div class="description">{{ i18n.apiUsage?.querySqlDesc || '执行SQL语句查询数据库' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "stmt": "SELECT * FROM blocks WHERE type = 'h1' LIMIT 10"
}</code></pre>
            </div>
          </div>
        </div>

        <!-- 文件操作 -->
        <div class="content-section">
          <h2>📁 {{ i18n.apiUsage?.file || '文件操作' }}</h2>

          <div class="api-item">
            <h3>getFile - {{ i18n.apiUsage?.getFile || '获取文件' }}</h3>
            <div class="endpoint">POST /api/file/getFile</div>
            <div class="description">{{ i18n.apiUsage?.getFileDesc || '读取工作空间中的文件' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "path": "/data/assets/example.png"
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>putFile - {{ i18n.apiUsage?.putFile || '写入文件' }}</h3>
            <div class="endpoint">POST /api/file/putFile</div>
            <div class="description">{{ i18n.apiUsage?.putFileDesc || '将文件写入工作空间' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>multipart/form-data
  path: "/data/assets/new-file.txt"
  file: [文件数据]</code></pre>
            </div>
          </div>
        </div>

        <!-- 通知 -->
        <div class="content-section">
          <h2>🔔 {{ i18n.apiUsage?.notification || '通知' }}</h2>

          <div class="api-item">
            <h3>pushMsg - {{ i18n.apiUsage?.pushMsg || '推送消息' }}</h3>
            <div class="endpoint">POST /api/notification/pushMsg</div>
            <div class="description">{{ i18n.apiUsage?.pushMsgDesc || '显示通知消息' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "msg": "操作成功完成",
  "timeout": 3000
}</code></pre>
            </div>
          </div>

          <div class="api-item">
            <h3>pushErrMsg - {{ i18n.apiUsage?.pushErrMsg || '推送错误消息' }}</h3>
            <div class="endpoint">POST /api/notification/pushErrMsg</div>
            <div class="description">{{ i18n.apiUsage?.pushErrMsgDesc || '显示错误通知' }}</div>
            <div class="example">
              <div class="example-title">{{ i18n.apiUsage?.example || '示例' }}:</div>
              <pre><code>{
  "msg": "操作失败",
  "timeout": 5000
}</code></pre>
            </div>
          </div>
        </div>

        <!-- 系统 -->
        <div class="content-section">
          <h2>⚙️ {{ i18n.apiUsage?.system || '系统' }}</h2>

          <div class="api-item">
            <h3>version - {{ i18n.apiUsage?.getVersion || '获取系统版本' }}</h3>
            <div class="endpoint">GET /api/system/version</div>
            <div class="description">{{ i18n.apiUsage?.getVersionDesc || '获取思源笔记版本号' }}</div>
          </div>

          <div class="api-item">
            <h3>currentTime - {{ i18n.apiUsage?.getCurrentTime || '获取当前时间' }}</h3>
            <div class="endpoint">GET /api/system/currentTime</div>
            <div class="description">{{ i18n.apiUsage?.getCurrentTimeDesc || '获取系统当前时间（毫秒）' }}</div>
          </div>
        </div>

        <!-- 更多资源 -->
        <div class="content-section">
          <h2>📚 {{ i18n.apiUsage?.resources || '更多资源' }}</h2>
          <div class="resource-links">
            <a href="https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md" target="_blank" class="resource-link">
              {{ i18n.apiUsage?.officialDocs || '官方API文档' }} →
            </a>
            <a href="https://api.siyuan-note.club/" target="_blank" class="resource-link">
              {{ i18n.apiUsage?.onlineTester || '在线API测试' }} →
            </a>
            <a href="https://app.apifox.com/project/4484310/apis/doc-6907984?branchId=4130959" target="_blank" class="resource-link">
              {{ i18n.apiUsage?.apifoxDoc || 'ApiFox文档' }} →
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  i18n: any
  onClose: () => void
}

const props = defineProps<Props>()

const contentRef = ref<HTMLElement>()
const currentSection = ref(0)

// 目录章节
const sections = ref([
  { title: '简介', index: 0 },
  { title: '笔记本操作', index: 1 },
  { title: '文档操作', index: 2 },
  { title: '块操作', index: 3 },
  { title: '属性操作', index: 4 },
  { title: 'SQL查询', index: 5 },
  { title: '文件操作', index: 6 },
  { title: '通知', index: 7 },
  { title: '系统', index: 8 },
  { title: '更多资源', index: 9 }
])

// 关闭面板
const handleClose = () => {
  props.onClose()
}

// 滚动到指定章节
const scrollToSection = (index: number) => {
  const sections = contentRef.value?.querySelectorAll('.content-section')
  if (sections && sections[index]) {
    sections[index].scrollIntoView({ behavior: 'smooth', block: 'start' })
    currentSection.value = index
  }
}

// 监听滚动更新当前章节
const handleScroll = () => {
  const sections = contentRef.value?.querySelectorAll('.content-section')
  if (!sections) return

  const scrollTop = contentRef.value?.scrollTop || 0

  sections.forEach((section, index) => {
    const rect = section.getBoundingClientRect()
    const contentRect = contentRef.value?.getBoundingClientRect()

    if (contentRect) {
      const sectionTop = rect.top - contentRect.top
      if (scrollTop >= sectionTop - 100) {
        currentSection.value = index
      }
    }
  })
}

onMounted(() => {
  // ESC键关闭
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }
  document.addEventListener('keydown', handleEsc)
})
</script>

<style scoped>
.api-usage-panel {
  width: 100%;
  height: 100%;
  background-color: var(--b3-theme-background);
  color: var(--b3-theme-color);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.api-usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-theme-border);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title .icon {
  font-size: 24px;
}

.header-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--b3-theme-color);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--b3-theme-hover);
}

.shortcut-hint {
  padding: 12px 20px;
  background-color: var(--b3-theme-surface);
  font-size: 13px;
  color: var(--b3-theme-color2);
  border-bottom: 1px solid var(--b3-theme-border);
}

.shortcut-hint kbd {
  background-color: var(--b3-theme-background2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-border);
}

.api-usage-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.api-nav {
  width: 200px;
  padding: 20px;
  border-right: 1px solid var(--b3-theme-border);
  overflow-y: auto;
  background-color: var(--b3-theme-surface);
}

.api-nav h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-color2);
}

.api-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.api-nav li {
  margin-bottom: 4px;
}

.api-nav a {
  display: block;
  padding: 8px 12px;
  color: var(--b3-theme-color2);
  text-decoration: none;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
}

.api-nav a:hover {
  background-color: var(--b3-theme-hover);
  color: var(--b3-theme-color);
}

.api-nav a.active {
  background-color: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.api-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.content-section {
  margin-bottom: 32px;
  scroll-margin-top: 20px;
}

.content-section h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--b3-theme-color);
}

.content-section h3 {
  margin: 24px 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-color);
}

.info-box {
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-border);
  border-radius: 6px;
  padding: 12px 16px;
  margin: 12px 0;
}

.info-box h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.info-box code {
  background-color: var(--b3-theme-background2);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  color: var(--b3-theme-color);
}

.api-item {
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-border);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.api-item h3 {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-color);
}

.endpoint {
  display: inline-block;
  background-color: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 12px;
  margin: 8px 0;
}

.description {
  color: var(--b3-theme-color2);
  margin: 8px 0;
  font-size: 14px;
}

.example {
  margin-top: 12px;
}

.example-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-color2);
  margin-bottom: 8px;
}

.example pre {
  margin: 0;
  padding: 12px;
  background-color: var(--b3-theme-background2);
  border-radius: 6px;
  overflow-x: auto;
}

.example code {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  color: var(--b3-theme-color);
  line-height: 1.5;
}

.resource-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.resource-link {
  display: inline-flex;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-border);
  border-radius: 6px;
  color: var(--b3-theme-color);
  text-decoration: none;
  transition: all 0.2s;
}

.resource-link:hover {
  background-color: var(--b3-theme-hover);
  border-color: var(--b3-theme-primary);
}
</style>
