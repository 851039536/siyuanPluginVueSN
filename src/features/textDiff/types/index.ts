import { Plugin } from "siyuan";
import { createApp, h, type App as VueApp } from "vue";
// @ts-ignore
import TextDiffPanel from "../index.vue";

export * from "./storage";

/**
 * 文本对比管理器
 */
export class TextDiffManager {
	private plugin: Plugin;
	private app: VueApp | null = null;
	private container: HTMLElement | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	/**
	 * 切换文本对比工具显示/隐藏
	 */
	public toggle = () => {
		if (this.app && this.container) {
			this.close();
		} else {
			this.open();
		}
	};

	/**
	 * 打开文本对比工具
	 */
	private open() {
		// 创建遮罩层
		const mask = document.createElement("div");
		mask.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
		mask.id = "text-diff-mask";

		// 创建容器
		this.container = document.createElement("div");
		this.container.style.cssText = `
      width: 90vw;
      height: 80vh;
      background: var(--b3-theme-background);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    `;

		// 添加关闭按钮
		const closeBtn = document.createElement("button");
		closeBtn.innerHTML = "✕";
		closeBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      color: var(--b3-theme-on-background);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      z-index: 1;
    `;
		closeBtn.onclick = () => this.close();

		mask.appendChild(closeBtn);
		mask.appendChild(this.container);
		document.body.appendChild(mask);

		// 点击遮罩层关闭
		mask.onclick = (e) => {
			if (e.target === mask) {
				this.close();
			}
		};

		// 创建 Vue 应用
		this.app = createApp({
			setup: () => {
				return () =>
					h(TextDiffPanel, {
						onClose: this.close,
						i18n: this.plugin.i18n,
						plugin: this.plugin,
					});
			},
		});

		this.app.mount(this.container);
	}

	/**
	 * 关闭文本对比工具
	 */
	private close = () => {
		if (this.app) {
			this.app.unmount();
			this.app = null;
		}

		const mask = document.getElementById("text-diff-mask");
		if (mask) {
			mask.remove();
		}

		this.container = null;
	};

	/**
	 * 销毁管理器
	 */
	public destroy() {
		this.close();
	}
}

/**
 * 注册文本对比功能
 */
export function registerTextDiff(plugin: Plugin): TextDiffManager {
	const manager = new TextDiffManager(plugin);
	(plugin as any).__textDiff = manager;
	return manager;
}
