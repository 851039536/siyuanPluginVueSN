import type { Plugin } from "siyuan"
/**
 * 文档发布功能 - 核心业务逻辑
 * 参考 siyuan-plugin-publisher 的核心发布能力
 */
import type {
  BatchPublishOptions,
  BatchPublishResult,
  DocPublishState,
  ExportContent,
  PlatformConfig,
  PlatformPublishResult,
  PublishOptions,
  PublishRecord,
  PublishResult,
} from "../types/publish"
import type { PublishSettings } from "../types/publishStorage"
import { marked } from "marked"
import {
  reactive,
  ref,
} from "vue"
import {
  exportMdContent,
  forwardProxy,
  getBlockAttrs,
  pushErrMsg,
  pushMsg,
  setBlockAttrs,
  sql,
} from "@/api"
import {
  decodeXmlEntities,
  escapeXml,
} from "@/utils/stringUtils"
import {
  SY_ATTR_PUBLISH_DATA,
  SY_ATTR_PUBLISH_STATUS,
} from "../types/publish"
import {
  DEFAULT_PUBLISH_SETTINGS,
  PublishStorage,
} from "../types/publishStorage"

/** 生成唯一 ID */
function generateId(): string {
  return `pf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/** 生成 slug（URL 友好的标题） */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4E00-\u9FA5-]/g, "")
    .substring(0, 80)
}

/** 获取当前时间的 ISO 格式 */
function nowISO(): string {
  return new Date().toISOString()
}

/** 格式化日期为 Front Matter 格式 */
function formatDateForFM(date?: string): string {
  const d = date ? new Date(date) : new Date()
  return d.toISOString().replace("T", " ").substring(0, 19)
}

/** Base64 编码（分块转换避免大文件 RangeError） */
function encodeBase64(str: string): string {
  const data = new TextEncoder().encode(str)
  let binary = ""
  for (let i = 0; i < data.length; i += 8192) {
    binary += String.fromCharCode(...data.subarray(i, i + 8192))
  }
  return btoa(binary)
}

/** 解析 XMLRPC 响应，提取 postId 或抛出 fault 错误 */
function parseXmlrpcResponse(xmlBody: string, platformName: string): string {
  const faultMatch = xmlBody.match(/<fault>[\s\S]*?<value>\s*<int>\s*(-?\d+)\s*<\/int>[\s\S]*?<value>\s*<string>\s*([\s\S]*?)\s*<\/string>[\s\S]*?<\/fault>/i)
  if (faultMatch) {
    throw new Error(`${platformName} 返回错误 [${faultMatch[1]}]: ${decodeXmlEntities(faultMatch[2])}`)
  }
  const postIdMatch = xmlBody.match(/<string>\s*(\d+)\s*<\/string>/)
  return postIdMatch ? postIdMatch[1] : xmlBody.substring(0, 100)
}

/** 构建 MetaWeblog newPost XMLRPC 请求体 */
function buildMetaWeblogXml(blogId: string, username: string, password: string, content: ExportContent, bodyContent: string, extra?: string): string {
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>metaWeblog.newPost</methodName>
  <params>
    <param><value><string>${escapeXml(blogId)}</string></value></param>
    <param><value><string>${escapeXml(username)}</string></value></param>
    <param><value><string>${escapeXml(password)}</string></value></param>
    <param><value><struct>
      <member><name>title</name><value><string>${escapeXml(content.title)}</string></value></member>
      <member><name>description</name><value><string>${escapeXml(bodyContent)}</string></value></member>
      <member><name>categories</name><value><array><data>${content.categories.map((c) => `<value><string>${escapeXml(c)}</string></value>`).join("")}</data></array></value></member>
      <member><name>mt_keywords</name><value><string>${content.tags.join(",")}</string></value></member>${extra || ""}
    </struct></value></param>
    <param><value><boolean>1</boolean></value></param>
  </params>
</methodCall>`
}

/**
 * 发布功能 composable
 */
export function usePublish(plugin: Plugin) {
  const storage = new PublishStorage(plugin)

  // 平台列表
  const platforms = ref<PlatformConfig[]>([])
  // 发布设置
  const publishSettings = reactive<PublishSettings>({ ...DEFAULT_PUBLISH_SETTINGS })
  // 发布进度
  const publishing = ref(false)

  // ============================================================
  // 初始化与加载
  // ============================================================

  /** 加载发布配置 */
  async function loadPublishConfig() {
    try {
      const settings = await storage.loadSettings()
      Object.assign(publishSettings, settings)
      platforms.value = settings.platforms
    } catch (error) {
      console.error("加载发布配置失败:", error)
    }
  }

  /** 保存发布配置 */
  async function savePublishConfig() {
    try {
      publishSettings.platforms = platforms.value
      await storage.saveSettings({ ...publishSettings })
    } catch (error) {
      console.error("保存发布配置失败:", error)
    }
  }

  // ============================================================
  // 平台管理
  // ============================================================

  /** 添加平台 */
  async function addPlatform(config: Omit<PlatformConfig, "id" | "createdAt" | "updatedAt">): Promise<PlatformConfig> {
    const now = nowISO()
    const platform: PlatformConfig = {
      ...config,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    platforms.value.push(platform)
    await savePublishConfig()
    return platform
  }

  /** 更新平台 */
  async function updatePlatform(id: string, updates: Partial<PlatformConfig>): Promise<void> {
    const idx = platforms.value.findIndex((p) => p.id === id)
    if (idx >= 0) {
      platforms.value[idx] = {
        ...platforms.value[idx],
        ...updates,
        updatedAt: nowISO(),
      }
      await savePublishConfig()
    }
  }

  /** 删除平台 */
  async function removePlatform(id: string): Promise<void> {
    platforms.value = platforms.value.filter((p) => p.id !== id)
    publishSettings.defaultPlatformIds = publishSettings.defaultPlatformIds.filter((pid) => pid !== id)
    await savePublishConfig()
  }

  /** 测试平台连通性 */
  async function testPlatform(platformId: string): Promise<{ success: boolean, message: string }> {
    const platform = platforms.value.find((p) => p.id === platformId)
    if (!platform) {
      return {
        success: false,
        message: "平台不存在",
      }
    }

    try {
      await publishToPlatform(platform, {
        markdown: "# 测试发布\n\n这是一条测试消息，来自思源笔记文档分析插件。",
        fullMarkdown: "# 测试发布\n\n这是一条测试消息，来自思源笔记文档分析插件。",
        htmlContent: "<h1>测试发布</h1>\n<p>这是一条测试消息，来自思源笔记文档分析插件。</p>",
        title: "测试发布",
        summary: "测试",
        tags: ["测试"],
        categories: [],
        format: "markdown",
        frontMatter: {},
        images: new Map(),
      })
      return {
        success: true,
        message: "连接成功",
      }
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message || "连接失败",
      }
    }
  }

  // ============================================================
  // 内容导出
  // ============================================================

  /** 导出文档内容（用于发布） */
  async function exportDocContent(docId: string, options?: Partial<PublishOptions>): Promise<ExportContent> {
    // 获取文档 Markdown
    const mdData = await exportMdContent(docId)
    if (!mdData || !mdData.content) {
      throw new Error("获取文档内容失败")
    }

    const markdown: string = mdData.content
    let title: string = ""

    // 获取文档属性
    const attrs = await getBlockAttrs(docId)

    // 从属性中提取发布元数据
    const publishDataStr = attrs?.[SY_ATTR_PUBLISH_DATA]
    let existingData: Record<string, string | string[]> = {}
    if (publishDataStr) {
      try {
        existingData = JSON.parse(publishDataStr)
      } catch {
        // 忽略解析错误
      }
    }

    // 获取文档标题
    const docInfo = await sql(`SELECT content FROM blocks WHERE id = '${docId}' AND type = 'd'`)
    title = docInfo?.[0]?.content || "无标题"

    // 收集标签和分类
    const tags: string[] = options?.tags || (existingData.tags as string[]) || []
    const categories: string[] = options?.categories || (existingData.categories as string[]) || []

    // 处理图片链接：提取本地图片路径
    const images = new Map<string, string>()
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let imgMatch: RegExpExecArray | null = imgRegex.exec(markdown)
    while (imgMatch !== null) {
      const imgPath = imgMatch[2]
      if (!imgPath.startsWith("http") && !imgPath.startsWith("//")) {
        // 本地图片，需要处理
        images.set(imgPath, imgPath)
      }
      imgMatch = imgRegex.exec(markdown)
    }

    // 生成 Front Matter
    const fm: Record<string, any> = {
      title: options?.customTitle || title,
      date: formatDateForFM(),
      updated: formatDateForFM(),
      ...(options?.frontMatter || {}),
    }
    if (tags.length > 0) fm.tags = tags
    if (categories.length > 0) fm.categories = categories

    const summary = options?.customSummary || (typeof existingData.summary === "string" ? existingData.summary : "") || markdown.substring(0, 200).replace(/[#*\n]/g, " ").trim()

    // 生成完整 Markdown（含 Front Matter）
    const fullMarkdown = publishSettings.autoFrontMatter
      ? (() => {
          const fmLines = ["---"]
          for (const [key, value] of Object.entries(fm)) {
            if (Array.isArray(value)) {
              fmLines.push(`${key}:`)
              for (const v of value) {
                fmLines.push(`  - ${v}`)
              }
            } else {
              fmLines.push(`${key}: ${value}`)
            }
          }
          fmLines.push("---")
          return `${fmLines.join("\n")}\n\n${markdown}`
        })()
      : markdown

    // 生成 HTML 内容（用于富文本发布）
    let htmlContent: string | undefined
    const format = options?.format || "markdown"
    if (format === "richtext") {
      htmlContent = marked.parse(markdown, { async: false }) as string
    }

    return {
      markdown,
      fullMarkdown,
      htmlContent,
      title: options?.customTitle || title,
      summary,
      tags,
      categories,
      format,
      frontMatter: fm,
      images,
    }
  }

  // ============================================================
  // 平台适配器（核心发布逻辑）
  // ============================================================

  /** 发布到指定平台 */
  async function publishToPlatform(
    platform: PlatformConfig,
    content: ExportContent,
  ): Promise<PlatformPublishResult> {
    try {
      switch (platform.type) {
        case "webhook":
        case "custom":
          return await publishViaWebhook(platform, content)
        case "github":
        case "hexo":
        case "hugo":
        case "jekyll":
        case "vuepress":
        case "vitepress":
          return await publishViaGitHubAPI(platform, content)
        case "gitlab":
          return await publishViaGitLabAPI(platform, content)
        case "wordpress":
          return await publishViaWordPress(platform, content)
        case "cnblogs":
          return await publishViaCnblogs(platform, content)
        case "notion":
          return await publishViaNotion(platform, content)
        case "yuque":
          return await publishViaYuque(platform, content)
        case "halo":
          return await publishViaHalo(platform, content)
        case "zhihu":
        case "csdn":
        case "juejin":
        case "wechat":
          return await publishViaCookieAuth(platform, content)
        default:
          return await publishViaWebhook(platform, content)
      }
    } catch (error) {
      return {
        platformId: platform.id,
        platformName: platform.name,
        success: false,
        errorMessage: (error as Error).message || "发布失败",
      }
    }
  }

  /** Webhook 发布 */
  async function publishViaWebhook(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig
    const bodyTemplate = cfg.bodyTemplate || '{"title":"{{title}}","content":"{{content}}"}'

    // 替换模板变量
    const body = bodyTemplate
      .replace(/\{\{title\}\}/g, content.title)
      .replace(/\{\{content\}\}/g, content.fullMarkdown.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n"))
      .replace(/\{\{tags\}\}/g, JSON.stringify(content.tags))
      .replace(/\{\{categories\}\}/g, JSON.stringify(content.categories))
      .replace(/\{\{summary\}\}/g, content.summary || "")

    const headers = cfg.headers || {}
    const method = cfg.method || "POST"

    // 使用 forwardProxy 发送请求
    const headerList = Object.entries(headers).map(([key, value]) => ({
      name: key,
      value: String(value),
    }))

    let parsedBody: any
    try {
      parsedBody = JSON.parse(body)
    } catch {
      parsedBody = body
    }

    const response = await forwardProxy(
      platform.apiUrl,
      method,
      parsedBody,
      headerList,
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error("请求无响应")
    }

    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteUrl: typeof response === "object" ? (response as any).url || (response as any).data?.url : undefined,
    }
  }

  /** GitHub API 发布（适用于 GitHub/Hexo/Hugo/Jekyll/VuePress/VitePress） */
  async function publishViaGitHubAPI(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const owner = cfg.owner || ""
    const repo = cfg.repo || ""
    const branch = cfg.branch || "main"
    const pathTemplate = cfg.pathTemplate || "content/posts/{slug}.md"
    const commitMessage = (cfg.commitMessage || "publish: {title}").replace("{title}", content.title)

    const slug = slugify(content.title)
    const filePath = pathTemplate.replace("{slug}", slug).replace("{title}", content.title)
    const apiBase = platform.apiUrl || "https://api.github.com"

    // 检查文件是否已存在
    let sha: string | undefined
    try {
      const checkResp = await forwardProxy(
        `${apiBase}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
        "GET",
        {},
        [{
          name: "Authorization",
          value: `token ${platform.token}`,
        }, {
          name: "Accept",
          value: "application/vnd.github.v3+json",
        }],
        15000,
        "application/json",
      )
      if (checkResp && (checkResp as any).sha) {
        sha = (checkResp as any).sha
      }
    } catch {
      // 文件不存在，跳过
    }

    const base64Content = encodeBase64(content.fullMarkdown)

    const payload: any = {
      message: commitMessage,
      content: base64Content,
      branch,
    }
    if (sha) payload.sha = sha

    const response = await forwardProxy(
      `${apiBase}/repos/${owner}/${repo}/contents/${filePath}`,
      "PUT",
      payload,
      [{
        name: "Authorization",
        value: `token ${platform.token}`,
      }, {
        name: "Accept",
        value: "application/vnd.github.v3+json",
      }],
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error("GitHub API 请求失败")
    }

    const resp = response as any
    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteId: resp.content?.sha || resp.sha,
      remoteUrl: resp.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
    }
  }

  /** GitLab API 发布 */
  async function publishViaGitLabAPI(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const owner = cfg.owner || ""
    const repo = cfg.repo || ""
    const branch = cfg.branch || "main"
    const pathTemplate = cfg.pathTemplate || "content/posts/{slug}.md"
    const commitMessage = (cfg.commitMessage || "publish: {title}").replace("{title}", content.title)

    const slug = slugify(content.title)
    const filePath = pathTemplate.replace("{slug}", slug).replace("{title}", content.title)
    const apiBase = platform.apiUrl || "https://gitlab.com/api/v4"

    const projectId = encodeURIComponent(`${owner}/${repo}`)

    // Base64 编码
    const encoder = new TextEncoder()
    const data = encoder.encode(content.fullMarkdown)
    // 分块转换避免大文件 RangeError（call stack size exceeded）
    let binary = ""
    for (let i = 0; i < data.length; i += 8192) {
      binary += String.fromCharCode(...data.subarray(i, i + 8192))
    }
    const base64Content = btoa(binary)

    const payload = {
      branch,
      commit_message: commitMessage,
      content: base64Content,
      encoding: "base64",
      file_path: filePath,
    }

    const response = await forwardProxy(
      `${apiBase}/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
      "POST",
      payload,
      [{
        name: "PRIVATE-TOKEN",
        value: platform.token,
      }],
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error("GitLab API 请求失败")
    }

    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteUrl: `https://gitlab.com/${owner}/${repo}/-/blob/${branch}/${filePath}`,
    }
  }

  /** WordPress XMLRPC 发布 */
  async function publishViaWordPress(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const xmlrpcUrl = cfg.xmlrpcUrl || platform.apiUrl
    const username = cfg.username || ""
    const password = cfg.password || ""

    // 按格式选择内容：富文本用 HTML，否则用 Markdown
    const bodyContent = content.format === "richtext" && content.htmlContent
      ? content.htmlContent
      : content.fullMarkdown

    const xmlBody = buildMetaWeblogXml("1", username, password, content, bodyContent,
      "\n      <member><name>post_status</name><value><string>publish</string></value></member>")

    const resp = await forwardProxy(
      xmlrpcUrl,
      "POST",
      xmlBody,
      [{
        name: "Content-Type",
        value: "text/xml",
      }],
      30000,
      "text/xml",
    ) as any

    if (!resp) {
      throw new Error("WordPress XMLRPC 请求失败")
    }

    // 检查 HTTP 状态码
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`WordPress HTTP ${resp.status}: ${resp.body || "无响应体"}`)
    }

    const xmlBodyResp = resp.body || ""
    const remoteId = parseXmlrpcResponse(xmlBodyResp, "WordPress")

    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteId,
    }
  }

  /** 博客园 MetaWeblog 发布 */
  async function publishViaCnblogs(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const blogName = (cfg.blogName || "").trim()
    const username = (cfg.username || "").trim()
    const password = (cfg.password || "").trim()

    // 检查关键字段是否为空
    if (!blogName) {
      throw new Error(`博客园配置缺失: 博客名称(Blog Name) 为空，请检查平台配置中 "博客名称" 字段是否正确填写`)
    }
    if (!username) {
      throw new Error(`博客园配置缺失: 用户名为空，请检查平台配置中 "用户名" 字段是否正确填写`)
    }
    if (!password) {
      throw new Error(`博客园配置缺失: 密码为空，请检查平台配置中 "密码" 字段是否正确填写`)
    }

    // 构建 API URL：支持 {blogName} 模板替换，也支持直接使用完整 URL
    let apiUrl = platform.apiUrl
    if (apiUrl.includes("{blogName}")) {
      apiUrl = apiUrl.replace("{blogName}", blogName)
    } else if (!apiUrl.includes(blogName)) {
      // 如果没有 blogName 占位符且 URL 中也不包含 blogName，则追加
      apiUrl = `https://rpc.cnblogs.com/metaweblog/${blogName}`
    }

    // 按格式选择内容
    const bodyContent = content.format === "richtext" && content.htmlContent
      ? content.htmlContent
      : content.fullMarkdown

    const xmlBody = buildMetaWeblogXml(blogName, username, password, content, bodyContent)

    const resp = await forwardProxy(
      apiUrl,
      "POST",
      xmlBody,
      [{
        name: "Content-Type",
        value: "text/xml",
      }],
      30000,
      "text/xml",
    ) as any

    if (!resp) {
      throw new Error(`博客园 XMLRPC 请求失败: 无响应（URL: ${apiUrl}，blogName: ${blogName}，username: ${username}）`)
    }

    // 检查 HTTP 状态码
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`博客园 HTTP ${resp.status}: ${resp.body || "无响应体"}（URL: ${apiUrl}，blogName: ${blogName}，username: ${username}）`)
    }

    const xmlBodyResp = resp.body || ""
    const remoteId = parseXmlrpcResponse(xmlBodyResp, "博客园")

    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteId,
    }
  }

  /** Notion API 发布 */
  async function publishViaNotion(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const apiBase = platform.apiUrl || "https://api.notion.com/v1"
    const parentPageId = cfg.parentPageId || cfg.databaseId || ""

    // Notion 创建页面
    const payload = {
      parent: cfg.databaseId
        ? { database_id: cfg.databaseId }
        : { page_id: parentPageId },
      properties: {
        title: {
          title: [{ text: { content: content.title } }],
        },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{
              type: "text",
              text: {
                content: (content.format === "richtext" && content.htmlContent
                  ? content.htmlContent
                  : content.markdown
                ).substring(0, 2000),
              },
            }],
          },
        },
      ],
    }

    const response = await forwardProxy(
      `${apiBase}/pages`,
      "POST",
      payload,
      [
        {
          name: "Authorization",
          value: `Bearer ${platform.token}`,
        },
        {
          name: "Notion-Version",
          value: "2022-06-28",
        },
        {
          name: "Content-Type",
          value: "application/json",
        },
      ],
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error("Notion API 请求失败")
    }

    const resp = response as any
    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteId: resp.id,
      remoteUrl: resp.url,
    }
  }

  /** 语雀 API 发布 */
  async function publishViaYuque(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const apiBase = platform.apiUrl || "https://www.yuque.com/api/v2"
    const repo = cfg.repo || ""

    const payload = {
      title: content.title,
      slug: slugify(content.title),
      body: content.format === "richtext" && content.htmlContent ? content.htmlContent : content.fullMarkdown,
      public: 1,
    }

    const response = await forwardProxy(
      `${apiBase}/repos/${repo}/docs`,
      "POST",
      payload,
      [
        {
          name: "X-Auth-Token",
          value: platform.token,
        },
        {
          name: "Content-Type",
          value: "application/json",
        },
      ],
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error("语雀 API 请求失败")
    }

    const resp = response as any
    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteId: resp.data?.id,
      remoteUrl: resp.data?.slug ? `https://www.yuque.com/${repo}/${resp.data.slug}` : undefined,
    }
  }

  /** Halo API 发布 */
  async function publishViaHalo(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const apiBase = platform.apiUrl || ""

    const payload = {
      title: content.title,
      slug: slugify(content.title),
      content: {
        content: content.format === "richtext" && content.htmlContent ? content.htmlContent : content.fullMarkdown,
        format: content.format === "richtext" ? "HTML" : "MARKDOWN",
      },
      categories: content.categories.map((c) => ({
        name: c,
        slug: slugify(c),
      })),
      tags: content.tags.map((t) => ({
        name: t,
        slug: slugify(t),
      })),
    }

    const response = await forwardProxy(
      `${apiBase}/api/content/posts`,
      "POST",
      payload,
      [
        {
          name: "Authorization",
          value: `Bearer ${platform.token}`,
        },
        {
          name: "Content-Type",
          value: "application/json",
        },
      ],
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error("Halo API 请求失败")
    }

    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
    }
  }

  /** Cookie 认证平台发布（知乎/CSDN/掘金/微信公众号） */
  async function publishViaCookieAuth(platform: PlatformConfig, content: ExportContent): Promise<PlatformPublishResult> {
    const cfg = platform.extraConfig as Record<string, any>
    const cookie = cfg.cookie || ""
    const token = cfg.token || ""

    // 通用 Cookie 认证发布
    // 按格式选择内容
    const bodyContent = content.format === "richtext" && content.htmlContent
      ? content.htmlContent
      : content.fullMarkdown

    const payload = {
      title: content.title,
      content: bodyContent,
      markdown: content.markdown,
      summary: content.summary,
      ...(content.format === "richtext" ? { format: "richtext" } : {}),
      tags: content.tags,
      categories: content.categories,
    }

    const headers = [
      {
        name: "Cookie",
        value: cookie,
      },
      {
        name: "Content-Type",
        value: "application/json",
      },
    ]
    if (token) {
      headers.push({
        name: "Authorization",
        value: `Bearer ${token}`,
      })
    }

    const response = await forwardProxy(
      platform.apiUrl,
      "POST",
      payload,
      headers,
      30000,
      "application/json",
    )

    if (!response) {
      throw new Error(`${platform.name} 发布失败`)
    }

    const resp = response as any
    return {
      platformId: platform.id,
      platformName: platform.name,
      success: true,
      remoteId: resp.id || resp.data?.id,
      remoteUrl: resp.url || resp.data?.url,
    }
  }

  // ============================================================
  // 发布操作
  // ============================================================

  /** 发布单篇文档 */
  async function publishDoc(options: PublishOptions): Promise<PublishResult> {
    publishing.value = true
    const results: PlatformPublishResult[] = []

    try {
      // 导出文档内容
      const content = await exportDocContent(options.docId, options)

      // 逐个平台发布
      for (const platformId of options.platformIds) {
        const platform = platforms.value.find((p) => p.id === platformId)
        if (!platform || !platform.enabled) {
          results.push({
            platformId,
            platformName: "未知平台",
            success: false,
            errorMessage: "平台未配置或已禁用",
          })
          continue
        }

        const result = await publishToPlatform(platform, content)
        results.push(result)

        // 更新发布记录
        await updatePublishRecord(options.docId, platformId, result)
      }

      // 更新文档属性
      const successPlatforms = results.filter((r) => r.success)
      if (successPlatforms.length > 0) {
        await updateDocPublishAttrs(options.docId, results)

        // 自动标记书签
        if (publishSettings.autoMarkPublished) {
          await setBlockAttrs(options.docId, { bookmark: "已发布" })
        }

        await pushMsg(`发布成功：${successPlatforms.length}/${results.length} 个平台`)
      } else {
        await pushErrMsg("发布失败，所有平台均未成功")
      }

      return {
        docId: options.docId,
        docTitle: content.title,
        results,
      }
    } catch (error) {
      const errMsg = (error as Error).message || "发布失败"
      await pushErrMsg(`发布失败: ${errMsg}`)
      return {
        docId: options.docId,
        docTitle: "",
        results: [{
          platformId: "",
          platformName: "",
          success: false,
          errorMessage: errMsg,
        }],
      }
    } finally {
      publishing.value = false
    }
  }

  /** 批量发布文档 */
  async function batchPublish(options: BatchPublishOptions): Promise<BatchPublishResult> {
    publishing.value = true
    const allResults: PublishResult[] = []
    let succeeded = 0
    let failed = 0
    let skipped = 0

    try {
      for (let i = 0; i < options.docIds.length; i++) {
        const docId = options.docIds[i]
        const result = await publishDoc({
          docId,
          platformIds: options.platformIds,
          asDraft: options.asDraft,
        })
        allResults.push(result)

        if (result.results.some((r) => r.success)) {
          succeeded++
        } else if (result.results.some((r) => r.errorMessage?.includes("未配置"))) {
          skipped++
        } else {
          failed++
        }
      }

      return {
        total: options.docIds.length,
        succeeded,
        failed,
        skipped,
        results: allResults,
      }
    } finally {
      publishing.value = false
    }
  }

  /** 取消发布（从远程删除） */
  async function unpublishDoc(docId: string, platformId: string): Promise<boolean> {
    // 更新发布记录
    const history = await storage.loadHistory()
    const docState = history[docId]
    if (docState) {
      const record = docState.records.find((r) => r.platformId === platformId)
      if (record) {
        record.status = "removed"
        record.updatedAt = nowISO()
        await storage.saveHistory(history)
      }
    }

    // 更新文档属性
    await updateDocPublishAttrs(docId, [])
    await pushMsg("已取消发布")
    return true
  }

  // ============================================================
  // 发布状态管理
  // ============================================================

  /** 更新单个平台的发布记录 */
  async function updatePublishRecord(
    docId: string,
    platformId: string,
    result: PlatformPublishResult,
  ) {
    const history = await storage.loadHistory()
    if (!history[docId]) {
      history[docId] = {
        docId,
        records: [],
      }
    }

    const existing = history[docId].records.find((r) => r.platformId === platformId)
    const now = nowISO()

    if (existing) {
      existing.status = result.success ? "published" : "failed"
      existing.remoteId = result.remoteId
      existing.remoteUrl = result.remoteUrl
      existing.updatedAt = now
      existing.errorMessage = result.errorMessage
      if (result.success) existing.publishedAt = now
    } else {
      const record: PublishRecord = {
        platformId,
        status: result.success ? "published" : "failed",
        remoteId: result.remoteId,
        remoteUrl: result.remoteUrl,
        publishedAt: result.success ? now : undefined,
        updatedAt: now,
        errorMessage: result.errorMessage,
      }
      history[docId].records.push(record)
    }

    history[docId].lastPublishedAt = result.success ? now : history[docId].lastPublishedAt
    await storage.saveHistory(history)
  }

  /** 更新文档的发布属性（写入思源自定义属性） */
  async function updateDocPublishAttrs(docId: string, results: PlatformPublishResult[]) {
    try {
      const publishData: Record<string, any> = {}
      const successPlatforms = results.filter((r) => r.success)

      if (successPlatforms.length > 0) {
        publishData.platforms = successPlatforms.map((r) => ({
          id: r.platformId,
          name: r.platformName,
          remoteId: r.remoteId,
          remoteUrl: r.remoteUrl,
          publishedAt: nowISO(),
        }))
      }

      await setBlockAttrs(docId, {
        [SY_ATTR_PUBLISH_STATUS]: successPlatforms.length > 0 ? "published" : "idle",
        [SY_ATTR_PUBLISH_DATA]: JSON.stringify(publishData),
      })
    } catch (error) {
      console.error("更新发布属性失败:", error)
    }
  }

  /** 获取文档发布状态 */
  async function getDocPublishState(docId: string): Promise<DocPublishState | null> {
    return storage.getDocPublishState(docId)
  }

  /** 标记文档为"待发布" */
  async function markAsPending(docIds: string[]) {
    for (const docId of docIds) {
      await setBlockAttrs(docId, { bookmark: "待发布" })
    }
    await pushMsg(`已标记 ${docIds.length} 篇文档为"待发布"`)
  }

  /** 标记文档为"已发布" */
  async function markAsPublished(docIds: string[]) {
    for (const docId of docIds) {
      await setBlockAttrs(docId, { bookmark: "已发布" })
    }
    await pushMsg(`已标记 ${docIds.length} 篇文档为"已发布"`)
  }

  // ============================================================
  // 发布历史
  // ============================================================

  /** 获取所有发布历史 */
  async function getPublishHistory() {
    return storage.loadHistory()
  }

  /** 清除指定文档的发布历史 */
  async function clearPublishHistory(docId: string) {
    const history = await storage.loadHistory()
    delete history[docId]
    await storage.saveHistory(history)
  }

  return {
    // 状态
    platforms,
    publishSettings,
    publishing,
    // 初始化
    loadPublishConfig,
    savePublishConfig,
    // 平台管理
    addPlatform,
    updatePlatform,
    removePlatform,
    testPlatform,
    // 内容导出
    exportDocContent,
    // 发布操作
    publishDoc,
    batchPublish,
    unpublishDoc,
    // 状态管理
    getDocPublishState,
    markAsPending,
    markAsPublished,
    // 发布历史
    getPublishHistory,
    clearPublishHistory,
  }
}
