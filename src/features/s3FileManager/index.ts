/**
 * S3 文件管理器功能模块
 *
 * 提供类 Windows 资源管理器的 S3 兼容存储可视化文件管理：配置管理、
 * 目录浏览、上传/下载、新建文件夹、复制/移动/重命名/删除、操作日志。
 * S3FileManager 类管理 persistent Modal 与打开事件监听。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { emitCustomEvent } from "@/utils/eventBus"
import S3FileManagerPanel from "./index.vue"
import { S3_FM_FIRST_OPEN_EVENT } from "./types"
import { S3FileManagerStorage } from "./types/storage"

let instance: S3FileManager | null = null

export class S3FileManager {
  private plugin: Plugin
  private storage: S3FileManagerStorage
  private modal: ModalAppInstance
  private _openHandler: (() => void) | null = null
  /** 是否已发过首次打开事件（只发一次） */
  private _firstOpenNotified = false

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new S3FileManagerStorage(plugin)

    this.modal = createModalVueApp(S3FileManagerPanel, {
      maskId: "s3-file-manager-mask",
      width: "72vw",
      height: "85vh",
      persistent: true,
      getCloseHandler: () => this.close,
      buildProps: () => ({
        onClose: this.close,
        storage: this.storage,
        i18n: this.plugin.i18n.s3FileManager,
      }),
    })
  }

  init(): void {
    // 幂等：重复 init 会叠加同名监听，且旧 handler 引用被覆盖后无法移除
    if (this._openHandler) { return }
    this._openHandler = () => this.open()
    window.addEventListener("openS3FileManager", this._openHandler)
    // 触发 Vue 组件 mount 后立即隐藏（persistent 模式保留内部状态）；
    // 预热挂载只做配置/日志/偏好的加载，首次目录列举延迟到用户真正打开面板
    this.modal.open()
    this.modal.close()
  }

  open(): void {
    this.modal.open()
    // 通知面板「此刻才真正可见」：首次打开时才发起目录列举（经统一事件入口，
    // 与 window 级 openS3FileManager 监听同源）
    if (!this._firstOpenNotified) {
      this._firstOpenNotified = true
      emitCustomEvent(S3_FM_FIRST_OPEN_EVENT)
    }
  }

  close = (): void => {
    this.modal.close()
  }

  destroy(): void {
    if (this._openHandler) {
      window.removeEventListener("openS3FileManager", this._openHandler)
      this._openHandler = null
    }
    this.modal.destroy()
    // 关闭 SQLite 日志仓库（幂等；初始化窗口期内到达的句柄也会被立即关闭）
    this.storage.logs.close()
    // 清除 plugin 上的挂载点，避免卸载后留下悬挂引用
    if ((this.plugin as any).__s3FileManager === this) {
      delete (this.plugin as any).__s3FileManager
    }
    if (instance === this) {
      instance = null
    }
  }
}

/**
 * 注册 S3 文件管理器功能
 */
export function registerS3FileManager(plugin: Plugin): void {
  // 重复注册防护：先销毁旧实例，避免监听器/persistent Modal 泄漏
  instance?.destroy()
  instance = new S3FileManager(plugin)
  // 挂到 plugin 实例供 onunload() 销毁钩子调用
  ;(plugin as any).__s3FileManager = instance
  instance.init()
}
