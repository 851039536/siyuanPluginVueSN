/**
 * 加密/解密功能模块（注册入口）
 * 支持选中文本的加密和解密操作，使用 AES-256-GCM 加密算法
 */
import { Plugin, showMessage } from "siyuan";
import {
  CONSTANTS,
  deriveKey,
  encryptText,
} from "./types";
import { EncryptionStorage } from "./types/storage";
import { emitCustomEvent } from "@/utils/eventBus";

export class Encryption {
  private plugin: Plugin;
  private storage: EncryptionStorage;
  private password: string = "";
  private cachedKey: CryptoKey | null = null;
  private pendingRange: Range | null = null;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.storage = new EncryptionStorage(plugin);
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
   * 显示解密对话框（通过 Vue 组件）
   */
  private async showDecryptDialog(
    encryptedText: string,
    savedRange: Range,
  ): Promise<void> {
    this.pendingRange = savedRange;
    emitCustomEvent("openDecryptDialog", { encryptedText });
  }

  /**
   * 替换选中的加密文本为解密后的明文
   */
  public async replaceCurrentText(decryptedText: string) {
    if (!this.pendingRange) return;

    try {
      const currentSelection = window.getSelection();
      if (currentSelection) {
        currentSelection.removeAllRanges();
        currentSelection.addRange(this.pendingRange);
      }
      await this.replaceSelectedText(decryptedText);
      showMessage(
        this.plugin.i18n.replaceSuccess || "替换成功",
        2000,
        "info",
      );
    } catch (_error) {
      showMessage(
        this.plugin.i18n.replaceFailed || "替换失败",
        2000,
        "error",
      );
    } finally {
      this.pendingRange = null;
    }
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
      await this.storage.save(this.password);
    } catch (error) {
      console.error("保存密码失败:", error);
    }
  }

  /**
   * 从存储中加载密码
   */
  private async loadPassword() {
    try {
      const password = await this.storage.load();
      if (password) {
        this.password = password;
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
