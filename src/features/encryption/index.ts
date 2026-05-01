/**
 * 加密/解密功能模块（注册入口）
 * 支持选中文本的加密和解密操作，使用 AES-256-GCM 加密算法
 */
import { Plugin, showMessage } from "siyuan";
import {
	CONSTANTS,
	deriveKey,
	encryptText,
	decryptText,
} from "./types";

export class Encryption {
	private plugin: Plugin;
	private password: string = "";
	private cachedKey: CryptoKey | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	/**
	 * 初始化加密模块
	 */
	async init() {
		await this.loadPassword();
		this.registerContextMenu();
	}

	/**
	 * 销毁模块
	 */
	destroy() {
		this.plugin.eventBus.off("open-menu-content", this.handleEditorContextMenu);
	}

	/**
	 * 注册右键菜单
	 */
	private registerContextMenu() {
		this.plugin.eventBus.on("open-menu-content", this.handleEditorContextMenu);
	}

	/**
	 * 处理编辑器右键菜单事件
	 */
	private handleEditorContextMenu = (event: any) => {
		const menu = event.detail.menu;
		const selectedText = window.getSelection()?.toString().trim();

		if (selectedText) {
			const isEncrypted = /^\[encrypted\].*\[\/encrypted\]$/.test(selectedText);

			if (isEncrypted) {
				menu.addItem({
					iconHTML: "🔓",
					label: this.plugin.i18n.decryptText,
					click: async () => {
						await this.decryptSelectedText();
					},
				});
			} else {
				menu.addItem({
					iconHTML: "🔒",
					label: this.plugin.i18n.encryptText,
					click: async () => {
						await this.encryptSelectedText();
					},
				});
			}
		}
	};

	/**
	 * 验证选中文本
	 */
	private validateSelection(): { text: string; range: Range } | null {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return null;
		}

		const text = selection.toString().trim();
		if (!text) {
			return null;
		}

		const range = selection.getRangeAt(0).cloneRange();
		return { text, range };
	}

	/**
	 * 加密选中的文本
	 */
	private async encryptSelectedText() {
		const validation = this.validateSelection();
		if (!validation) {
			await this.showError(this.plugin.i18n.noTextSelected);
			return;
		}

		if (!this.password) {
			await this.showError(this.plugin.i18n.passwordNotSet);
			return;
		}

		try {
			const key = await this.getOrDeriveKey(this.password);
			const encrypted = await encryptText(validation.text, key);
			const replacedText = CONSTANTS.ENCRYPTED_WRAPPER(encrypted);

			const currentSelection = window.getSelection();
			if (currentSelection) {
				currentSelection.removeAllRanges();
				currentSelection.addRange(validation.range);
			}

			await this.replaceSelectedText(replacedText);
			showMessage(this.plugin.i18n.encryptSuccess, 2000, "info");
		} catch (_error) {
			await this.showError(this.plugin.i18n.encryptFailed);
		}
	}

	/**
	 * 解密选中的文本
	 */
	private async decryptSelectedText() {
		const validation = this.validateSelection();
		if (!validation) {
			await this.showError(this.plugin.i18n.noTextSelected);
			return;
		}

		const encryptedMatch = validation.text.match(CONSTANTS.ENCRYPTED_PATTERN);
		if (!encryptedMatch) {
			await this.showError(this.plugin.i18n.invalidEncryptedFormat);
			return;
		}

		await this.showDecryptDialog(encryptedMatch[1], validation.range);
	}

	/**
	 * 替换选中的文本
	 */
	private async replaceSelectedText(newText: string) {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return;
		}

		const range = selection.getRangeAt(0);
		const editableElement =
			range.commonAncestorContainer.parentElement?.closest(
				'[contenteditable="true"]',
			);

		range.deleteContents();
		const textNode = document.createTextNode(newText);
		range.insertNode(textNode);

		range.setStartAfter(textNode);
		range.setEndAfter(textNode);
		selection.removeAllRanges();
		selection.addRange(range);

		if (editableElement) {
			const inputEvent = new InputEvent("input", {
				bubbles: true,
				cancelable: true,
				inputType: "insertText",
				data: newText,
			});
			editableElement.dispatchEvent(inputEvent);

			const changeEvent = new Event("change", { bubbles: true });
			editableElement.dispatchEvent(changeEvent);
		}
	}

	/**
	 * 获取或派生加密密钥（带缓存）
	 */
	private async getOrDeriveKey(password: string): Promise<CryptoKey> {
		if (this.cachedKey) {
			return this.cachedKey;
		}
		const key = await deriveKey(password);
		this.cachedKey = key;
		return key;
	}

	/**
	 * 显示错误信息
	 */
	private async showError(message: string) {
		showMessage(message, 3000, "error");
	}

	/**
	 * 显示解密对话框
	 */
	private async showDecryptDialog(
		encryptedText: string,
		savedRange: Range,
	): Promise<void> {
		return new Promise((resolve) => {
			const container = document.createElement("div");
			container.style.cssText =
				"position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

			const dialog = document.createElement("div");
			dialog.style.cssText =
				"background: var(--b3-theme-background); border-radius: 8px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;";

			dialog.innerHTML = `
        <div id="decryptContent">
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--b3-theme-on-background); display: flex; align-items: center; gap: 8px;">
              🔓 ${this.plugin.i18n.decryptText}
            </h3>
            <p style="margin: 0; font-size: 13px; color: var(--b3-theme-on-surface-light);">
              ${this.plugin.i18n.enterPasswordToDecrypt || "请输入密码以解密内容"}
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: var(--b3-theme-on-background);">
              ${this.plugin.i18n.decryptPassword}
            </label>
            <input type="password" id="passwordInput" placeholder="${this.plugin.i18n.enterPassword}"
              style="width: 100%; padding: 10px 12px; border: 1px solid var(--b3-theme-surface-lighter); border-radius: 6px; box-sizing: border-box; font-size: 14px; background: var(--b3-theme-surface); color: var(--b3-theme-on-background);" />
            <div id="errorMsg" style="margin-top: 8px; color: var(--b3-card-error-color); font-size: 12px; display: none;"></div>
          </div>

          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 10px 20px; border: 1px solid var(--b3-theme-surface-lighter); background: var(--b3-theme-surface); color: var(--b3-theme-on-surface); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              ${this.plugin.i18n.cancel}
            </button>
            <button id="decryptBtn" style="padding: 10px 20px; border: none; background: var(--b3-theme-primary); color: var(--b3-theme-on-primary); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
              ${this.plugin.i18n.decrypt || "解密"}
            </button>
          </div>
        </div>
      `;

			container.appendChild(dialog);
			document.body.appendChild(container);

			const passwordInput = dialog.querySelector(
				"#passwordInput",
			) as HTMLInputElement;
			const cancelBtn = dialog.querySelector("#cancelBtn") as HTMLButtonElement;
			const decryptBtn = dialog.querySelector(
				"#decryptBtn",
			) as HTMLButtonElement;
			const errorMsg = dialog.querySelector("#errorMsg") as HTMLDivElement;

			const cleanup = () => {
				container.remove();
				resolve();
			};

			const handleClose = () => cleanup();

			cancelBtn.addEventListener("click", handleClose);
			container.addEventListener("click", (e) => {
				if (e.target === container) handleClose();
			});

			const handleDecrypt = async () => {
				const password = passwordInput.value.trim();
				if (!password) {
					errorMsg.textContent = this.plugin.i18n.passwordEmpty;
					errorMsg.style.display = "block";
					return;
				}

				try {
					decryptBtn.disabled = true;
					decryptBtn.textContent = this.plugin.i18n.decrypting || "解密中...";
					errorMsg.style.display = "none";

					const key = await deriveKey(password);
					const decrypted = await decryptText(encryptedText, key);

					this.showDecryptResult(dialog, decrypted, savedRange, cleanup);
				} catch (_error) {
					errorMsg.textContent = this.plugin.i18n.decryptFailed;
					errorMsg.style.display = "block";
					decryptBtn.disabled = false;
					decryptBtn.textContent = this.plugin.i18n.decrypt || "解密";
				}
			};

			decryptBtn.addEventListener("click", handleDecrypt);
			passwordInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					handleDecrypt();
				}
			});

			passwordInput.focus();
		});
	}

	/**
	 * 显示解密结果
	 */
	private showDecryptResult(
		dialog: HTMLElement,
		decryptedText: string,
		savedRange: Range,
		cleanup: () => void,
	) {
		const contentDiv = dialog.querySelector("#decryptContent");
		if (!contentDiv) return;

		contentDiv.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--b3-theme-on-background); display: flex; align-items: center; gap: 8px;">
          ✅ ${this.plugin.i18n.decryptSuccess}
        </h3>
        <p style="margin: 0; font-size: 13px; color: var(--b3-theme-on-surface-light);">
          ${this.plugin.i18n.decryptResultHint || "解密成功，您可以复制内容或替换原文"}
        </p>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: var(--b3-theme-on-background);">
          ${this.plugin.i18n.decryptedContent || "解密内容"}
        </label>
        <div style="position: relative;">
          <textarea id="decryptedText" readonly
            style="width: 100%; min-height: 150px; max-height: 300px; padding: 12px; border: 1px solid var(--b3-theme-surface-lighter); border-radius: 6px; box-sizing: border-box; font-size: 14px; background: var(--b3-theme-surface); color: var(--b3-theme-on-background); font-family: var(--b3-font-family-code); line-height: 1.6; resize: vertical;"
          >${decryptedText}</textarea>
        </div>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
        <button id="closeBtn" style="padding: 10px 20px; border: 1px solid var(--b3-theme-surface-lighter); background: var(--b3-theme-surface); color: var(--b3-theme-on-surface); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          ${this.plugin.i18n.close}
        </button>
        <button id="copyBtn" style="padding: 10px 20px; border: 1px solid var(--b3-theme-primary); background: transparent; color: var(--b3-theme-primary); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px;">
          📋 ${this.plugin.i18n.copyContent || "复制内容"}
        </button>
        <button id="replaceBtn" style="padding: 10px 20px; border: none; background: var(--b3-theme-primary); color: var(--b3-theme-on-primary); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px;">
          🔄 ${this.plugin.i18n.replaceEncrypted || "替换加密文本"}
        </button>
      </div>
    `;

		const closeBtn = contentDiv.querySelector("#closeBtn") as HTMLButtonElement;
		const copyBtn = contentDiv.querySelector("#copyBtn") as HTMLButtonElement;
		const replaceBtn = contentDiv.querySelector(
			"#replaceBtn",
		) as HTMLButtonElement;
		const textarea = contentDiv.querySelector(
			"#decryptedText",
		) as HTMLTextAreaElement;

		closeBtn.addEventListener("click", cleanup);

		copyBtn.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(decryptedText);
				copyBtn.innerHTML = `✅ ${this.plugin.i18n.copied || "已复制"}`;
				setTimeout(() => {
					copyBtn.innerHTML = `📋 ${this.plugin.i18n.copyContent || "复制内容"}`;
				}, 2000);
				showMessage(this.plugin.i18n.copySuccess, 2000, "info");
			} catch (_error) {
				showMessage(this.plugin.i18n.copyFailed, 2000, "error");
			}
		});

		replaceBtn.addEventListener("click", async () => {
			try {
				const currentSelection = window.getSelection();
				if (currentSelection) {
					currentSelection.removeAllRanges();
					currentSelection.addRange(savedRange);
				}
				await this.replaceSelectedText(decryptedText);
				showMessage(
					this.plugin.i18n.replaceSuccess || "替换成功",
					2000,
					"info",
				);
				cleanup();
			} catch (_error) {
				showMessage(
					this.plugin.i18n.replaceFailed || "替换失败",
					2000,
					"error",
				);
			}
		});

		textarea.select();
	}

	/**
	 * 设置密码
	 */
	public setPassword(password: string) {
		this.password = password;
		this.cachedKey = null;
	}

	/**
	 * 获取密码状态
	 */
	public hasPassword(): boolean {
		return this.password.length > 0;
	}

	/**
	 * 保存密码到存储
	 */
	public async savePassword() {
		try {
			await this.plugin.saveData(CONSTANTS.STORAGE_KEY, {
				password: this.password,
			});
		} catch (error) {
			console.error("保存密码失败:", error);
		}
	}

	/**
	 * 从存储中加载密码
	 */
	private async loadPassword() {
		try {
			const data = await this.plugin.loadData(CONSTANTS.STORAGE_KEY);
			if (data?.password) {
				this.password = data.password;
			}
		} catch (error) {
			console.error("加载密码失败:", error);
		}
	}
}

let encryptionInstance: Encryption | null = null;

/**
 * 注册加密功能
 */
export async function registerEncryption(plugin: Plugin) {
	encryptionInstance = new Encryption(plugin);
	await encryptionInstance.init();
}

/**
 * 获取加密实例
 */
export function getEncryptionInstance(): Encryption | null {
	return encryptionInstance;
}
