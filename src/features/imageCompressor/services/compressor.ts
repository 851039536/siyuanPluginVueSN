import imageCompression from "browser-image-compression";
import { putFile, getFile } from "@/api";
import type { ImageInfo, CompressOptions, CompressResult } from "../types";

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
	maxSizeMB: 1,
	maxWidthOrHeight: 1920,
	quality: 0.8,
	useWebWorker: true,
	fileType: undefined,
};

export async function compressImage(
	imageInfo: ImageInfo,
	options: CompressOptions = DEFAULT_COMPRESS_OPTIONS,
): Promise<CompressResult> {
	const startTime = Date.now();

	try {
		const fileData = await getFile(imageInfo.path);

		if (!fileData || !(fileData instanceof Blob)) {
			return {
				success: false,
				originalFile: imageInfo,
				error: "无法获取文件数据",
			};
		}

		const file = new File([fileData], imageInfo.name, {
			type: imageInfo.type,
			lastModified: imageInfo.lastModified,
		});

		const compressOptions = {
			...DEFAULT_COMPRESS_OPTIONS,
			...options,
		};

		const compressedBlob = await imageCompression(file, compressOptions);

		const originalSize = file.size;
		const compressedSize = compressedBlob.size;
		const compressionRatio = (1 - compressedSize / originalSize) * 100;

		const timeTaken = Date.now() - startTime;

		return {
			success: true,
			originalFile: imageInfo,
			compressedBlob,
			compressedSize,
			compressionRatio: Number(compressionRatio.toFixed(2)),
			timeTaken,
		};
	} catch (error) {
		console.error(`压缩图片失败 ${imageInfo.path}:`, error);
		return {
			success: false,
			originalFile: imageInfo,
			error: error instanceof Error ? error.message : "未知错误",
		};
	}
}

export async function batchCompressImages(
	images: ImageInfo[],
	options: CompressOptions = DEFAULT_COMPRESS_OPTIONS,
	onProgress?: (current: number, total: number, currentImage: string) => void,
): Promise<CompressResult[]> {
	const results: CompressResult[] = [];
	const total = images.length;

	for (let i = 0; i < images.length; i++) {
		const image = images[i];

		if (onProgress) {
			onProgress(i + 1, total, image.name);
		}

		const result = await compressImage(image, options);
		results.push(result);
	}

	return results;
}

export async function replaceImage(
	imagePath: string,
	compressedBlob: Blob,
): Promise<boolean> {
	try {
		await putFile(imagePath, false, compressedBlob);
		return true;
	} catch (error) {
		console.error(`替换图片失败 ${imagePath}:`, error);
		return false;
	}
}

export async function batchReplaceImages(
	results: CompressResult[],
	onProgress?: (current: number, total: number) => void,
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;
	const total = results.length;

	for (let i = 0; i < results.length; i++) {
		const result = results[i];

		if (onProgress) {
			onProgress(i + 1, total);
		}

		if (result.success && result.compressedBlob) {
			const replaced = await replaceImage(
				result.originalFile.path,
				result.compressedBlob,
			);

			if (replaced) {
				success++;
			} else {
				failed++;
			}
		} else {
			failed++;
		}
	}

	return { success, failed };
}

export async function backupImage(imagePath: string): Promise<boolean> {
	try {
		const fileData = await getFile(imagePath);

		if (!fileData || !(fileData instanceof Blob)) {
			return false;
		}

		const backupPath = imagePath.replace(/(\.[^.]+)$/, ".backup$1");

		await putFile(backupPath, false, fileData);
		return true;
	} catch (error) {
		console.error(`备份图片失败 ${imagePath}:`, error);
		return false;
	}
}

export function getCompressStats(results: CompressResult[]) {
	const stats = {
		total: results.length,
		success: 0,
		failed: 0,
		totalOriginalSize: 0,
		totalCompressedSize: 0,
		totalSaved: 0,
		averageRatio: 0,
	};

	results.forEach((result) => {
		if (result.success && result.compressedSize) {
			stats.success++;
			stats.totalOriginalSize += result.originalFile.size;
			stats.totalCompressedSize += result.compressedSize;
		} else {
			stats.failed++;
		}
	});

	stats.totalSaved = stats.totalOriginalSize - stats.totalCompressedSize;
	stats.averageRatio =
		stats.totalOriginalSize > 0
			? (1 - stats.totalCompressedSize / stats.totalOriginalSize) * 100
			: 0;

	return {
		...stats,
		averageRatio: Number(stats.averageRatio.toFixed(2)),
		totalOriginalSizeMB: (stats.totalOriginalSize / 1024 / 1024).toFixed(2),
		totalCompressedSizeMB: (stats.totalCompressedSize / 1024 / 1024).toFixed(2),
		totalSavedMB: (stats.totalSaved / 1024 / 1024).toFixed(2),
	};
}
