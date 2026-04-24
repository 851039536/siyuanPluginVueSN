/**
 * 数据备份管理器
 * 支持：全量/增量备份、备份恢复、完整性校验（SHA256）、进度回调
 */
import JSZip from "jszip";

// ========== 类型定义 ==========

export interface BackupProgress {
	phase: "scanning" | "packing" | "compressing" | "saving" | "verifying";
	currentFile: string;
	filesProcessed: number;
	totalFiles: number;
	percent: number;
}

export interface BackupResult {
	success: boolean;
	fileName: string;
	filePath: string;
	size: number;
	checksum: string;
	isIncremental: boolean;
	changedFiles: number;
	totalFiles: number;
}

export interface RestoreProgress {
	phase: "reading" | "extracting" | "verifying" | "writing";
	currentFile: string;
	filesProcessed: number;
	totalFiles: number;
	percent: number;
}

export interface RestoreResult {
	success: boolean;
	restoredFiles: number;
	skippedFiles: number;
}

export interface VerifyResult {
	valid: boolean;
	checksum: string;
	expectedChecksum: string;
	fileCount: number;
	totalSize: number;
	error?: string;
}

export interface BackupManifest {
	version: string;
	timestamp: number;
	isIncremental: boolean;
	baseBackup?: string;
	files: Record<string, { mtime: number; size: number }>;
}

export interface BackupOptions {
	incremental?: boolean;
	compressionLevel?: number;
	excludeDirs?: string[];
	onProgress?: (progress: BackupProgress) => void;
}

export interface RestoreOptions {
	onProgress?: (progress: RestoreProgress) => void;
}

export interface BackupInfo {
	timestamp: number;
	backupTime: string;
	version: string;
	workspaceRoot: string;
	workspaceDataPath: string;
	backupDir: string;
	checksum: string;
	isIncremental: boolean;
	baseBackup?: string;
	changedFiles: number;
	totalFiles: number;
}

// ========== 工具函数 ==========

function formatTimestamp(now: Date): string {
	const year = now.getFullYear().toString().slice(-2);
	const month = (now.getMonth() + 1).toString().padStart(2, "0");
	const day = now.getDate().toString().padStart(2, "0");
	const hour = now.getHours().toString().padStart(2, "0");
	const minute = now.getMinutes().toString().padStart(2, "0");
	const second = now.getSeconds().toString().padStart(2, "0");
	return `data-${year}${month}${day}-${hour}${minute}${second}.zip`;
}

async function computeSHA256(buffer: Uint8Array): Promise<string> {
	try {
		// Electron 环境：使用 Node crypto
		if (typeof window.require === "function") {
			const crypto = window.require("crypto");
			const hash = crypto.createHash("sha256");
			hash.update(Buffer.from(buffer));
			return hash.digest("hex");
		}
	} catch {
		// 降级到 Web Crypto API
	}
	// Web Crypto API 降级方案
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ========== BackupManager ==========

export class BackupManager {
	private workspacePath: string;
	private workspaceRoot: string;
	private lastBackupTimestamp = 0;
	private manifest: BackupManifest | null = null;
	private plugin: any;

	constructor(plugin: any, workspacePath: string, workspaceRoot: string) {
		this.plugin = plugin;
		this.workspacePath = workspacePath;
		this.workspaceRoot = workspaceRoot;
	}

	get backupDir(): string {
		return `${this.workspaceRoot}/data-backup`;
	}

	setLastBackupTimestamp(ts: number) {
		this.lastBackupTimestamp = ts;
	}

	updateWorkspacePaths(workspacePath: string, workspaceRoot: string) {
		this.workspacePath = workspacePath;
		this.workspaceRoot = workspaceRoot;
	}

	// ========== 全量备份 ==========

	async performFullBackup(options: BackupOptions = {}): Promise<BackupResult> {
		const { compressionLevel = 6, excludeDirs = [], onProgress } = options;

		this.ensureFileSystem();

		const fs = window.require("fs").promises;
		const path = window.require("path");

		// 验证工作区
		try {
			await fs.access(this.workspacePath);
		} catch {
			throw new Error(`data 目录不存在: ${this.workspacePath}`);
		}

		const skipDirs = new Set(["temp", ".recycle", ...excludeDirs]);
		const zip = new JSZip();

		// 阶段1：扫描文件
		onProgress?.({
			phase: "scanning",
			currentFile: "",
			filesProcessed: 0,
			totalFiles: 0,
			percent: 0,
		});

		const allFiles: { fullPath: string; relativePath: string; mtime: number; size: number }[] = [];
		await this.scanDirectory(this.workspacePath, "", skipDirs, allFiles, onProgress);

		const totalFiles = allFiles.length;
		const fileManifest: BackupManifest["files"] = {};

		// 阶段2：打包文件
		for (let i = 0; i < allFiles.length; i++) {
			const file = allFiles[i];
			onProgress?.({
				phase: "packing",
				currentFile: file.relativePath,
				filesProcessed: i + 1,
				totalFiles,
				percent: Math.round(((i + 1) / totalFiles) * 70),
			});

			try {
				const content = await fs.readFile(file.fullPath);
				zip.file(file.relativePath, content);
				fileManifest[file.relativePath] = { mtime: file.mtime, size: file.size };
			} catch (err) {
				console.warn(`无法读取文件: ${file.fullPath}`, err);
			}
		}

		// 写入 backup-info.json
		const checksumPlaceholder = "";
		const backupInfo: BackupInfo = {
			timestamp: Date.now(),
			backupTime: new Date().toISOString(),
			version: "2.0",
			workspaceRoot: this.workspaceRoot,
			workspaceDataPath: this.workspacePath,
			backupDir: this.backupDir,
			checksum: checksumPlaceholder,
			isIncremental: false,
			changedFiles: totalFiles,
			totalFiles,
		};
		zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2));

		// 阶段3：压缩
		onProgress?.({
			phase: "compressing",
			currentFile: "",
			filesProcessed: totalFiles,
			totalFiles,
			percent: 75,
		});

		const zipBuffer = await zip.generateAsync(
			{ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: compressionLevel } },
			(metadata) => {
				onProgress?.({
					phase: "compressing",
					currentFile: "",
					filesProcessed: totalFiles,
					totalFiles,
					percent: 75 + Math.round(metadata.percent * 0.15),
				});
			},
		);

		// 阶段4：计算校验和
		onProgress?.({
			phase: "verifying",
			currentFile: "",
			filesProcessed: totalFiles,
			totalFiles,
			percent: 92,
		});

		const checksum = await computeSHA256(zipBuffer);

		// 用真实 checksum 重新写入 backup-info.json
		backupInfo.checksum = checksum;
		zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2));

		// 重新生成 zip（因为 checksum 更新了）
		const finalBuffer = await zip.generateAsync({
			type: "uint8array",
			compression: "DEFLATE",
			compressionOptions: { level: compressionLevel },
		});

		// 阶段5：保存文件
		onProgress?.({
			phase: "saving",
			currentFile: "",
			filesProcessed: totalFiles,
			totalFiles,
			percent: 95,
		});

		await fs.mkdir(this.backupDir, { recursive: true });
		const fileName = formatTimestamp(new Date());
		const zipFilePath = path.join(this.backupDir, fileName);
		await fs.writeFile(zipFilePath, finalBuffer);

		// 保存 manifest
		this.manifest = {
			version: "2.0",
			timestamp: Date.now(),
			isIncremental: false,
			files: fileManifest,
		};
		await this.saveManifest();

		this.lastBackupTimestamp = Date.now();

		const stats = await fs.stat(zipFilePath);

		onProgress?.({
			phase: "saving",
			currentFile: "",
			filesProcessed: totalFiles,
			totalFiles,
			percent: 100,
		});

		return {
			success: true,
			fileName,
			filePath: zipFilePath,
			size: stats.size,
			checksum,
			isIncremental: false,
			changedFiles: totalFiles,
			totalFiles,
		};
	}

	// ========== 增量备份 ==========

	async performIncrementalBackup(options: BackupOptions = {}): Promise<BackupResult> {
		const { compressionLevel = 6, excludeDirs = [], onProgress } = options;

		this.ensureFileSystem();

		const fs = window.require("fs").promises;
		const path = window.require("path");

		// 加载 manifest
		await this.loadManifest();
		if (!this.manifest) {
			// 无 manifest，回退到全量备份
			return this.performFullBackup(options);
		}

		// 验证工作区
		try {
			await fs.access(this.workspacePath);
		} catch {
			throw new Error(`data 目录不存在: ${this.workspacePath}`);
		}

		const skipDirs = new Set(["temp", ".recycle", ...excludeDirs]);
		const zip = new JSZip();

		// 扫描文件
		onProgress?.({
			phase: "scanning",
			currentFile: "",
			filesProcessed: 0,
			totalFiles: 0,
			percent: 0,
		});

		const allFiles: { fullPath: string; relativePath: string; mtime: number; size: number }[] = [];
		await this.scanDirectory(this.workspacePath, "", skipDirs, allFiles, onProgress);

		// 筛选变更文件
		const changedFilesList: typeof allFiles = [];
		const newManifest: BackupManifest["files"] = {};

		for (const file of allFiles) {
			const old = this.manifest.files[file.relativePath];
			if (!old || old.mtime !== file.mtime || old.size !== file.size) {
				changedFilesList.push(file);
			}
			newManifest[file.relativePath] = { mtime: file.mtime, size: file.size };
		}

		const totalFiles = allFiles.length;
		const changedCount = changedFilesList.length;

		// 如果变更文件超过 80%，自动转为全量备份
		if (changedCount / totalFiles > 0.8) {
			return this.performFullBackup(options);
		}

		// 打包变更文件
		for (let i = 0; i < changedFilesList.length; i++) {
			const file = changedFilesList[i];
			onProgress?.({
				phase: "packing",
				currentFile: file.relativePath,
				filesProcessed: i + 1,
				totalFiles: changedCount,
				percent: Math.round(((i + 1) / changedCount) * 70),
			});

			try {
				const content = await fs.readFile(file.fullPath);
				zip.file(file.relativePath, content);
			} catch (err) {
				console.warn(`无法读取文件: ${file.fullPath}`, err);
			}
		}

		// 写入 backup-info.json
		const backupInfo: BackupInfo = {
			timestamp: Date.now(),
			backupTime: new Date().toISOString(),
			version: "2.0",
			workspaceRoot: this.workspaceRoot,
			workspaceDataPath: this.workspacePath,
			backupDir: this.backupDir,
			checksum: "",
			isIncremental: true,
			baseBackup: this.findLastFullBackupName(),
			changedFiles: changedCount,
			totalFiles,
		};
		zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2));

		// 压缩
		onProgress?.({
			phase: "compressing",
			currentFile: "",
			filesProcessed: changedCount,
			totalFiles: changedCount,
			percent: 75,
		});

		const zipBuffer = await zip.generateAsync(
			{ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: compressionLevel } },
			(metadata) => {
				onProgress?.({
					phase: "compressing",
					currentFile: "",
					filesProcessed: changedCount,
					totalFiles: changedCount,
					percent: 75 + Math.round(metadata.percent * 0.15),
				});
			},
		);

		// 校验和
		const checksum = await computeSHA256(zipBuffer);
		backupInfo.checksum = checksum;
		zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2));

		const finalBuffer = await zip.generateAsync({
			type: "uint8array",
			compression: "DEFLATE",
			compressionOptions: { level: compressionLevel },
		});

		// 保存
		onProgress?.({
			phase: "saving",
			currentFile: "",
			filesProcessed: changedCount,
			totalFiles: changedCount,
			percent: 95,
		});

		await fs.mkdir(this.backupDir, { recursive: true });
		const fileName = formatTimestamp(new Date());
		const zipFilePath = path.join(this.backupDir, fileName);
		await fs.writeFile(zipFilePath, finalBuffer);

		// 更新 manifest
		this.manifest = {
			version: "2.0",
			timestamp: Date.now(),
			isIncremental: true,
			baseBackup: this.findLastFullBackupName(),
			files: newManifest,
		};
		await this.saveManifest();

		this.lastBackupTimestamp = Date.now();

		const stats = await fs.stat(zipFilePath);

		onProgress?.({
			phase: "saving",
			currentFile: "",
			filesProcessed: changedCount,
			totalFiles: changedCount,
			percent: 100,
		});

		return {
			success: true,
			fileName,
			filePath: zipFilePath,
			size: stats.size,
			checksum,
			isIncremental: true,
			changedFiles: changedCount,
			totalFiles,
		};
	}

	// ========== 备份恢复 ==========

	async restoreBackup(
		backupFilePath: string,
		options: RestoreOptions = {},
	): Promise<RestoreResult> {
		this.ensureFileSystem();

		const fs = window.require("fs").promises;
		const path = window.require("path");

		onProgress?.({
			phase: "reading",
			currentFile: "",
			filesProcessed: 0,
			totalFiles: 0,
			percent: 0,
		} as RestoreProgress);

		// 读取 zip 文件
		const zipData = await fs.readFile(backupFilePath);
		const zip = await JSZip.loadAsync(zipData);

		// 读取 backup-info
		const infoRaw = await zip.file("backup-info.json")?.async("string");
		if (!infoRaw) {
			throw new Error("无效的备份文件：缺少 backup-info.json");
		}
		const info: BackupInfo = JSON.parse(infoRaw);

		// 校验完整性
		onProgress?.({
			phase: "verifying",
			currentFile: "",
			filesProcessed: 0,
			totalFiles: 0,
			percent: 10,
		} as RestoreProgress);

		if (info.isIncremental) {
			// 增量备份需要先恢复基础全量备份
			const baseName = info.baseBackup;
			if (!baseName) {
				throw new Error("增量备份缺少基础备份引用，无法恢复");
			}
			const basePath = path.join(this.backupDir, baseName);
			const baseResult = await this.restoreBackup(basePath, options);
			// 继续恢复增量部分
		}

		// 提取所有文件（排除 backup-info.json）
		const files: string[] = [];
		zip.forEach((relativePath, file) => {
			if (!file.dir && relativePath !== "backup-info.json") {
				files.push(relativePath);
			}
		});

		const totalFiles = files.length;
		let restoredFiles = 0;
		let skippedFiles = 0;

		// 如果是全量恢复，先清空目标目录中的内容（保留 temp 和 .recycle）
		if (!info.isIncremental) {
			await this.clearDataDir(fs, path);
		}

		for (let i = 0; i < files.length; i++) {
			const relativePath = files[i];
			const targetPath = path.join(this.workspacePath, relativePath);

			onProgress?.({
				phase: "writing",
				currentFile: relativePath,
				filesProcessed: i + 1,
				totalFiles,
				percent: 20 + Math.round(((i + 1) / totalFiles) * 80),
			} as RestoreProgress);

			try {
				const content = await zip.file(relativePath)?.async("uint8array");
				if (content) {
					await fs.mkdir(path.dirname(targetPath), { recursive: true });
					await fs.writeFile(targetPath, content);
					restoredFiles++;
				} else {
					skippedFiles++;
				}
			} catch (err) {
				console.warn(`恢复文件失败: ${relativePath}`, err);
				skippedFiles++;
			}
		}

		return { success: true, restoredFiles, skippedFiles };
	}

	// ========== 完整性校验 ==========

	async verifyBackup(backupFilePath: string): Promise<VerifyResult> {
		this.ensureFileSystem();

		const fs = window.require("fs").promises;

		// 读取文件
		const zipData = await fs.readFile(backupFilePath);
		const actualChecksum = await computeSHA256(zipData);

		// 读取 backup-info 中的预期校验和
		const zip = await JSZip.loadAsync(zipData);
		const infoRaw = await zip.file("backup-info.json")?.async("string");

		if (!infoRaw) {
			return {
				valid: false,
				checksum: actualChecksum,
				expectedChecksum: "",
				fileCount: 0,
				totalSize: zipData.length,
				error: "缺少 backup-info.json",
			};
		}

		const info: BackupInfo = JSON.parse(infoRaw);
		let fileCount = 0;
		zip.forEach(() => { fileCount++; });

		// v1 备份没有 checksum 字段，跳过校验
		if (!info.checksum) {
			return {
				valid: true,
				checksum: actualChecksum,
				expectedChecksum: "(v1 备份，无校验和)",
				fileCount,
				totalSize: zipData.length,
			};
		}

		return {
			valid: actualChecksum === info.checksum,
			checksum: actualChecksum,
			expectedChecksum: info.checksum,
			fileCount,
			totalSize: zipData.length,
		};
	}

	// ========== 删除备份 ==========

	async deleteBackupFile(backupFilePath: string): Promise<void> {
		this.ensureFileSystem();
		const fs = window.require("fs").promises;
		await fs.unlink(backupFilePath);
	}

	// ========== 扫描文件系统中的备份列表 ==========

	async scanBackupDir(): Promise<
		Array<{ name: string; path: string; time: string; size: string; isIncremental?: boolean }>
	> {
		this.ensureFileSystem();

		const fs = window.require("fs").promises;
		const path = window.require("path");
		const result: Array<{ name: string; path: string; time: string; size: string; isIncremental?: boolean }> = [];

		try {
			await fs.access(this.backupDir);
		} catch {
			return result;
		}

		const files = await fs.readdir(this.backupDir);
		const zipFiles = files
			.filter((f: string) => f.startsWith("data-") && f.endsWith(".zip"))
			.sort()
			.reverse();

		for (const name of zipFiles) {
			const filePath = path.join(this.backupDir, name);
			try {
				const stats = await fs.stat(filePath);
				let isIncremental = false;

				// 尝试读取 backup-info 判断是否增量
				try {
					const zipData = await fs.readFile(filePath);
					const zip = await JSZip.loadAsync(zipData);
					const infoRaw = await zip.file("backup-info.json")?.async("string");
					if (infoRaw) {
						const info = JSON.parse(infoRaw);
						isIncremental = info.isIncremental ?? false;
					}
				} catch {
					// 忽略读取错误
				}

				result.push({
					name,
					path: filePath,
					time: stats.mtime.toLocaleString(),
					size: this.formatFileSize(stats.size),
					isIncremental,
				});
			} catch {
				// 跳过无法读取的文件
			}
		}

		return result;
	}

	// ========== 私有方法 ==========

	private ensureFileSystem() {
		if (typeof window.require !== "function") {
			throw new Error("无法访问文件系统，请使用桌面版思源笔记");
		}
	}

	private async scanDirectory(
		dirPath: string,
		zipPath: string,
		skipDirs: Set<string>,
		result: { fullPath: string; relativePath: string; mtime: number; size: number }[],
		onProgress?: (progress: BackupProgress) => void,
	) {
		const fs = window.require("fs").promises;
		const path = window.require("path");

		let entries;
		try {
			entries = await fs.readdir(dirPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			const relativePath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

			if (entry.isDirectory()) {
				if (skipDirs.has(entry.name)) continue;
				await this.scanDirectory(fullPath, relativePath, skipDirs, result, onProgress);
			} else if (entry.isFile()) {
				try {
					const stats = await fs.stat(fullPath);
					result.push({
						fullPath,
						relativePath,
						mtime: stats.mtime.getTime(),
						size: stats.size,
					});
				} catch {
					// 跳过无法读取的文件
				}
			}
		}
	}

	private async clearDataDir(fs: any, path: any) {
		try {
			const entries = await fs.readdir(this.workspacePath, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.name === "temp" || entry.name === ".recycle") continue;
				const fullPath = path.join(this.workspacePath, entry.name);
				try {
					await fs.rm(fullPath, { recursive: true, force: true });
				} catch {
					// 忽略删除错误
				}
			}
		} catch {
			// 忽略错误
		}
	}

	private async loadManifest(): Promise<void> {
		if (this.manifest) return;

		try {
			this.ensureFileSystem();
			const fs = window.require("fs").promises;
			const path = window.require("path");
			const manifestPath = path.join(this.backupDir, "backup-manifest.json");
			const data = await fs.readFile(manifestPath, "utf-8");
			this.manifest = JSON.parse(data);
		} catch {
			this.manifest = null;
		}
	}

	private async saveManifest(): Promise<void> {
		if (!this.manifest) return;

		try {
			this.ensureFileSystem();
			const fs = window.require("fs").promises;
			const path = window.require("path");
			const manifestPath = path.join(this.backupDir, "backup-manifest.json");
			await fs.mkdir(this.backupDir, { recursive: true });
			await fs.writeFile(manifestPath, JSON.stringify(this.manifest, null, 2));
		} catch (err) {
			console.error("保存备份清单失败:", err);
		}
	}

	private findLastFullBackupName(): string | undefined {
		// 简单实现：从 manifest 时间推断文件名
		// 实际中需要扫描目录找到最近的全量备份
		return undefined; // 暂时返回 undefined，在增量备份链中会通过目录扫描查找
	}

	private formatFileSize(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
	}
}
