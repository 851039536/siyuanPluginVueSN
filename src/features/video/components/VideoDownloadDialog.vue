<template>
  <div class="dialog-overlay" v-if="visible" @click="onClose">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>📥 视频下载</h3>
        <Button icon="x" variant="ghost" size="small" @click="onClose" :disabled="downloadProgress" />
      </div>
      <div class="dialog-body">
        <!-- yt-dlp 路径设置 -->
        <div class="form-group">
          <label>yt-dlp 路径</label>
          <div class="path-input-group">
            <Input
              v-model="currentYtdlpPath"
              placeholder="E:\Program\yt-dlp.exe"
              :disabled="downloadProgress"
            />
            <Button variant="secondary" size="small" @click="testYtdlpPath" :disabled="downloadProgress" title="测试路径">
              测试
            </Button>
            <Button variant="secondary" size="small" @click="saveYtdlpPath" :disabled="downloadProgress" title="保存路径">
              保存
            </Button>
          </div>
          <div class="form-hint" v-if="ytdlpTestResult">
            <span :style="{ color: ytdlpTestResult === 'success' ? '#788c5d' : '#d97757' }">
              {{ ytdlpTestResult === 'success' ? '✅ 路径有效' : '❌ 路径无效' }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label>视频链接</label>
          <Input
            v-model="downloadUrl"
            placeholder="请输入视频 URL（支持 YouTube、Bilibili 等）"
            :disabled="downloadProgress"
          />
          <div class="form-hint">
            支持的网站：YouTube、Bilibili、Twitter/X、Vimeo、Instagram、Facebook、TikTok 等
          </div>
        </div>

        <div class="form-group">
          <label>下载质量</label>
          <Select v-model="downloadQuality" :options="qualityOptions" :disabled="downloadProgress" />
        </div>

        <div class="form-group">
          <label>输出格式</label>
          <Select v-model="downloadFormat" :options="formatOptions" :disabled="downloadProgress" />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="downloadSubtitle"
              type="checkbox"
              :disabled="downloadProgress"
            />
            <span>下载字幕（如果可用）</span>
          </label>
          <div class="form-hint">
            自动下载中文和英文字幕，并嵌入视频中
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="autoMergeVideoAudio"
              type="checkbox"
              :disabled="downloadProgress"
            />
            <span>下载完成自动合并音视频</span>
          </label>
          <div class="form-hint">
            如果下载产生分离的视频和音频文件，自动使用 FFmpeg 合并
          </div>
        </div>

        <div class="form-group" v-if="downloadProgress">
          <label>下载进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: downloadProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ downloadProgressPercent }}% - {{ downloadStatus }}
            </div>
          </div>
        </div>

        <div class="form-group" v-if="downloadResult">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">状态：</span>
              <span class="info-value" :style="{ color: downloadResult.success ? '#788c5d' : '#d97757' }">
                {{ downloadResult.success ? '✅ 下载成功' : '❌ 下载失败' }}
              </span>
            </div>
            <div class="info-item" v-if="downloadResult.fileName">
              <span class="info-label">文件名：</span>
              <span class="info-value">{{ downloadResult.fileName }}</span>
            </div>
            <div class="info-item" v-if="downloadResult.error">
              <span class="info-label">错误信息：</span>
              <span class="info-value">{{ downloadResult.error }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <Button
          variant="secondary"
          @click="onClose"
          :disabled="downloadProgress"
        >
          {{ downloadResult ? '关闭' : '取消' }}
        </Button>
        <Button
          variant="primary"
          @click="handleDownloadVideo"
          :disabled="downloadProgress || !downloadUrl"
        >
          {{ downloadProgress ? '下载中...' : '开始下载' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { showMessage } from "siyuan";
import Button from "@/components/Button.vue";
import Input from "@/components/Input.vue";
import Select from "@/components/Select.vue";
import {
  downloadVideo,
  setYtdlpPath,
  getCurrentYtdlpPath,
  type YtdlpResult,
} from "../utils/ytdlp";
import {
  mergeVideoAudio,
  isFFmpegAvailable,
  buildVideoPath,
} from "../utils/ffmpeg";
import { getWorkspacePath } from "../utils/utils";

// Props
const props = defineProps<{
  visible: boolean;
}>();

// Emits
const emit = defineEmits<{
  close: [];
  success: [];
}>();

// 响应式数据
const downloadUrl = ref("");
const downloadQuality = ref<"best" | "1080p" | "720p" | "480p" | "360p">(
  "best",
);
const downloadFormat = ref<"mp4" | "webm" | "mkv" | "best">("mp4");

// 选项数据
const qualityOptions = computed(() => [
  { value: "best", label: "最佳质量" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
]);

const formatOptions = computed(() => [
  { value: "mp4", label: "MP4（推荐）" },
  { value: "webm", label: "WebM" },
  { value: "mkv", label: "MKV" },
  { value: "best", label: "最佳格式" },
]);
const downloadSubtitle = ref(false);
const autoMergeVideoAudio = ref(false);
const downloadProgress = ref(false);
const downloadProgressPercent = ref(0);
const downloadStatus = ref("");
const downloadResult = ref<YtdlpResult | null>(null);
const currentYtdlpPath = ref("");
const ytdlpTestResult = ref<"success" | "failed" | null>(null);
const mergeProgress = ref(false);
const mergeStatus = ref("");

// 监听 visible 变化，初始化路径
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      currentYtdlpPath.value = getCurrentYtdlpPath();
      ytdlpTestResult.value = null;
      downloadUrl.value = "";
      downloadQuality.value = "best";
      downloadFormat.value = "mp4";
      downloadSubtitle.value = false;
      autoMergeVideoAudio.value = false;
      downloadProgress.value = false;
      downloadProgressPercent.value = 0;
      downloadStatus.value = "";
      downloadResult.value = null;
      mergeProgress.value = false;
      mergeStatus.value = "";
    }
  },
);

// 方法
function onClose() {
  if (downloadProgress.value) {
    showMessage("下载进行中，请稍候...", 2000, "info");
    return;
  }
  emit("close");
}

function testYtdlpPath() {
  if (!currentYtdlpPath.value) {
    showMessage("请输入 yt-dlp 路径", 2000, "error");
    return;
  }

  try {
    const fs = (window as any).require("fs");
    if (fs.existsSync(currentYtdlpPath.value)) {
      ytdlpTestResult.value = "success";
      showMessage("yt-dlp 路径有效！", 2000, "info");
    } else {
      ytdlpTestResult.value = "failed";
      showMessage("yt-dlp 路径不存在", 2000, "error");
    }
  } catch (error) {
    ytdlpTestResult.value = "failed";
    showMessage("测试失败: " + (error as Error).message, 2000, "error");
  }
}

function saveYtdlpPath() {
  if (!currentYtdlpPath.value) {
    showMessage("请输入 yt-dlp 路径", 2000, "error");
    return;
  }

  const success = setYtdlpPath(currentYtdlpPath.value);
  if (success) {
    showMessage("yt-dlp 路径已保存！", 2000, "info");
    ytdlpTestResult.value = null;
  } else {
    showMessage("保存失败：路径不存在", 2000, "error");
  }
}

async function handleDownloadVideo() {
  if (!downloadUrl.value) {
    showMessage("请输入视频 URL", 2000, "error");
    return;
  }

  // 检查 FFmpeg 是否可用（如果启用了自动合并）
  if (autoMergeVideoAudio.value && !isFFmpegAvailable()) {
    showMessage("自动合并需要 FFmpeg，请先安装并配置 FFmpeg", 3000, "error");
    return;
  }

  downloadProgress.value = true;
  downloadProgressPercent.value = 0;
  downloadStatus.value = "准备下载...";
  downloadResult.value = null;
  mergeProgress.value = false;
  mergeStatus.value = "";

  try {
    const result = await downloadVideo({
      url: downloadUrl.value,
      quality: downloadQuality.value,
      format: downloadFormat.value,
      subtitle: downloadSubtitle.value,
      onProgress: (progress, status) => {
        downloadProgressPercent.value = progress;
        downloadStatus.value = status;
      },
    });

    downloadResult.value = result;

    if (result.success) {
      showMessage(`视频下载成功！${result.fileName || ""}`, 3000, "info");

      // 自动合并音视频
      if (autoMergeVideoAudio.value && result.fileName) {
        await handleAutoMerge(result.fileName);
      }

      emit("success");
    } else {
      showMessage(`视频下载失败: ${result.error || "未知错误"}`, 5000, "error");
    }
  } catch (error: any) {
    console.error("下载视频失败:", error);
    downloadResult.value = {
      success: false,
      error: error.message || "下载失败",
    };
    showMessage("视频下载失败: " + error.message, 5000, "error");
  } finally {
    downloadProgress.value = false;
    mergeProgress.value = false;
  }
}

/**
 * 自动合并音视频
 * 检查下载目录中是否存在分离的视频和音频文件，如果有则合并
 */
async function handleAutoMerge(fileName: string) {
  if (!fileName) return;

  try {
    mergeProgress.value = true;
    mergeStatus.value = "检查是否需要合并...";
    downloadStatus.value = "检查音视频文件...";

    // 获取视频目录
    const workspacePath = await getWorkspacePath();
    if (!workspacePath) {
      showMessage("无法获取工作区路径", 2000, "error");
      return;
    }

    const videoDir = `${workspacePath}/data/video`;
    const fs = (window as any).require("fs");
    const path = (window as any).require("path");

    // 规范化路径函数（统一使用正斜杠）
    function normalizePath(p: string): string {
      return p.replace(/\\/g, "/");
    }

    // 读取目录中的所有文件及其修改时间
    const files = fs.readdirSync(videoDir);
    const fileStats = new Map<string, { mtime: number; size: number }>();

    for (const f of files) {
      try {
        const fullPath = path.join(videoDir, f);
        const stats = fs.statSync(fullPath);
        fileStats.set(f, { mtime: stats.mtimeMs, size: stats.size });
      } catch (e) {
        // 忽略无法访问的文件
      }
    }

    // 查找可能的相关文件
    const videoExtensions = [".mp4", ".mkv", ".webm", ".m4v"];
    const audioExtensions = [".m4a", ".aac", ".mp3", ".opus", ".ogg", ".wav"];

    // 找出所有可能的视频和音频文件
    const videoFiles: Array<{
      name: string;
      path: string;
      mtime: number;
      normalized: string;
    }> = [];
    const audioFiles: Array<{
      name: string;
      path: string;
      mtime: number;
      normalized: string;
    }> = [];

    const now = Date.now();

    // 规范化文件名用于比较：移除所有格式代码和特殊字符
    function normalizeFileName(name: string): string {
      return name
        .toLowerCase()
        .replace(/\.\w{5,6}$/, "") // 移除格式代码
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, ""); // 移除特殊字符，保留字母、数字、中文
    }

    // 收集所有视频和音频文件（包括较旧的），稍后按时间排序选择
    for (const [fname, stats] of fileStats.entries()) {
      const ext = path.extname(fname).toLowerCase();
      const nameWithoutExt = path.basename(fname, ext);
      const normalized = normalizeFileName(nameWithoutExt);

      // 跳过太旧的文件（超过1小时）
      if (now - stats.mtime > 60 * 60 * 1000) {
        continue;
      }

      if (videoExtensions.includes(ext)) {
        videoFiles.push({
          name: fname,
          path: path.join(videoDir, fname),
          mtime: stats.mtime,
          normalized,
        });
      } else if (audioExtensions.includes(ext)) {
        audioFiles.push({
          name: fname,
          path: path.join(videoDir, fname),
          mtime: stats.mtime,
          normalized,
        });
      }
    }

    // 按修改时间排序（最新的在前）
    videoFiles.sort((a, b) => b.mtime - a.mtime);
    audioFiles.sort((a, b) => b.mtime - a.mtime);

    // 只保留最近的文件（最多3个视频和3个音频）
    const recentVideoFiles = videoFiles.slice(0, 3);
    const recentAudioFiles = audioFiles.slice(0, 3);

    let videoFile: string | null = null;
    let audioFile: string | null = null;

    // 匹配策略：找文件名最相似的视频和音频对
    if (recentVideoFiles.length > 0 && recentAudioFiles.length > 0) {
      let bestMatch = { video: -1, audio: -1, score: 0 };

      for (let i = 0; i < recentVideoFiles.length; i++) {
        for (let j = 0; j < recentAudioFiles.length; j++) {
          const videoNorm = recentVideoFiles[i].normalized;
          const audioNorm = recentAudioFiles[j].normalized;

          // 计算相似度（使用最长公共子序列）
          let score = 0;
          const longer =
            videoNorm.length > audioNorm.length ? videoNorm : audioNorm;
          const shorter =
            videoNorm.length > audioNorm.length ? audioNorm : videoNorm;

          if (longer === shorter) {
            score = longer.length;
          } else {
            // 简单的相似度计算：包含关系
            if (longer.includes(shorter) || shorter.includes(longer)) {
              score = shorter.length;
            } else {
              // 计算公共字符数
              let common = 0;
              for (const char of shorter) {
                if (longer.includes(char)) common++;
              }
              score = common;
            }
          }

          if (score > bestMatch.score) {
            bestMatch = { video: i, audio: j, score };
          }
        }
      }

      // 只有当相似度足够高时才合并
      if (
        bestMatch.score > 10 &&
        bestMatch.video >= 0 &&
        bestMatch.audio >= 0
      ) {
        videoFile = recentVideoFiles[bestMatch.video].path;
        audioFile = recentAudioFiles[bestMatch.audio].path;
      }
    }

    if (!videoFile || !audioFile) {
      showMessage("未发现分离的音视频文件，无需合并", 2000, "info");
      return;
    }

    // 执行合并
    downloadStatus.value = "正在合并音视频...";
    mergeStatus.value = "合并中...";

    // 构建输出文件名（使用视频文件的基础部分，移除所有格式代码）
    const videoFileName = path.basename(videoFile);
    let outputBaseName = path.basename(
      videoFileName,
      path.extname(videoFileName),
    );
    // 移除所有可能的格式代码（如 .f100024, .f30280 等）
    outputBaseName = outputBaseName.replace(/\.\w{5,6}$/, "");
    const outputFileName = `${outputBaseName}.${downloadFormat.value}`;
    const outputPath = await buildVideoPath(outputFileName);

    // 检查输出文件是否与输入文件相同（使用规范化路径比较）
    if (
      normalizePath(outputPath) === normalizePath(videoFile) ||
      normalizePath(outputPath) === normalizePath(audioFile)
    ) {
      // 如果相同，添加临时后缀
      const tempOutputFileName = `${outputBaseName}_temp.${downloadFormat.value}`;
      const tempOutputPath = await buildVideoPath(tempOutputFileName);

      // 先合并到临时文件
      const mergeResult = await mergeVideoAudio({
        videoPath: videoFile.replace(`${workspacePath}/`, ""),
        audioPath: audioFile.replace(`${workspacePath}/`, ""),
        outputPath: tempOutputPath,
        onProgress: (progress) => {
          downloadProgressPercent.value = progress;
        },
      });

      if (mergeResult.success) {
        // 删除原始文件
        try {
          fs.unlinkSync(videoFile);
          fs.unlinkSync(audioFile);
        } catch (e) {
          showMessage(
            `音视频合并成功！已保存为 ${tempOutputFileName}（原始文件未删除）`,
            3000,
            "info",
          );
        }

        // 重命名临时文件为目标文件名
        try {
          fs.renameSync(tempOutputPath, outputPath);
          showMessage(
            `音视频合并成功！已保存为 ${outputFileName}`,
            3000,
            "info",
          );
        } catch (e) {
          showMessage(
            `音视频合并成功！已保存为 ${tempOutputFileName}`,
            3000,
            "info",
          );
        }
        return;
      } else {
        showMessage(`音视频合并失败: ${mergeResult.error}`, 5000, "error");
        return;
      }
    }

    const mergeResult = await mergeVideoAudio({
      videoPath: videoFile.replace(`${workspacePath}/`, ""),
      audioPath: audioFile.replace(`${workspacePath}/`, ""),
      outputPath,
      onProgress: (progress) => {
        downloadProgressPercent.value = progress;
      },
    });

    if (mergeResult.success) {
      downloadStatus.value = "合并完成！";
      mergeStatus.value = "合并成功";

      // 删除原始分离文件
      try {
        fs.unlinkSync(videoFile);
        fs.unlinkSync(audioFile);
        showMessage(`音视频合并成功！已保存为 ${outputFileName}`, 3000, "info");
      } catch (e) {
        showMessage(
          `音视频合并成功！已保存为 ${outputFileName}（原始文件未删除）`,
          3000,
          "info",
        );
      }
    } else {
      showMessage(`音视频合并失败: ${mergeResult.error}`, 5000, "error");
    }
  } catch (error: any) {
    showMessage("自动合并失败: " + error.message, 5000, "error");
  } finally {
    mergeProgress.value = false;
  }
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";

.path-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
