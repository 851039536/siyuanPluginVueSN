/**
 * 发布平台静态元数据（跨功能共享真源）
 *
 * docAnalysis 的默认平台列表与 docNavigation 的发布状态徽章均由此派生，
 * 避免两个功能各自维护一份 matchers / name 造成识别口径漂移。
 * （仓库规则：功能模块之间禁止直接相互导入，共享数据统一放在 config。）
 */

/** 发布平台静态定义 */
export interface PublishPlatformDef {
  /** 平台唯一标识（同时作为平台管理里的默认 id） */
  id: string
  /** YAML 属性 key 匹配关键词（小写比较，如 custom-csdn-yaml → csdn） */
  matchers: string[]
  /** 显示名称 */
  name: string
  /** 平台发布入口 URL（无独立入口时为空串） */
  url: string
}

/** 全部内置发布平台（数组顺序即 UI 展示顺序） */
export const PUBLISH_PLATFORMS: PublishPlatformDef[] = [
  { id: "csdn", matchers: ["csdn"], name: "CSDN", url: "https://mp.csdn.net/mp_blog/creation/editor" },
  { id: "zhihu", matchers: ["zhihu"], name: "知乎", url: "https://zhuanlan.zhihu.com/write" },
  { id: "juejin", matchers: ["juejin"], name: "掘金", url: "https://juejin.cn/editor/drafts/new" },
  { id: "cnblogs", matchers: ["cnblogs", "blog"], name: "博客园", url: "https://i.cnblogs.com/posts/edit" },
  { id: "bili", matchers: ["bili", "bibi"], name: "B站", url: "https://www.bilibili.com/" },
  { id: "gzh", matchers: ["gzh"], name: "公众号", url: "" },
  { id: "jianshu", matchers: ["jianshu"], name: "简书", url: "https://www.jianshu.com/writer" },
  { id: "cto51", matchers: ["cto51"], name: "51CTO", url: "https://blog.51cto.com/writer" },
  { id: "segmentfault", matchers: ["segmentfault", "sifou"], name: "思否", url: "https://segmentfault.com/write" },
  { id: "oschina", matchers: ["oschina"], name: "开源中国", url: "https://oschina.net/writer" },
  { id: "infoq", matchers: ["infoq"], name: "InfoQ", url: "https://www.infoq.com/" },
]

/** matchers + name 精简投影（导航栏发布状态徽章使用） */
export const PLATFORM_MATCHERS: Array<{ matchers: string[], name: string }> =
  PUBLISH_PLATFORMS.map(({ matchers, name }) => ({ matchers, name }))
