export interface WebDAVConfig {
	serverUrl: string;
	username: string;
	password: string;
	basePath: string;
	autoSync: boolean;
	syncInterval: number;
	lastSyncTime: string;
}

export interface WebDAVFile {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	lastModified: string;
}

export interface SyncLog {
	time: string;
	type: "success" | "error" | "info";
	message: string;
}

export interface WebDAVState {
	connectionStatus: "unknown" | "connected" | "error";
	fileList: WebDAVFile[];
	currentPath: string;
	loadingFiles: boolean;
	syncLogs: SyncLog[];
	lastSyncTime: string;
}

export interface WebDAVService {
	testConnection(config: WebDAVConfig): Promise<boolean>;
	fetchFileList(config: WebDAVConfig, path?: string): Promise<WebDAVFile[]>;
	parseWebDAVResponse(xml: string): WebDAVFile[];
	downloadFile(config: WebDAVConfig, file: WebDAVFile): Promise<Blob | null>;
	downloadBlob(blob: Blob, filename: string): void;
}
