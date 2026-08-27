/**
 * 全局关系列表功能 - 类型定义 + 管理器类
 *
 * 基于思源 refs 表查询全库文档间的双向链接（引用/反向链接）关系，
 * 通过共享 Modal 辅助工具创建弹窗界面。
 */
import type { Plugin } from "siyuan"
import type { IRefFile } from "@/api"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import GlobalRelationsPanel from "../index.vue"

/** 全局关系列表面板国际化文案接口 */
export interface GlobalRelationsI18n {
  panelTitle: string
  description: string
  refresh: string
  loading: string
  noRelations: string
  loadFailed: string
  searchPlaceholder: string
  directionAll: string
  directionBidirectional: string
  directionUnidirectional: string
  totalRelations: string
  involvedDocs: string
  bidirectionalCount: string
  unidirectionalCount: string
  refCount: string
  anchorText: string
  backlinkDocs: string
  noAnchorText: string
  noBacklinkDocs: string
  close: string
  bidirectionalBadge: string
  loadDetailFailed: string
  truncatedHint: string
}

/** 单条文档间关系记录 */
export interface GlobalRelationRow {
  /** 引用方文档 ID */
  sourceId: string
  /** 引用方文档标题 */
  sourceName: string
  /** 引用方文档路径 */
  sourceHPath: string
  /** 被引用方文档 ID */
  targetId: string
  /** 被引用方文档标题 */
  targetName: string
  /** 被引用方文档路径 */
  targetHPath: string
  /** 引用次数 */
  refCount: number
  /** 是否为双向引用（对方也引用了本方） */
  bidirectional: boolean
  /** 引用锚文本详情（按需加载） */
  contents?: string[]
  /** 反向链接文档列表（getBacklink2 按需加载，复用 @/api IRefFile） */
  backlinkDocs?: IRefFile[]
  /** 详情加载中 */
  detailsLoading?: boolean
  /** 详情已展开 */
  detailsExpanded?: boolean
  /** 详情加载失败标记 */
  detailsFailed?: boolean
}

/** 方向筛选类型 */
export type DirectionFilter = "all" | "bidirectional" | "unidirectional"

/**
 * 全局关系列表管理器
 */
export class GlobalRelationsManager {
  private modal: ModalAppInstance

  constructor(plugin: Plugin) {
    // 使用共享 Modal 辅助工具创建弹窗
    this.modal = createModalVueApp(GlobalRelationsPanel, {
      maskId: "global-relations-mask",
      width: "840px",
      height: "82vh",
      getCloseHandler: () => this.close,
      buildProps: () => ({
        i18n: (plugin.i18n as unknown as { globalRelations?: GlobalRelationsI18n }).globalRelations || {},
        onClose: this.close,
      }),
    })
  }

  /**
   * 切换全局关系列表面板显示/隐藏
   */
  public toggle = (): void => {
    if (this.modal.visible) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * 打开全局关系列表面板
   */
  private open(): void {
    this.modal.open()
  }

  /**
   * 关闭全局关系列表面板
   */
  private close = (): void => {
    this.modal.close()
  }

  /**
   * 销毁管理器（插件卸载时彻底清理 Modal 实例与 DOM）
   */
  public destroy(): void {
    this.modal.destroy()
  }
}
