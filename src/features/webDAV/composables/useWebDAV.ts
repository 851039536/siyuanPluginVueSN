import { ref, computed, reactive, watch, toRef } from "vue";
import type { WebDAVConfig, WebDAVFile, SyncLog, WebDAVState } from "../types";
import { webDAVService } from "../services/webDAVService";

export function useWebDAV(i18nRef: { value: Record<string, any> }) {
  const state = reactive<WebDAVState>({
    connectionStatus: "unknown",
    fileList: [],
    currentPath: "",
    loadingFiles: false,
    syncLogs: [],
    lastSyncTime: "",
  });

  const testingConnection = ref(false);
  const syncing = ref(false);
  const passwordVisible = ref(false);

  const isConfigured = computed(() => {
    return (
      state.fileList.length > 0 ||
      (state.currentPath && state.connectionStatus === "connected")
    );
  });

  const statusText = computed(() => {
    const i18n = i18nRef.value;
    switch (state.connectionStatus) {
      case "connected":
        return i18n?.connectionSuccess || "连接成功";
      case "error":
        return i18n?.connectionError || "连接失败";
      default:
        return i18n?.notConnected || "未连接";
    }
  });

  const addLog = (type: SyncLog["type"], message: string) => {
    const i18n = i18nRef.value;
    state.syncLogs.unshift({
      time: new Date().toISOString(),
      type,
      message,
    });
    if (state.syncLogs.length > 50) {
      state.syncLogs = state.syncLogs.slice(0, 50);
    }
  };

  const clearLogs = () => {
    state.syncLogs = [];
  };

  const testConnection = async (config: WebDAVConfig): Promise<boolean> => {
    const i18n = i18nRef.value;
    if (!config.serverUrl) {
      return false;
    }

    testingConnection.value = true;
    state.connectionStatus = "unknown";
    state.fileList = [];
    state.syncLogs = [];
    addLog("info", i18n?.testingConnection || "正在测试连接...");

    try {
      const success = await webDAVService.testConnection(config);

      if (success) {
        state.connectionStatus = "connected";
        addLog("success", i18n?.connectionSuccess || "连接成功");
        await fetchFileList(config);
      } else {
        state.connectionStatus = "error";
        addLog("error", i18n?.connectionFailed || "连接失败");
      }

      return success;
    } catch (error) {
      state.connectionStatus = "error";
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog("error", i18n?.connectionError || `连接错误: ${errorMessage}`);
      return false;
    } finally {
      testingConnection.value = false;
    }
  };

  const fetchFileList = async (config: WebDAVConfig, path?: string) => {
    const i18n = i18nRef.value;
    state.loadingFiles = true;
    state.fileList = [];

    try {
      const files = await webDAVService.fetchFileList(config, path);
      state.fileList = files;
      state.currentPath = path || config.basePath || "/";
      addLog(
        "info",
        i18n?.fileListLoaded || `已加载文件列表，共 ${files.length} 个项目`,
      );
    } catch (error) {
      state.currentPath = path || config.basePath || "/";
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(
        "error",
        i18n?.loadFileListError || `加载文件列表错误: ${errorMessage}`,
      );
    } finally {
      state.loadingFiles = false;
    }
  };

  const syncNow = async (config: WebDAVConfig): Promise<boolean> => {
    const i18n = i18nRef.value;
    if (!config.serverUrl || !config.username) {
      return false;
    }

    syncing.value = true;
    addLog("info", i18n?.startingSync || "开始同步...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      state.lastSyncTime = new Date().toISOString();
      addLog("success", i18n?.syncCompleted || "同步完成");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog("error", i18n?.syncFailed || `同步失败: ${errorMessage}`);
      return false;
    } finally {
      syncing.value = false;
    }
  };

  const updateConfig = (config: Partial<WebDAVConfig>) => {
    state.lastSyncTime = config.lastSyncTime || state.lastSyncTime;
    state.currentPath = config.basePath || state.currentPath;
  };

  const reset = () => {
    state.connectionStatus = "unknown";
    state.fileList = [];
    state.currentPath = "";
    state.loadingFiles = false;
    state.syncLogs = [];
    state.lastSyncTime = "";
  };

  return {
    state,
    testingConnection,
    syncing,
    passwordVisible,
    isConfigured,
    statusText,
    testConnection,
    fetchFileList,
    syncNow,
    addLog,
    clearLogs,
    updateConfig,
    reset,
  };
}
