/**
 * 全局关系列表功能 - 类型定义 + 管理器类
 *
 * 基于思源 refs 表查询全库文档间的双向链接（引用/反向链接）关系，
 * 通过共享 Modal 辅助工具创建弹窗界面。
 */
import type { Plugin } from "siyuan"
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
  source: string
  target: string
  anchorText: string
  backlinkDocs: string
  noAnchorText: string
  noBacklinkDocs: string
  close: string
  openDoc: string
  bidirectionalBadge: string
  rows: string
  loadDetailFailed: string
}

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
        plugin,
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
