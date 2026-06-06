import type PluginSample from "@/index"
import { createVueDockApp } from "@/utils/vueAppHelper"
import UnitConverterPanel from "../index.vue"

/**
 * 转换器类型定义
 */
export interface ConverterTab {
  key: string
  name: string
  i18nKey?: string
}

/**
 * 单位转换器配置
 */
export interface UnitConverterOptions {
  defaultTab?: string
}

/**
 * 单位转换器管理类
 */
export class UnitConverterManager {
  private plugin: PluginSample

  constructor(plugin: PluginSample) {
    this.plugin = plugin
  }

  public init() {
    this.addDock()
  }

  private addDock() {
    createVueDockApp(this.plugin, UnitConverterPanel, {
      position: "RightTop",
      width: 360,
      icon: "iconList",
      title: this.plugin.i18n.unitConverter || "单位转换",
      type: "unit-converter-dock",
      i18n: this.plugin.i18n || {},
    })
  }

  public destroy() {
    // 清理逻辑
  }
}
