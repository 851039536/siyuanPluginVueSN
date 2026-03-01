/**
 * 通用设置模块管理器
 * 用于管理各种设置模块，支持动态加载和扩展
 */

import type { Plugin } from 'siyuan';

export interface SettingsModule {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  component: any;
  order?: number;
  enabled?: boolean;
}

export class ModuleManager {
  private modules: Map<string, SettingsModule> = new Map();
  // private plugin: Plugin; // 预留用于未来扩展

  constructor(_plugin: Plugin) {
    // this.plugin = plugin; // 预留用于未来扩展
  }

  /**
   * 注册设置模块
   */
  registerModule(module: SettingsModule): void {
    this.modules.set(module.id, module);
  }

  /**
   * 获取所有模块
   */
  getModules(): SettingsModule[] {
    return Array.from(this.modules.values())
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * 获取启用的模块
   */
  getEnabledModules(): SettingsModule[] {
    return this.getModules().filter(module => module.enabled !== false);
  }

  /**
   * 根据ID获取模块
   */
  getModule(id: string): SettingsModule | undefined {
    return this.modules.get(id);
  }

  /**
   * 启用/禁用模块
   */
  setModuleEnabled(id: string, enabled: boolean): void {
    const module = this.modules.get(id);
    if (module) {
      module.enabled = enabled;
    }
  }

  /**
   * 移除模块
   */
  removeModule(id: string): boolean {
    return this.modules.delete(id);
  }

  /**
   * 清空所有模块
   */
  clearModules(): void {
    this.modules.clear();
  }

  /**
   * 获取模块数量
   */
  getModuleCount(): number {
    return this.modules.size;
  }

  /**
   * 检查模块是否存在
   */
  hasModule(id: string): boolean {
    return this.modules.has(id);
  }
}
