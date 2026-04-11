import type { WebDAVFile } from "../types";

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "-";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getFileIcon(file: WebDAVFile): string {
	if (file.isDirectory) return "📁";
	const ext = file.name.split(".").pop()?.toLowerCase();
	const iconMap: Record<string, string> = {
		md: "📝",
		txt: "📄",
		pdf: "📕",
		doc: "📘",
		docx: "📘",
		xls: "📗",
		xlsx: "📗",
		ppt: "📙",
		pptx: "📙",
		jpg: "🖼️",
		jpeg: "🖼️",
		png: "🖼️",
		gif: "🖼️",
		svg: "🖼️",
		mp3: "🎵",
		wav: "🎵",
		mp4: "🎬",
		avi: "🎬",
		mov: "🎬",
		zip: "📦",
		rar: "📦",
		"7z": "📦",
		js: "📜",
		ts: "📜",
		json: "📜",
		html: "🌐",
		css: "🎨",
		vue: "💚",
		py: "🐍",
	};
	return iconMap[ext || ""] || "📄";
}

export function formatTime(timeStr: string): string {
	if (!timeStr) return "";
	try {
		const date = new Date(timeStr);
		return date.toLocaleString();
	} catch {
		return timeStr;
	}
}
