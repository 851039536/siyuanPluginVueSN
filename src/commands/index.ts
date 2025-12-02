import { Plugin } from 'siyuan';
import { DateTime } from './DateTime';

let dateTimeInstance: DateTime | null = null;

/**
 * 初始化所有斜杠命令
 */
export function initCommands(plugin: Plugin) {
  // 初始化日期时间插入命令
  dateTimeInstance = new DateTime(plugin);
  dateTimeInstance.init();
}

/**
 * 销毁所有斜杠命令
 */
export function destroyCommands() {
  if (dateTimeInstance) {
    dateTimeInstance.destroy();
    dateTimeInstance = null;
  }
}
