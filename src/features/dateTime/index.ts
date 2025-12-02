import { Plugin } from 'siyuan';
import { DateTime } from './DateTime';

let dateTimeInstance: DateTime | null = null;

/**
 * 注册日期时间插入功能
 */
export function registerDateTime(plugin: Plugin) {
  dateTimeInstance = new DateTime(plugin);
  dateTimeInstance.init();
}

/**
 * 销毁日期时间插入功能
 */
export function destroyDateTime() {
  if (dateTimeInstance) {
    dateTimeInstance.destroy();
    dateTimeInstance = null;
  }
}
