export interface PageLockInfo {
	docId: string;
	passwordHash: string;
	locked: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface PageLockI18n {
	lockPage?: string;
	unlockPage?: string;
	pageLocked?: string;
	pleaseUnlock?: string;
	passwordPlaceholder?: string;
	confirmPasswordPlaceholder?: string;
	oldPasswordPlaceholder?: string;
	newPasswordPlaceholder?: string;
	setPassword?: string;
	enterPassword?: string;
	updatePassword?: string;
	setPasswordHint?: string;
	unlockHint?: string;
	updatePasswordHint?: string;
	passwordEmpty?: string;
	passwordMismatch?: string;
	passwordError?: string;
	oldPasswordError?: string;
	lockSuccess?: string;
	unlockSuccess?: string;
	passwordSetSuccess?: string;
	passwordUpdateSuccess?: string;
	pleaseSetPasswordFirst?: string;
	confirm?: string;
	cancel?: string;
}

export interface LockDialogProps {
	visible: boolean;
	mode: "lock" | "unlock" | "update";
	i18n: PageLockI18n;
}

export interface LockDialogEmits {
	(e: "update:visible", value: boolean): void;
	(
		e: "confirm",
		password: string,
		confirmPassword?: string,
		oldPassword?: string,
	): void;
	(e: "close"): void;
}

export interface PageLockOptions {
	cacheExpireTime?: number;
	maxCacheSize?: number;
	cacheCleanupInterval?: number;
}

export const DEFAULT_OPTIONS: Required<PageLockOptions> = {
	cacheExpireTime: 60000,
	maxCacheSize: 20,
	cacheCleanupInterval: 30000,
};

export type ProtyleLike = {
	block?: { rootID: string };
	element?: Element;
	wysiwyg?: { element?: Element };
};
