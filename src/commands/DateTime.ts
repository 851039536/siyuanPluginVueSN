import { Plugin } from "siyuan";

/**
 * 日期时间插入功能模块
 * 提供多种快捷指令插入当前日期、时间或日期时间
 */
export class DateTime {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	/**
	 * 初始化日期时间功能
	 * 注册斜杠命令
	 */
	init() {
		this.registerSlashCommands();
	}

	/**
	 * 注册所有斜杠命令
	 */
	private registerSlashCommands() {
		// 注册完整日期时间命令 /xz
		this.plugin.protyleSlash.push({
			filter: ["xz", "现在", "xianzai"],
			html: "插入当前时间 （2024-11-24 18:59:41）",
			id: "insertDateTime_xz",
			callback: (protyle) => {
				this.insertDateTime(protyle);
			},
		});

		// 注册完整日期时间命令 /now
		this.plugin.protyleSlash.push({
			filter: ["now", "datetime"],
			html: "current date time (e.g: 2024-11-24 18:59:41)",
			id: "insertDateTime_now",
			callback: (protyle) => {
				this.insertDateTime(protyle);
			},
		});

		// 注册仅时间命令 /sj
		this.plugin.protyleSlash.push({
			filter: ["sj", "时间", "shijian"],
			html: "当前时间 (如: 18:59:41)",
			id: "insertTime_sj",
			callback: (protyle) => {
				this.insertTime(protyle);
			},
		});

		// 注册仅时间命令 /time
		this.plugin.protyleSlash.push({
			filter: ["time"],
			html: "current time (e.g: 18:59:41)",
			id: "insertTime_time",
			callback: (protyle) => {
				this.insertTime(protyle);
			},
		});

		// 注册仅日期命令 /rq
		this.plugin.protyleSlash.push({
			filter: ["rq", "日期", "riqi"],
			html: "当前日期 (如: 2024-11-24)",
			id: "insertDate_rq",
			callback: (protyle) => {
				this.insertDate(protyle);
			},
		});

		// 注册仅日期命令 /date
		this.plugin.protyleSlash.push({
			filter: ["date"],
			html: "current date (e.g: 2024-11-24)",
			id: "insertDate_date",
			callback: (protyle) => {
				this.insertDate(protyle);
			},
		});

		// 注册仅日期命令 /jt
		this.plugin.protyleSlash.push({
			filter: ["jt", "今天", "jintian"],
			html: "今天日期 (如: 2024-11-24)",
			id: "insertDate_jt",
			callback: (protyle) => {
				this.insertDate(protyle);
			},
		});

		// 注册仅日期命令 /today
		this.plugin.protyleSlash.push({
			filter: ["today"],
			html: "today date (e.g: 2024-11-24)",
			id: "insertDate_today",
			callback: (protyle) => {
				this.insertDate(protyle);
			},
		});
	}

	/**
	 * 插入日期时间
	 */
	private insertDateTime(protyle: any) {
		protyle.insert(this.getCurrentDateTime(), false);
	}

	/**
	 * 插入时间
	 */
	private insertTime(protyle: any) {
		protyle.insert(this.getCurrentTime(), false);
	}

	/**
	 * 插入日期
	 */
	private insertDate(protyle: any) {
		protyle.insert(this.getCurrentDate(), false);
	}

	/**
	 * 获取当前日期时间
	 * 格式: YYYY-MM-DD HH:mm:ss
	 */
	private getCurrentDateTime(): string {
		const now = new Date();
		return this.formatDateTime(now);
	}

	/**
	 * 获取当前时间
	 * 格式: HH:mm:ss
	 */
	private getCurrentTime(): string {
		const now = new Date();
		return this.formatTime(now);
	}

	/**
	 * 获取当前日期
	 * 格式: YYYY-MM-DD
	 */
	private getCurrentDate(): string {
		const now = new Date();
		return this.formatDate(now);
	}

	/**
	 * 格式化日期时间
	 */
	private formatDateTime(date: Date): string {
		return `${this.formatDate(date)} ${this.formatTime(date)}`;
	}

	/**
	 * 格式化日期
	 */
	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = ("0" + (date.getMonth() + 1)).slice(-2);
		const day = ("0" + date.getDate()).slice(-2);
		return `${year}-${month}-${day}`;
	}

	/**
	 * 格式化时间
	 */
	private formatTime(date: Date): string {
		const hours = ("0" + date.getHours()).slice(-2);
		const minutes = ("0" + date.getMinutes()).slice(-2);
		const seconds = ("0" + date.getSeconds()).slice(-2);
		return `${hours}:${minutes}:${seconds}`;
	}

	/**
	 * 销毁功能模块
	 */
	destroy() {}
}
