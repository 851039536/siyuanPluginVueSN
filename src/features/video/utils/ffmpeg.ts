/**
 * FFmpeg 视频处理模块
 * 支持视频合并、视频音频合并、视频压缩
 */

import {
	getWorkspacePath,
	escapeFilePathForCmd,
	formatFileSize,
	calculateCompressionRate,
} from "./utils";

// 重新导出供外部使用
export { formatFileSize, calculateCompressionRate };

/**
 * FFmpeg 处理结果
 */
export interface FFmpegResult {
	success: boolean;
	outputPath?: string;
	error?: string;
	progress?: number;
}

/**
 * 视频合并参数
 */
export interface MergeVideosParams {
	videoPaths: string[];
	outputPath: string;
	onProgress?: (progress: number) => void;
}

/**
 * 视频音频合并参数
 */
export interface MergeVideoAudioParams {
	videoPath: string;
	audioPath: string;
	outputPath: string;
	onProgress?: (progress: number) => void;
}

/**
 * 视频压缩参数
 */
export interface CompressVideoParams {
	inputPath: string;
	outputPath: string;
	bitrate?: string; // 比特率，如 '1000k'
	crf?: number; // CRF 值，越小质量越好，通常 18-28
	onProgress?: (progress: number) => void;
}

/**
 * 检查 FFmpeg 是否可用
 * 注意：浏览器环境无法直接使用 FFmpeg，需要通过 Electron 或外部进程
 */
export function isFFmpegAvailable(): boolean {
	// 检查是否在 Electron 环境中
	if (typeof window !== "undefined" && (window as any).require) {
		try {
			const { exec } = (window as any).require("child_process");
			// 尝试检查 ffmpeg 命令
			exec("ffmpeg -version", (_error: any) => {
				// 如果没有错误，说明 ffmpeg 可用
				// 如果有错误，可能是命令不存在
			});
			return true;
		} catch (e) {
			return false;
		}
	}
	return false;
}

/**
 * 获取 FFmpeg 可执行文件路径
 * 支持多种安装方式
 */
function getFFmpegPath(): string {
	const fs = (window as any).require("fs");

	// 1. 从 localStorage 读取用户自定义路径（最高优先级）
	const customPath = localStorage.getItem("siyuan-ffmpeg-path");
	if (customPath) {
		try {
			if (fs.existsSync(customPath)) {
				return customPath;
			}
		} catch (e) {
			// 继续尝试其他路径
		}
	}

	// 2. Windows 常见路径
	const platform = (window as any).require("os").platform();
	if (platform === "win32") {
		const windowsPaths = [
			"ffmpeg.exe",
			"C:\\ffmpeg\\bin\\ffmpeg.exe",
			"C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
			"C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
			"D:\\ffmpeg\\bin\\ffmpeg.exe",
			"E:\\ffmpeg\\bin\\ffmpeg.exe",
			"E:\\Program\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe",
			"E:\\Program\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg",
		];

		for (const path of windowsPaths) {
			try {
				if (fs.existsSync(path)) {
					return path;
				}
			} catch (e) {
				// 继续尝试下一个路径
			}
		}
	}

	// 3. macOS/Linux 常见路径
	const unixPaths = [
		"ffmpeg",
		"/usr/local/bin/ffmpeg",
		"/usr/bin/ffmpeg",
		"/opt/homebrew/bin/ffmpeg",
	];

	for (const path of unixPaths) {
		try {
			if (fs.existsSync(path)) {
				return path;
			}
		} catch (e) {
			// 继续尝试下一个路径
		}
	}

	// 4. 如果都没找到，返回默认命令（依赖 PATH）
	return "ffmpeg";
}

/**
 * 设置自定义 FFmpeg 路径
 */
export function setFFmpegPath(path: string): boolean {
	try {
		const fs = (window as any).require("fs");
		if (fs.existsSync(path)) {
			localStorage.setItem("siyuan-ffmpeg-path", path);
			return true;
		}
		return false;
	} catch (e) {
		return false;
	}
}

/**
 * 获取当前 FFmpeg 路径（用于显示）
 */
export function getCurrentFFmpegPath(): string {
	return getFFmpegPath();
}

/**
 * 清除自定义 FFmpeg 路径
 */
export function clearFFmpegPath(): void {
	localStorage.removeItem("siyuan-ffmpeg-path");
}

/**
 * 将相对路径转换为绝对路径
 * @param relativePath 相对路径（如 data/video/test.mp4）
 * @returns 绝对路径
 */
async function resolveAbsolutePath(relativePath: string): Promise<string> {
	// 如果已经是绝对路径，直接返回
	if (relativePath.includes(":") || relativePath.startsWith("/")) {
		return relativePath;
	}

	// 获取工作区路径
	const workspacePath = await getWorkspacePath();
	if (!workspacePath) {
		throw new Error("无法获取工作区路径");
	}

	// 构建绝对路径
	const path = (window as any).require("path");
	return path.resolve(workspacePath, relativePath);
}

/**
 * 合并多个视频文件
 * 使用 FFmpeg 的 concat 滤镜
 */
export async function mergeVideos(
	params: MergeVideosParams,
): Promise<FFmpegResult> {
	const { videoPaths, outputPath, onProgress } = params;

	if (!isFFmpegAvailable()) {
		return {
			success: false,
			error: "FFmpeg 未安装或不可用。请确保系统已安装 FFmpeg 并添加到 PATH。",
		};
	}

	try {
		const { exec } = (window as any).require("child_process");
		const { promisify } = (window as any).require("util");
		const execAsync = promisify(exec);

		// 获取 FFmpeg 路径
		const ffmpegPath = getFFmpegPath();

		// 将相对路径转换为绝对路径
		const absoluteVideoPaths = await Promise.all(
			videoPaths.map((path) => resolveAbsolutePath(path)),
		);

		// 创建临时文件列表
		const tempDir = (window as any).require("os").tmpdir();
		const path = (window as any).require("path");
		const listPath = path.join(tempDir, `video_list_${Date.now()}.txt`);

		// 写入文件列表 - 对于 concat demuxer，使用绝对路径
		const fs = (window as any).require("fs");
		const listContent = absoluteVideoPaths
			.map((absolutePath) => {
				// 转义单引号并用单引号包裹路径
				return `file '${absolutePath.replace(/'/g, "'\\''")}'`;
			})
			.join("\n");
		fs.writeFileSync(listPath, listContent, "utf8");

		// 构建 FFmpeg 命令 - 使用转义后的路径
		const escapedOutputPath = escapeFilePathForCmd(outputPath);
		const escapedListPath = escapeFilePathForCmd(listPath);
		const cmd = `${ffmpegPath} -f concat -safe 0 -i ${escapedListPath} -c copy ${escapedOutputPath} -y`;

		// 执行命令
		onProgress?.(10);
		await execAsync(cmd, {
			encoding: "utf8",
			maxBuffer: 1024 * 1024 * 10, // 10MB
		});
		onProgress?.(100);

		// 清理临时文件
		fs.unlinkSync(listPath);

		return {
			success: true,
			outputPath,
		};
	} catch (error: any) {
		console.error("视频合并失败:", error);
		return {
			success: false,
			error: error.message || "视频合并失败",
		};
	}
}

/**
 * 合并视频和音频文件
 */
export async function mergeVideoAudio(
	params: MergeVideoAudioParams,
): Promise<FFmpegResult> {
	const { videoPath, audioPath, outputPath, onProgress } = params;

	if (!isFFmpegAvailable()) {
		return {
			success: false,
			error: "FFmpeg 未安装或不可用。请确保系统已安装 FFmpeg 并添加到 PATH。",
		};
	}

	try {
		const { exec } = (window as any).require("child_process");
		const { promisify } = (window as any).require("util");
		const execAsync = promisify(exec);

		// 获取 FFmpeg 路径
		const ffmpegPath = getFFmpegPath();

		// 将相对路径转换为绝对路径
		const absoluteVideoPath = await resolveAbsolutePath(videoPath);
		const absoluteAudioPath = await resolveAbsolutePath(audioPath);

		// 构建 FFmpeg 命令
		// -i video: 输入视频
		// -i audio: 输入音频
		// -c:v copy: 复制视频流（不重新编码）
		// -c:a aac: 音频编码为 AAC
		// -shortest: 以较短的流结束
		const escapedVideoPath = escapeFilePathForCmd(absoluteVideoPath);
		const escapedAudioPath = escapeFilePathForCmd(absoluteAudioPath);
		const escapedOutputPath = escapeFilePathForCmd(outputPath);
		const cmd = `${ffmpegPath} -i ${escapedVideoPath} -i ${escapedAudioPath} -c:v copy -c:a aac -shortest ${escapedOutputPath} -y`;

		onProgress?.(10);
		await execAsync(cmd, {
			// Windows 下需要设置 encoding 为 utf8 以正确处理中文
			encoding: "utf8",
			// 设置最大缓冲区
			maxBuffer: 1024 * 1024 * 10, // 10MB
		});
		onProgress?.(100);

		return {
			success: true,
			outputPath,
		};
	} catch (error: any) {
		console.error("视频音频合并失败:", error);
		return {
			success: false,
			error: error.message || "视频音频合并失败",
		};
	}
}

/**
 * 压缩视频文件
 */
export async function compressVideo(
	params: CompressVideoParams,
): Promise<FFmpegResult> {
	const { inputPath, outputPath, bitrate, crf, onProgress } = params;

	if (!isFFmpegAvailable()) {
		return {
			success: false,
			error: "FFmpeg 未安装或不可用。请确保系统已安装 FFmpeg 并添加到 PATH。",
		};
	}

	try {
		const { exec } = (window as any).require("child_process");
		const { promisify } = (window as any).require("util");
		const execAsync = promisify(exec);

		// 获取 FFmpeg 路径
		const ffmpegPath = getFFmpegPath();

		// 将相对路径转换为绝对路径
		const absoluteInputPath = await resolveAbsolutePath(inputPath);

		// 构建 FFmpeg 命令
		let cmd = `${ffmpegPath}`;

		// 输入文件
		cmd += ` -i ${escapeFilePathForCmd(absoluteInputPath)}`;

		// 视频编码设置
		// 使用 libx264 编码器
		cmd += " -c:v libx264";

		// CRF 设置（质量控制）
		if (crf !== undefined) {
			cmd += ` -crf ${crf}`;
		} else {
			cmd += " -crf 23"; // 默认 CRF 值
		}

		// 比特率设置
		if (bitrate) {
			cmd += ` -b:v ${bitrate}`;
		}

		// 音频编码
		cmd += " -c:a aac";
		cmd += " -b:a 128k";

		// 预设（速度 vs 压缩率）
		cmd += " -preset medium";

		// 输出文件
		cmd += ` ${escapeFilePathForCmd(outputPath)} -y`;

		onProgress?.(10);
		await execAsync(cmd, {
			encoding: "utf8",
			maxBuffer: 1024 * 1024 * 10, // 10MB
		});
		onProgress?.(100);

		return {
			success: true,
			outputPath,
		};
	} catch (error: any) {
		console.error("视频压缩失败:", error);
		return {
			success: false,
			error: error.message || "视频压缩失败",
		};
	}
}

/**
 * 获取视频信息
 */
export async function getVideoInfo(videoPath: string): Promise<{
	duration: number;
	width: number;
	height: number;
	size: number;
} | null> {
	if (!isFFmpegAvailable()) {
		return null;
	}

	try {
		const { exec } = (window as any).require("child_process");
		const { promisify } = (window as any).require("util");
		const execAsync = promisify(exec);

		const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=noprint_wrappers=1:nokey=0 ${escapeFilePathForCmd(videoPath)}`;

		const { stdout } = await execAsync(cmd);

		// 解析输出
		const lines = stdout.split("\n");
		const info: Record<string, number> = {};

		lines.forEach((line: string) => {
			const [key, value] = line.split("=");
			if (key && value) {
				info[key] = parseFloat(value);
			}
		});

		// 获取文件大小
		const fs = (window as any).require("fs");
		const stats = fs.statSync(videoPath);

		return {
			duration: info.duration || 0,
			width: info.width || 0,
			height: info.height || 0,
			size: stats.size,
		};
	} catch (error) {
		console.error("获取视频信息失败:", error);
		return null;
	}
}

/**
 * 检查文件是否存在
 */
export function checkFileExists(filePath: string): boolean {
	try {
		const fs = (window as any).require("fs");
		return fs.existsSync(filePath);
	} catch (error) {
		return false;
	}
}

/**
 * 构建完整路径（相对于工作区）
 */
export async function buildVideoPath(fileName: string): Promise<string> {
	const workspacePath = await getWorkspacePath();
	if (!workspacePath) {
		throw new Error("无法获取工作区路径");
	}
	return `${workspacePath}/data/video/${fileName}`;
}
