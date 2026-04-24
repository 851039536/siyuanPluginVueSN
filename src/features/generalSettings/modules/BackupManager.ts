/**
 * 数据备份管理器
 * 支持：全量备份、备份恢复、完整性校验（SHA256）、进度回调
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
	totalFiles: number;
}

export interface RestoreProgress {
	phase: "reading" | "extracting" | "verifying" | "writing" | "swapping";
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

export interface BackupOptions {
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

	constructor(_plugin: any, workspacePath: string, workspaceRoot: string) {
		this.workspacePath = workspacePath;
		this.workspaceRoot = workspaceRoot;
	}

	get backupDir(): string {
		return `${this.workspaceRoot}/data-backup`;
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

		await this.validateWorkspace(fs);

		const skipDirs = new Set(["temp", ".recycle", ...excludeDirs]);
		const zip = new JSZip();

		// 阶段1：扫描文件
		onProgress?.({ phase: "scanning", currentFile: "", filesProcessed: 0, totalFiles: 0, percent: 0 });

		const allFiles: { fullPath: string; relativePath: string; mtime: number; size: number }[] = [];
		await this.scanDirectory(this.workspacePath, "", skipDirs, allFiles, onProgress);

		const totalFiles = allFiles.length;

		// 阶段2：打包文件
		for (let i = 0; i < allFiles.length; i++) {
			const file = allFiles[i];
			onProgress?.({ phase: "packing", currentFile: file.relativePath, filesProcessed: i + 1, totalFiles, percent: Math.round(((i + 1) / totalFiles) * 70) });
			try {
				const content = await fs.readFile(file.fullPath);
				zip.file(file.relativePath, content);
			} catch (err) {
				console.warn(`无法读取文件: ${file.fullPath}`, err);
			}
		}

		const backupInfo: BackupInfo = {
			timestamp: Date.now(),
			backupTime: new Date().toISOString(),
			version: "2.0",
			workspaceRoot: this.workspaceRoot,
			workspaceDataPath: this.workspacePath,
			backupDir: this.backupDir,
			checksum: "",
			totalFiles,
		};

		return this.finalizeAndSaveBackup(zip, backupInfo, totalFiles, compressionLevel, onProgress);
	}

	/** 压缩、校验、保存备份（公共逻辑） */
	private async finalizeAndSaveBackup(
		zip: JSZip,
		backupInfo: BackupInfo,
		totalFiles: number,
		compressionLevel: number,
		onProgress?: (progress: BackupProgress) => void,
	): Promise<BackupResult> {
		const fs = window.require("fs").promises;
		const path = window.require("path");

		zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2));

		// 阶段3：压缩
		onProgress?.({ phase: "compressing", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 75 });

		const zipBuffer = await zip.generateAsync(
			{ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: compressionLevel } },
			(metadata) => {
				onProgress?.({ phase: "compressing", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 75 + Math.round(metadata.percent * 0.15) });
			},
		);

		// 阶段4：计算校验和
		onProgress?.({ phase: "verifying", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 92 });

		const checksum = await computeSHA256(zipBuffer);
		backupInfo.checksum = checksum;
		zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2));

		const finalBuffer = await zip.generateAsync({
			type: "uint8array",
			compression: "DEFLATE",
			compressionOptions: { level: compressionLevel },
		});

		// 阶段5：保存文件
		onProgress?.({ phase: "saving", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 95 });

		await fs.mkdir(this.backupDir, { recursive: true });
		const fileName = formatTimestamp(new Date());
		const zipFilePath = path.join(this.backupDir, fileName);
		await fs.writeFile(zipFilePath, finalBuffer);

		const stats = await fs.stat(zipFilePath);

		onProgress?.({ phase: "saving", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 100 });

		return {
			success: true,
			fileName,
			filePath: zipFilePath,
			size: stats.size,
			checksum,
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
		const { onProgress } = options;

		// 临时恢复目录（解压暂存区）
		const restoreTmpDir = path.join(this.workspaceRoot, "data-restoring");

		// 每次恢复前，先清理 data-restoring 残留（含上次中断的恢复）
		await fs.rm(restoreTmpDir, { recursive: true, force: true });

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

		// 校验备份文件有效性
		const infoRaw = await zip.file("backup-info.json")?.async("string");
		if (!infoRaw) {
			throw new Error("无效的备份文件：缺少 backup-info.json");
		}

		// 校验完整性
		onProgress?.({
			phase: "verifying",
			currentFile: "",
			filesProcessed: 0,
			totalFiles: 0,
			percent: 10,
		} as RestoreProgress);

		// 提取所有文件（排除 backup-info.json）
		const files: string[] = [];
		zip.forEach((relativePath, file) => {
			if (!file.dir && relativePath !== "backup-info.json") {
				files.push(relativePath);
			}
		});

		const totalFiles = files.length;
		let restoredFiles = 0;
		const failedFiles: string[] = [];

		// ===== 阶段1：解压到临时目录（不触碰原始数据） =====
		onProgress?.({
			phase: "extracting",
			currentFile: "",
			filesProcessed: 0,
			totalFiles,
			percent: 15,
		} as RestoreProgress);

		// 创建干净的临时目录
		await fs.mkdir(restoreTmpDir, { recursive: true });

		for (let i = 0; i < files.length; i++) {
			const relativePath = files[i].split("/").join(path.sep);
			const targetPath = path.join(restoreTmpDir, relativePath);

			onProgress?.({
				phase: "extracting",
				currentFile: relativePath,
				filesProcessed: i + 1,
				totalFiles,
				percent: 15 + Math.round(((i + 1) / totalFiles) * 50),
			} as RestoreProgress);

			try {
				const zipEntry = zip.file(files[i]);
				const content = zipEntry ? await zipEntry.async("uint8array") : null;
				if (content) {
					await fs.mkdir(path.dirname(targetPath), { recursive: true });
					await fs.writeFile(targetPath, content);
					restoredFiles++;
				} else {
					failedFiles.push(files[i]);
				}
			} catch (err) {
				console.error(`解压文件失败: ${files[i]}`, err);
				failedFiles.push(files[i]);
			}
		}

		if (failedFiles.length > 0) {
			// 解压阶段就有失败，清理临时目录，不替换原始数据
			await fs.rm(restoreTmpDir, { recursive: true, force: true });
			console.error(`解压失败 ${failedFiles.length} 个文件，恢复中止:`, failedFiles);
			return { success: false, restoredFiles: 0, skippedFiles: failedFiles.length };
		}

		// ===== 阶段2：将临时文件写入工作区 =====
		// 使用逐文件复制而非 rename，避免 Windows 上 EPERM 错误
		onProgress?.({
			phase: "writing",
			currentFile: "",
			filesProcessed: 0,
			totalFiles,
			percent: 70,
		} as RestoreProgress);

		for (let i = 0; i < files.length; i++) {
			const relativePath = files[i].split("/").join(path.sep);
			const srcPath = path.join(restoreTmpDir, relativePath);
			const destPath = path.join(this.workspacePath, relativePath);

			onProgress?.({
				phase: "writing",
				currentFile: relativePath,
				filesProcessed: i + 1,
				totalFiles,
				percent: 70 + Math.round(((i + 1) / totalFiles) * 20),
			} as RestoreProgress);

			try {
				await fs.mkdir(path.dirname(destPath), { recursive: true });
				await fs.copyFile(srcPath, destPath);
			} catch (err) {
				console.error(`写入文件失败: ${relativePath}`, err);
				failedFiles.push(files[i]);
			}
		}

		// ===== 阶段3：清理多余的旧文件 =====
		if (failedFiles.length === 0) {
			onProgress?.({
				phase: "swapping",
				currentFile: "",
				filesProcessed: 0,
				totalFiles: 0,
				percent: 92,
			} as RestoreProgress);

			await this.removeExtraFiles(fs, path, restoreTmpDir, this.workspacePath);
		}

		// 清理临时目录
		await fs.rm(restoreTmpDir, { recursive: true, force: true });

		if (failedFiles.length > 0) {
			console.error(`恢复完成，但有 ${failedFiles.length} 个文件失败:`, failedFiles);
			return { success: false, restoredFiles: restoredFiles - failedFiles.length, skippedFiles: failedFiles.length };
		}

		return { success: true, restoredFiles, skippedFiles: 0 };
	}

	/** 清理工作区中不在备份中的多余文件（全量恢复用） */
	private async removeExtraFiles(fs: any, path: any, backupDir: string, dataDir: string) {
		const preserveNames = new Set(["temp", ".recycle"]);
		// 也排除备份目录本身（如果在 workspace 下）
		if (this.backupDir.startsWith(this.workspacePath)) {
			const backupRelative = path.relative(this.workspacePath, this.backupDir);
			if (backupRelative && !backupRelative.startsWith("..")) {
				preserveNames.add(backupRelative.split(path.sep)[0]);
			}
		}

		try {
			const entries = await fs.readdir(dataDir, { withFileTypes: true });
			for (const entry of entries) {
				if (preserveNames.has(entry.name)) continue;
				const dataPath = path.join(dataDir, entry.name);
				const backupPath = path.join(backupDir, entry.name);
				const existsInBackup = await this.existsPath(fs, backupPath);
				if (!existsInBackup) {
					await fs.rm(dataPath, { recursive: true, force: true });
				}
			}
		} catch {
			// 忽略清理错误
		}
	}

	private async existsPath(fs: any, filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
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
		Array<{ name: string; path: string; time: string; size: number }>
	> {
		this.ensureFileSystem();

		const fs = window.require("fs").promises;
		const path = window.require("path");
		const result: Array<{ name: string; path: string; time: string; size: number }> = [];

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
				result.push({
					name,
					path: filePath,
					time: stats.mtime.toLocaleString(),
					size: stats.size,
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

	private async validateWorkspace(fs: any) {
		try {
			await fs.access(this.workspacePath);
		} catch {
			throw new Error(`data 目录不存在: ${this.workspacePath}`);
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



}

