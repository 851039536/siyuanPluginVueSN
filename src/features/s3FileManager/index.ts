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
import S3FileManagerPanel from "./index.vue"
import { S3FileManagerStorage } from "./types/storage"

let instance: S3FileManager | null = null

/** 获取当前 S3FileManager 实例 */
export function getS3FileManagerInstance(): S3FileManager | null {
  return instance
}

export class S3FileManager {
  private plugin: Plugin
  private storage: S3FileManagerStorage
  private modal: ModalAppInstance
  private _openHandler: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new S3FileManagerStorage(plugin)

    this.modal = createModalVueApp(S3FileManagerPanel, {
      maskId: "s3-file-manager-mask",
      width: "90vw",
      height: "85vh",
      persistent: true,
      getCloseHandler: () => this.close,
      buildProps: () => ({
        onClose: this.close,
        plugin: this.plugin,
        storage: this.storage,
        i18n: this.plugin.i18n.s3FileManager,
      }),
    })
  }

  init(): void {
    this._openHandler = () => this.open()
    window.addEventListener("openS3FileManager", this._openHandler)
    // 触发 Vue 组件 mount 后立即隐藏（persistent 模式保留内部状态）
    this.modal.open()
    this.modal.close()
  }

  open(): void {
    this.modal.open()
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
