/**
 * 文档分析 - 发布功能类型定义
 * 参考 siyuan-plugin-publisher 的核心发布能力
 */

// ============================================================
// 平台定义
// ============================================================

/** 平台类型枚举 */
export type PlatformType =
  | "webhook"       // 通用 Webhook
  | "github"        // GitHub
  | "gitlab"        // GitLab
  | "wordpress"     // WordPress (XMLRPC)
  | "halo"          // Halo
  | "hexo"          // Hexo (Git 推送)
  | "hugo"          // Hugo (Git 推送)
  | "jekyll"        // Jekyll (Git 推送)
  | "vuepress"      // VuePress (Git 推送)
  | "vitepress"     // VitePress (Git 推送)
  | "csdn"          // CSDN
  | "zhihu"         // 知乎
  | "yuque"         // 语雀
  | "notion"        // Notion
  | "juejin"        // 掘金
  | "wechat"        // 微信公众号
  | "cnblogs"       // 博客园
  | "custom"        // 自定义平台

/** 平台配置 */
export interface PlatformConfig {
  /** 唯一标识 */
  id: string
  /** 平台类型 */
  type: PlatformType
  /** 显示名称 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 平台图标 (iconify 图标名) */
  icon?: string
  /** API 端点/URL */
  apiUrl: string
  /** 认证 Token / API Key */
  token: string
  /** 额外配置（JSON 兼容对象） */
  extraConfig: Record<string, any>
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** Git 类平台额外配置 */
export interface GitPlatformExtra {
  /** 仓库所有者 */
  owner: string
  /** 仓库名称 */
  repo: string
  /** 分支名称 */
  branch: string
  /** 文件路径模板 (如: content/posts/{slug}.md) */
  pathTemplate: string
  /** 提交信息模板 */
  commitMessage: string
  /** 作者名称 */
  authorName?: string
  /** 作者邮箱 */
  authorEmail?: string
}

/** WordPress 额外配置 */
export interface WordPressExtra {
  /** XMLRPC 端点 */
  xmlrpcUrl: string
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 默认分类 */
  defaultCategory?: string
  /** 默认标签 */
  defaultTags?: string[]
}

/** Halo 额外配置 */
export interface HaloExtra {
  /** Halo API 地址 */
  apiUrl: string
  /** 认证 Token */
  token: string
  /** 默认分类 */
  defaultCategory?: string
}

/** 博客园额外配置 */
export interface CnblogsExtra {
  /** 博客名称（用于构造 MetaWeblog 端点） */
  blogName: string
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 应用密钥（可选） */
  appKey?: string
}

// ============================================================
// 发布记录
// ============================================================

/** 发布状态 */
export type PublishStatus = "idle" | "publishing" | "published" | "failed" | "removed"

/** 单个平台的发布记录 */
export interface PublishRecord {
  /** 平台 ID */
  platformId: string
  /** 发布状态 */
  status: PublishStatus
  /** 远程文章 ID */
  remoteId?: string
  /** 远程文章 URL */
  remoteUrl?: string
  /** 发布时间 */
  publishedAt?: string
  /** 更新时间 */
  updatedAt?: string
  /** 错误信息 */
  errorMessage?: string
}

/** 文档的发布状态汇总 */
export interface DocPublishState {
  /** 文档 ID */
  docId: string
  /** 各平台的发布记录 */
  records: PublishRecord[]
  /** 最后发布时间 */
  lastPublishedAt?: string
}

// ============================================================
// 发布选项
// ============================================================

/** 发布内容格式 */
export type PublishFormat = "markdown" | "richtext"

/** 单次发布选项 */
export interface PublishOptions {
  /** 文档 ID */
  docId: string
  /** 目标平台 ID 列表 */
  platformIds: string[]
  /** 自定义标题（留空使用原文） */
  customTitle?: string
  /** 自定义摘要 */
  customSummary?: string
  /** 标签 */
  tags?: string[]
  /** 分类 */
  categories?: string[]
  /** 是否发布为草稿 */
  asDraft?: boolean
  /** 发布内容格式，默认 markdown */
  format?: PublishFormat
  /** YAML Front Matter 配置 */
  frontMatter?: Record<string, any>
}

/** 批量发布选项 */
export interface BatchPublishOptions {
  /** 文档 ID 列表 */
  docIds: string[]
  /** 目标平台 ID 列表 */
  platformIds: string[]
  /** 是否发布为草稿 */
  asDraft?: boolean
}

// ============================================================
// 发布结果
// ============================================================

/** 单篇发布结果 */
export interface PublishResult {
  /** 文档 ID */
  docId: string
  /** 文档标题 */
  docTitle: string
  /** 各平台发布结果 */
  results: PlatformPublishResult[]
}

/** 单平台发布结果 */
export interface PlatformPublishResult {
  /** 平台 ID */
  platformId: string
  /** 平台名称 */
  platformName: string
  /** 是否成功 */
  success: boolean
  /** 远程文章 ID */
  remoteId?: string
  /** 远程文章 URL */
  remoteUrl?: string
  /** 错误信息 */
  errorMessage?: string
}

/** 批量发布结果 */
export interface BatchPublishResult {
  /** 总文档数 */
  total: number
  /** 成功数 */
  succeeded: number
  /** 失败数 */
  failed: number
  /** 跳过数 */
  skipped: number
  /** 各文档结果 */
  results: PublishResult[]
}

// ============================================================
// 内容导出
// ============================================================

/** 导出内容（用于发布） */
export interface ExportContent {
  /** 原始 Markdown */
  markdown: string
  /** 带 Front Matter 的完整 Markdown */
  fullMarkdown: string
  /** 转换为 HTML 的内容（当 format=richtext 时使用） */
  htmlContent?: string
  /** 标题 */
  title: string
  /** 摘要 */
  summary?: string
  /** 标签列表 */
  tags: string[]
  /** 分类列表 */
  categories: string[]
  /** 发布内容格式 */
  format: PublishFormat
  /** Front Matter 对象 */
  frontMatter: Record<string, any>
  /** 图片列表 (本地路径 -> 可访问 URL 映射) */
  images: Map<string, string>
}

// ============================================================
// UI 状态
// ============================================================

/** 发布面板状态 */
export interface PublishPanelState {
  /** 是否显示 */
  visible: boolean
  /** 当前操作的文档 ID */
  docId: string
  /** 当前操作的文档标题 */
  docTitle: string
  /** 选中的平台 ID 列表 */
  selectedPlatforms: string[]
  /** 是否正在发布 */
  publishing: boolean
  /** 发布进度 (0~100) */
  progress: number
  /** 发布结果 */
  result?: BatchPublishResult
}

// ============================================================
// 预定义平台模板
// ============================================================

/** 平台模板定义 */
export interface PlatformTemplate {
  type: PlatformType
  name: string
  icon: string
  description: string
  defaultConfig: Partial<PlatformConfig>
}

/** 内置平台模板 */
export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    type: "webhook",
    name: "Webhook",
    icon: "mdi:webhook",
    description: "通用 Webhook，POST 文档内容到指定 URL",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        bodyTemplate: '{"title":"{{title}}","content":"{{content}}","tags":{{tags}}}',
      },
    },
  },
  {
    type: "github",
    name: "GitHub",
    icon: "mdi:github",
    description: "推送 Markdown 文件到 GitHub 仓库",
    defaultConfig: {
      apiUrl: "https://api.github.com",
      extraConfig: {
        owner: "",
        repo: "",
        branch: "main",
        pathTemplate: "content/posts/{slug}.md",
        commitMessage: "publish: {title}",
      },
    },
  },
  {
    type: "gitlab",
    name: "GitLab",
    icon: "mdi:gitlab",
    description: "推送 Markdown 文件到 GitLab 仓库",
    defaultConfig: {
      apiUrl: "https://gitlab.com/api/v4",
      extraConfig: {
        owner: "",
        repo: "",
        branch: "main",
        pathTemplate: "content/posts/{slug}.md",
        commitMessage: "publish: {title}",
      },
    },
  },
  {
    type: "wordpress",
    name: "WordPress",
    icon: "mdi:wordpress",
    description: "通过 XMLRPC/Metaweblog 协议发布到 WordPress",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        xmlrpcUrl: "",
        username: "",
        password: "",
        defaultCategory: "未分类",
        defaultTags: [],
      },
    },
  },
  {
    type: "halo",
    name: "Halo",
    icon: "mdi:alpha-h-circle",
    description: "发布到 Halo 博客系统",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        defaultCategory: "",
      },
    },
  },
  {
    type: "hexo",
    name: "Hexo",
    icon: "mdi:language-markdown",
    description: "推送到 Hexo 博客仓库（GitHub/GitLab）",
    defaultConfig: {
      apiUrl: "https://api.github.com",
      extraConfig: {
        owner: "",
        repo: "",
        branch: "main",
        pathTemplate: "source/_posts/{slug}.md",
        commitMessage: "publish: {title}",
      },
    },
  },
  {
    type: "hugo",
    name: "Hugo",
    icon: "mdi:language-go",
    description: "推送到 Hugo 博客仓库（GitHub/GitLab）",
    defaultConfig: {
      apiUrl: "https://api.github.com",
      extraConfig: {
        owner: "",
        repo: "",
        branch: "main",
        pathTemplate: "content/posts/{slug}.md",
        commitMessage: "publish: {title}",
      },
    },
  },
  {
    type: "notion",
    name: "Notion",
    icon: "mdi:notebook-outline",
    description: "发布到 Notion 页面",
    defaultConfig: {
      apiUrl: "https://api.notion.com/v1",
      extraConfig: {
        databaseId: "",
        parentPageId: "",
      },
    },
  },
  {
    type: "yuque",
    name: "语雀",
    icon: "mdi:book-open-variant",
    description: "发布到语雀知识库",
    defaultConfig: {
      apiUrl: "https://www.yuque.com/api/v2",
      extraConfig: {
        repo: "",
      },
    },
  },
  {
    type: "zhihu",
    name: "知乎",
    icon: "mdi:alpha-z-circle",
    description: "发布到知乎专栏",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        cookie: "",
      },
    },
  },
  {
    type: "csdn",
    name: "CSDN",
    icon: "mdi:alpha-c-circle",
    description: "发布到 CSDN 博客",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        cookie: "",
      },
    },
  },
  {
    type: "juejin",
    name: "掘金",
    icon: "mdi:alpha-j-circle",
    description: "发布到掘金",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        cookie: "",
      },
    },
  },
  {
    type: "wechat",
    name: "微信公众号",
    icon: "mdi:wechat",
    description: "发布到微信公众号（草稿箱）",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        cookie: "",
        token: "",
      },
    },
  },
  {
    type: "cnblogs",
    name: "博客园",
    icon: "mdi:leaf",
    description: "通过 MetaWeblog API 发布到博客园",
    defaultConfig: {
      apiUrl: "https://rpc.cnblogs.com/metaweblog/{blogName}",
      extraConfig: {
        blogName: "",
        username: "",
        password: "",
        appKey: "",
      },
    },
  },
  {
    type: "custom",
    name: "自定义平台",
    icon: "mdi:cog-outline",
    description: "自定义 API 端点，支持任意 HTTP 接口",
    defaultConfig: {
      apiUrl: "",
      extraConfig: {
        method: "POST",
        headers: {},
        bodyTemplate: '{"title":"{{title}}","content":"{{content}}"}',
      },
    },
  },
]

/** 思源属性键名 */
export const SY_ATTR_PUBLISH_STATUS = "custom-publish-status"
export const SY_ATTR_PUBLISH_DATA = "custom-publish-data"
