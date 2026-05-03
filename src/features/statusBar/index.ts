/**
 * 状态栏功能模块
 */
import { Plugin } from "siyuan";
import { createApp } from "vue";
// @ts-ignore
import StatusBarPanel from "./index.vue";
import "./styles/index.scss";

// 导出类型和常量
export type { ResourceLevel, Thresholds, StatusBarState } from "./types";
export {
  THRESHOLDS,
  MONITOR_INTERVAL_MS,
  STATISTICS_INTERVAL_MS,
  INITIAL_DELAY_MS,
  DEFAULT_TOTAL_MEMORY_GB,
} from "./types";

// ============================================================
// 注册函数
// ============================================================

let app: ReturnType<typeof createApp> | null = null;
let statusBarElement: HTMLElement | null = null;

/**
 * 注册状态栏功能
 */
export function registerStatusBar(plugin: Plugin) {
  if (app) return; // 避免重复注册

  const container = document.createElement("div");
  app = createApp(StatusBarPanel);
  app.mount(container);

  // 使用思源官方 API 将组件添加到状态栏
  statusBarElement = plugin.addStatusBar({
    element: container.firstElementChild as HTMLElement,
    position: "right",
  });
}

/**
 * 注销状态栏功能
 */
export function unregisterStatusBar() {
  if (statusBarElement) {
    statusBarElement.remove();
    statusBarElement = null;
  }
  if (app) {
    app.unmount();
    app = null;
  }
}
