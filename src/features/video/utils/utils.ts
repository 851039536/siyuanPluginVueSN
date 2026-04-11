/**
 * 视频模块共享工具函数
 */

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
export function formatFileSize(bytes?: number): string {
	if (!bytes || bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 计算压缩率
 * @param originalSize 原始大小
 * @param compressedSize 压缩后大小
 * @returns 压缩率字符串，如 "45.5%"
 */
export function calculateCompressionRate(
	originalSize: number,
	compressedSize: number,
): string {
	if (originalSize === 0) return "0%";
	const rate = ((originalSize - compressedSize) / originalSize) * 100;
	return rate.toFixed(1) + "%";
}

/**
 * 获取工作区路径
 * @returns 工作区路径
 */
export async function getWorkspacePath(): Promise<string> {
	try {
		const response = await fetch("/api/system/getConf", {
			method: "POST",
		});

		if (response.ok) {
			const data = await response.json();
			return data?.data?.conf?.system?.workspaceDir || "";
		}
	} catch (error) {
		console.error("获取工作区路径失败:", error);
	}
	return "";
}

/**
 * 转义文件路径中的特殊字符，用于命令行参数
 * Windows: 转义双引号和反斜杠，处理中文路径
 * Unix: 转义单引号
 * @param filePath 文件路径
 * @returns 转义后的路径
 */
export function escapeFilePathForCmd(filePath: string): string {
	// 检测是否在 Electron 环境中
	if (typeof window !== "undefined" && (window as any).require) {
		const platform = (window as any).require("os").platform();

		if (platform === "win32") {
			// Windows: 使用双引号包裹，转义内部双引号
			return `"${filePath.replace(/"/g, '\\"')}"`;
		} else {
			// Unix/Linux/macOS: 使用单引号包裹，转义单引号
			return `'${filePath.replace(/'/g, "'\\''")}'`;
		}
	}
	// 非 Electron 环境，返回原路径
	return filePath;
}
