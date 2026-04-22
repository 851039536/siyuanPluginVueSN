/**
 * Skills 查看器管理器
 * 扫描并读取 AI 编程工具的 Skills 配置文件
 * 兼容 Claude, CodeBuddy, Qoder, Trae
 */

export interface SkillInfo {
	name: string;
	description: string;
	content: string;
	filePath: string;
	tool: AIToolType;
}

export type AIToolType = "claude" | "codebuddy" | "qoder" | "trae";

export interface AIToolConfig {
	id: AIToolType;
	name: string;
	icon: string;
	color: string;
	skillPaths: string[]; // 相对于 home 目录的路径
	projectPaths: string[]; // 相对于项目目录的路径
}

export const AI_TOOLS: AIToolConfig[] = [
	{
		id: "claude",
		name: "Claude",
		icon: "🟠",
		color: "#D97757",
		skillPaths: [".claude/skills"],
		projectPaths: [".claude/skills"],
	},
	{
		id: "codebuddy",
		name: "CodeBuddy",
		icon: "🔵",
		color: "#4A90D9",
		skillPaths: [".codebuddy/skills"],
		projectPaths: [".codebuddy/skills"],
	},
	{
		id: "qoder",
		name: "Qoder",
		icon: "🟣",
		color: "#9B59B6",
		skillPaths: [".qoder/skills"],
		projectPaths: [".qoder/skills"],
	},
	{
		id: "trae",
		name: "Trae",
		icon: "🟢",
		color: "#27AE60",
		skillPaths: [".trae/skills"],
		projectPaths: [".trae/skills"],
	},
];

export class SkillsViewerManager {
	private fs: any = null;
	private path: any = null;
	private homeDir = "";
	private available = false;

	constructor() {
		this.initFS();
	}

	private initFS() {
		try {
			if (typeof window.require === "function") {
				this.fs = window.require("fs");
				this.path = window.require("path");
				// 获取 home 目录
				const os = window.require("os");
				this.homeDir = os.homedir();
				this.available = true;
			}
		} catch {
			this.available = false;
		}
	}

	isAvailable(): boolean {
		return this.available;
	}

	/**
	 * 获取 home 目录
	 */
	getHomeDir(): string {
		return this.homeDir;
	}

	/**
	 * 扫描指定工具的所有 Skills
	 */
	async scanToolSkills(tool: AIToolConfig, projectPath?: string): Promise<SkillInfo[]> {
		if (!this.available) return [];

		const skills: SkillInfo[] = [];

		// 扫描全局路径
		for (const relPath of tool.skillPaths) {
			const fullPath = this.path.join(this.homeDir, relPath);
			const found = await this.scanSkillDirectory(fullPath, tool.id);
			skills.push(...found);
		}

		// 扫描项目路径
		if (projectPath) {
			for (const relPath of tool.projectPaths) {
				const fullPath = this.path.join(projectPath, relPath);
				const found = await this.scanSkillDirectory(fullPath, tool.id);
				skills.push(...found);
			}
		}

		return skills;
	}

	/**
	 * 扫描所有工具的 Skills
	 */
	async scanAllSkills(projectPath?: string): Promise<SkillInfo[]> {
		const allSkills: SkillInfo[] = [];

		for (const tool of AI_TOOLS) {
			const skills = await this.scanToolSkills(tool, projectPath);
			allSkills.push(...skills);
		}

		return allSkills;
	}

	/**
	 * 扫描单个目录下的 Skills
	 */
	private async scanSkillDirectory(
		dirPath: string,
		toolId: AIToolType,
	): Promise<SkillInfo[]> {
		const skills: SkillInfo[] = [];

		try {
			const exists = await this.fs.promises.access(dirPath).then(() => true).catch(() => false);
			if (!exists) return [];

			const entries = await this.fs.promises.readdir(dirPath, {
				withFileTypes: true,
			});

			for (const entry of entries) {
				if (!entry.isDirectory()) continue;

				const skillDir = this.path.join(dirPath, entry.name);
				const skillMdPath = this.path.join(skillDir, "skill.md");

				try {
					const mdExists = await this.fs.promises.access(skillMdPath).then(() => true).catch(() => false);
					if (mdExists) {
						const content = await this.fs.promises.readFile(skillMdPath, "utf-8");
						const { name, description } = this.parseSkillMd(content, entry.name);
						skills.push({
							name,
							description,
							content,
							filePath: skillMdPath,
							tool: toolId,
						});
					}
				} catch {
					// 跳过无法读取的文件
				}
			}
		} catch {
			// 目录不存在或无法访问
		}

		return skills;
	}

	/**
	 * 解析 skill.md 文件，提取名称和描述
	 */
	private parseSkillMd(
		content: string,
		fallbackName: string,
	): { name: string; description: string } {
		let name = fallbackName;
		let description = "";

		const lines = content.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			// 提取第一个标题作为名称
			if (!name || name === fallbackName) {
				const headingMatch = trimmed.match(/^#+\s+(.+)/);
				if (headingMatch) {
					name = headingMatch[1].trim();
					continue;
				}
			}
			// 提取第一段非标题文本作为描述
			if (!description && trimmed && !trimmed.startsWith("#")) {
				description = trimmed;
				break;
			}
		}

		// 截断描述
		if (description.length > 200) {
			description = description.slice(0, 200) + "...";
		}

		return { name, description };
	}

	/**
	 * 检查指定工具的 Skills 是否存在
	 */
	async checkToolExists(tool: AIToolConfig, projectPath?: string): Promise<{
		global: boolean;
		project: boolean;
		globalCount: number;
		projectCount: number;
	}> {
		const result = {
			global: false,
			project: false,
			globalCount: 0,
			projectCount: 0,
		};

		if (!this.available) return result;

		// 检查全局路径
		for (const relPath of tool.skillPaths) {
			const fullPath = this.path.join(this.homeDir, relPath);
			try {
				const exists = await this.fs.promises.access(fullPath).then(() => true).catch(() => false);
				if (exists) {
					result.global = true;
					const entries = await this.fs.promises.readdir(fullPath, { withFileTypes: true });
					result.globalCount += entries.filter((e: any) => e.isDirectory()).length;
				}
			} catch {
				// 忽略
			}
		}

		// 检查项目路径
		if (projectPath) {
			for (const relPath of tool.projectPaths) {
				const fullPath = this.path.join(projectPath, relPath);
				try {
					const exists = await this.fs.promises.access(fullPath).then(() => true).catch(() => false);
					if (exists) {
						result.project = true;
						const entries = await this.fs.promises.readdir(fullPath, { withFileTypes: true });
						result.projectCount += entries.filter((e: any) => e.isDirectory()).length;
					}
				} catch {
					// 忽略
				}
			}
		}

		return result;
	}

	/**
	 * 获取 skill.md 文件内容
	 */
	async readSkillContent(filePath: string): Promise<string | null> {
		if (!this.available) return null;
		try {
			return await this.fs.promises.readFile(filePath, "utf-8");
		} catch {
			return null;
		}
	}

	/**
	 * 在文件管理器中打开 Skills 目录
	 */
	async openInFileManager(dirPath: string): Promise<boolean> {
		if (!this.available) return false;
		try {
			const { shell } = window.require("electron");
			await shell.openPath(dirPath);
			return true;
		} catch {
			return false;
		}
	}

	destroy() {
		this.fs = null;
		this.path = null;
		this.available = false;
	}
}
