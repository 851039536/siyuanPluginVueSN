function injectStyle(styleId: string, styleContent: string) {
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = styleContent
  document.head.appendChild(style)
}

export function injectLockPageStyles() {
  injectStyle('page-lock-styles', `
    .page-lock-mask--placeholder {
      background: var(--b3-theme-background);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .page-lock-mask {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--b3-theme-background);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .page-lock-mask__content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 32px;
      background: var(--b3-theme-surface);
      border: 1px solid var(--b3-border-color);
      border-radius: 8px;
      box-shadow: var(--b3-shadow);
      z-index: 10;
    }

    .icon-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .page-lock-mask__icon {
      width: 48px;
      height: 48px;
      color: var(--b3-theme-primary);
    }

    .icon-glow, .input-focus-effect, .btn-ripple {
      display: none;
    }

    .page-lock-mask__title {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: var(--b3-theme-on-background);
    }

    .page-lock-mask__text {
      margin: 0;
      font-size: 14px;
      color: var(--b3-theme-on-surface);
      opacity: 0.8;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .hint-text {
      font-size: 13px;
      color: var(--b3-theme-primary);
      opacity: 0.7;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .enter-key {
      display: inline-block;
      padding: 2px 6px;
      background: var(--b3-theme-surface-lighter);
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      color: var(--b3-theme-primary);
    }

    .input-container {
      position: relative;
      width: 320px;
      max-width: 90%;
    }

    .page-lock-mask__input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--b3-border-color);
      border-radius: 6px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-surface);
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }

    .page-lock-mask__input:focus {
      border-color: var(--b3-theme-primary);
      box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1);
    }

    .page-lock-mask__input::placeholder {
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.6;
    }

    .button-container {
      position: relative;
    }

    .page-lock-mask__btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .page-lock-mask__btn:hover {
      background: var(--b3-theme-primary-light);
    }

    .page-lock-mask__btn:active {
      background: var(--b3-theme-primary-dark);
    }

    @media (max-width: 480px) {
      .page-lock-mask__content {
        gap: 20px;
        padding: 24px 20px;
        margin: 20px;
      }

      .page-lock-mask__icon {
        width: 40px;
        height: 40px;
      }

      .page-lock-mask__title {
        font-size: 16px;
      }

      .page-lock-mask__text, .hint-text, .page-lock-mask__input {
        font-size: 13px;
      }

      .enter-key {
        font-size: 11px;
        padding: 1px 5px;
      }

      .input-container {
        width: 280px;
        max-width: 95%;
      }

      .page-lock-mask__input {
        padding: 9px 11px;
      }

      .page-lock-mask__btn {
        padding: 9px 20px;
        font-size: 13px;
      }
    }
  `)
}

export function injectButtonStyles() {
  injectStyle('page-lock-button-styles', `
    .page-lock-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      margin: 0 2px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: var(--b3-theme-on-background);
      opacity: 0.68;
    }

    .page-lock-button:hover {
      background: var(--b3-theme-surface-lighter);
      opacity: 1;
    }

    .page-lock-button:active {
      background: var(--b3-theme-surface);
    }

    .page-lock-button .icon-lock {
      width: 18px;
      height: 18px;
    }

    .page-lock-button .icon-lock--locked {
      color: var(--b3-theme-primary);
      opacity: 1;
    }

    .protyle-title__icons--right {
      display: flex;
      align-items: center;
      gap: 2px;
    }
  `)
}
