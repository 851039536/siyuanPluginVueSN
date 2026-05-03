/**
 * 数据备份管理器
 * 支持：全量备份、备份恢复、进度回调
 */
import JSZip from "jszip";

// ========== 类型定义 ==========

export interface BackupProgress {
  phase: "scanning" | "packing" | "compressing" | "saving";
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
  totalFiles: number;
}

export interface RestoreProgress {
  phase: "reading" | "extracting" | "compressing" | "swapping";
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  percent: number;
}

export interface RestoreResult {
  success: boolean;
  restoredFiles: number;
  skippedFiles: number;
  needRestart: boolean;
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

// ========== BackupManager ==========

export class BackupManager {
  private workspacePath: string;
  private workspaceRoot: string;

  constructor(workspacePath: string, workspaceRoot: string) {
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
      totalFiles,
    };

    return this.finalizeAndSaveBackup(zip, backupInfo, totalFiles, compressionLevel, onProgress);
  }

  /** 压缩、保存备份（公共逻辑） */
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
        onProgress?.({ phase: "compressing", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 75 + Math.round(metadata.percent * 0.2) });
      },
    );

    // 阶段4：保存文件
    onProgress?.({ phase: "saving", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 95 });

    await fs.mkdir(this.backupDir, { recursive: true });
    const fileName = formatTimestamp(new Date());
    const zipFilePath = path.join(this.backupDir, fileName);
    await fs.writeFile(zipFilePath, zipBuffer);

    const stats = await fs.stat(zipFilePath);

    onProgress?.({ phase: "saving", currentFile: "", filesProcessed: totalFiles, totalFiles, percent: 100 });

    return {
      success: true,
      fileName,
      filePath: zipFilePath,
      size: stats.size,
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
    const { onProgress } = options;

    onProgress?.({
      phase: "reading",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    });

    // 读取备份 zip 文件
    const zipData = await fs.readFile(backupFilePath);

    const zip = await JSZip.loadAsync(zipData);
    const infoRaw = await zip.file("backup-info.json")?.async("string");
    if (!infoRaw) {
      throw new Error("无效的备份文件：缺少 backup-info.json");
    }

    // 统计文件数
    let totalFiles = 0;
    zip.forEach((relativePath, file) => {
      if (!file.dir && relativePath !== "backup-info.json") {
        totalFiles++;
      }
    });

    // ===== 通过思源 /api/import/importData API 恢复 =====
    onProgress?.({
      phase: "extracting",
      currentFile: "",
      filesProcessed: 0,
      totalFiles,
      percent: 20,
    });

    // 重新打包：去掉 backup-info.json，将文件放入 data/ 目录下
    // 思源 importData API 要求：解压后顶层恰好 1 个目录（data/），且无 */*.sy 文件
    const cleanZip = new JSZip();
    const dataFolder = cleanZip.folder("data");
    const fileEntries: { path: string; entry: JSZip.JSZipObject }[] = [];
    zip.forEach((relativePath, file) => {
      if (!file.dir && relativePath !== "backup-info.json") {
        fileEntries.push({ path: relativePath, entry: file });
      }
    });

    let processed = 0;
    for (const { path: filePath, entry } of fileEntries) {
      const content = await entry.async("uint8array");
      dataFolder.file(filePath, content);
      processed++;
      if (processed % 50 === 0 || processed === fileEntries.length) {
        onProgress?.({
          phase: "extracting",
          currentFile: filePath,
          filesProcessed: processed,
          totalFiles,
          percent: 20 + Math.round((processed / totalFiles) * 30),
        });
      }
    }

    const cleanZipBuffer = await cleanZip.generateAsync(
      { type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } },
      (metadata) => {
        onProgress?.({
          phase: "compressing",
          currentFile: "",
          filesProcessed: totalFiles,
          totalFiles,
          percent: 50 + Math.round(metadata.percent * 0.2),
        });
      },
    );

    // 调用思源 API 恢复数据
    onProgress?.({
      phase: "swapping",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 70,
    });

    const formData = new FormData();
    const blob = new Blob([cleanZipBuffer], { type: "application/zip" });
    formData.append("file", blob, "data.zip");

    const response = await fetch("/api/import/importData", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(result.msg || "导入数据失败");
    }

    // 清理残留的 data-restoring 临时目录（兼容旧版本恢复残留）
    try {
      const path = window.require("path");
      const restoreTmpDir = path.join(this.workspaceRoot, "data-restoring");
      await fs.rm(restoreTmpDir, { recursive: true, force: true });
      // 清理旧版 Python 脚本残留
      const scriptPath = path.join(this.workspaceRoot, "restore-backup.py");
      await fs.unlink(scriptPath).catch(() => {});
    } catch {
      // 清理失败不影响恢复结果
    }

    onProgress?.({
      phase: "swapping",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 100,
    });

    return {
      success: true,
      restoredFiles: totalFiles,
      skippedFiles: 0,
      needRestart: true,
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


