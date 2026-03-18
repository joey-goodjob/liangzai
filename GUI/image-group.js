/**
 * AI 组图生成工具 - 主程序
 *
 * 功能：通过可视化界面调用火山引擎组图生成API
 */

// ========== 全局状态 ==========
const AppState = {
  characterImage: null, // 人物图 (单张 base64)
  sceneImages: [], // 场景图数组 (支持多张 base64)
  results: [], // 生成结果
  isGenerating: false, // 是否正在生成
  lightboxIndex: 0, // Lightbox 当前显示的图片索引
  cancelRequested: false, // 用户是否请求取消
  logEntries: [],
  currentRunId: null,
};

// ========== 场景锁定提示词配置 ==========
const PROMPT_CONFIG = {
  // 场景锁定 + 人物深度融合指令
  sceneLock: `【最重要的要求】
生成一张像在同一时间、同一地点直接拍摄的真实照片，人物必须像真实站在场景里，不能有后期合成感。

【场景锁定】
背景、环境、构图、机位、透视、主体光线保持不变。

【人物融合要求】
1. 保留参考人物的脸部、发型、体型和服装特征。
2. 人物姿势按用户要求自然调整，站位与场景比例正确。
3. 人物高光、阴影、环境反光、接触阴影、景深、边缘透明过渡必须与场景一致。
4. 整体色调统一，不能出现单独调色或比背景更清晰/更模糊的情况。

【绝对禁止】
- 贴纸感、悬浮感、白边黑边、额外光源、比例错误、边缘锯齿

最终效果：看起来就像是在这个场景中实地拍摄的照片。`,

  // 只有场景图时的提示词（文字生成人物）
  textGenerate: `【场景锁定】背景环境、构图、机位、透视保持不变。

【人物生成要求】
根据用户描述生成一个真实人物，人物与场景的光照、环境反光、接触阴影、景深、比例、边缘过渡保持一致，不能有贴图感。

最终效果：看起来就像是在这个场景中实地拍摄的照片。`,
};

const PROVIDERS = {
  VOLCENGINE: "volcengine",
  NANO: "nano",
};

const MODEL_PROVIDER_MAP = {
  "doubao-seedream-4-5-251128": PROVIDERS.VOLCENGINE,
  "doubao-seedream-5-0-260128": PROVIDERS.VOLCENGINE,
  "nano-banana-2": PROVIDERS.NANO,
};

const NANO_CONFIG = {
  uploadEndpoint: "/api/upload",
  createTaskEndpoint: "/api/nano/create-task",
  taskStatusEndpoint: "/api/nano/task-status",
  pollIntervalMs: 3000,
  timeoutMsBySize: {
    "2K": 5 * 60 * 1000,
    "4K": 8 * 60 * 1000,
  },
};

function getProviderForModel(model) {
  return MODEL_PROVIDER_MAP[model] || PROVIDERS.VOLCENGINE;
}

// ========== DOM 元素引用 ==========
const DOM = {
  // 配置
  modelSelect: document.getElementById("modelSelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  sizeSelect: document.getElementById("sizeSelect"),

  // 提示词
  promptInput: document.getElementById("promptInput"),
  charCount: document.getElementById("charCount"),

  // 人物图
  characterUpload: document.getElementById("characterUpload"),
  characterImageInput: document.getElementById("characterImageInput"),
  characterPlaceholder: document.getElementById("characterPlaceholder"),
  characterPreview: document.getElementById("characterPreview"),
  characterPreviewImg: document.getElementById("characterPreviewImg"),
  removeCharacterBtn: document.getElementById("removeCharacterBtn"),

  // 场景图（多张）
  sceneUpload: document.getElementById("sceneUpload"),
  sceneImageInput: document.getElementById("sceneImageInput"),
  scenePlaceholder: document.getElementById("scenePlaceholder"),
  sceneScrollContainer: document.getElementById("sceneScrollWrapper"), // 滚动容器
  scenePreviewContainer: document.getElementById("scenePreviewContainer"), // 预览容器
  sceneCount: document.getElementById("sceneCount"),
  clearAllSceneBtn: document.getElementById("clearAllSceneBtn"),
  addMoreSceneBtn: document.getElementById("addMoreSceneBtn"),

  // 生成
  generateBtn: document.getElementById("generateBtn"),
  cancelBtn: document.getElementById("cancelBtn"),

  // 结果
  resultGrid: document.getElementById("resultGrid"),
  resultActions: document.getElementById("resultActions"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),

  // 状态
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot"),

  // 加载
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  progressFill: document.getElementById("progressFill"),

  // Toast
  toast: document.getElementById("toast"),

  // 日志面板
  logPanel: document.getElementById("logPanel"),
  logList: document.getElementById("logList"),
  logSummary: document.getElementById("logSummary"),
  clearLogsBtn: document.getElementById("clearLogsBtn"),
  copyLogsBtn: document.getElementById("copyLogsBtn"),
  logEmptyState: document.getElementById("logEmptyState"),

  // Lightbox 图片预览
  lightbox: document.getElementById("lightbox"),
  lightboxImage: document.getElementById("lightboxImage"),
  lightboxClose: document.getElementById("lightboxClose"),
  lightboxPrev: document.getElementById("lightboxPrev"),
  lightboxNext: document.getElementById("lightboxNext"),
  lightboxCounter: document.getElementById("lightboxCounter"),
  lightboxDownload: document.getElementById("lightboxDownload"),
};

// ========== 工具函数 ==========

/**
 * 显示Toast提示
 */
function showToast(message, type = "info") {
  DOM.toast.textContent = message;
  DOM.toast.className = `toast show ${type}`;
  setTimeout(() => {
    DOM.toast.classList.remove("show");
  }, 3000);
}

/**
 * 显示/隐藏加载遮罩
 */
function setLoading(show, text = "处理中...", progress = 0) {
  DOM.loadingOverlay.classList.toggle("active", show);
  DOM.loadingText.textContent = text;
  DOM.progressFill.style.width = `${progress}%`;
}

/**
 * 更新状态显示
 */
function updateStatus(text, isActive = false) {
  DOM.statusText.innerHTML = `<span class="status-dot ${isActive ? "active" : ""}"></span> ${text}`;
}

function getTimestamp() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setRunContext(runId) {
  AppState.currentRunId = runId;
}

function updateLogSummary(text) {
  if (DOM.logSummary) {
    DOM.logSummary.textContent = text;
  }
}

function shouldStickLogToBottom() {
  if (!DOM.logList) {
    return false;
  }

  const threshold = 32;
  const distanceToBottom =
    DOM.logList.scrollHeight - DOM.logList.scrollTop - DOM.logList.clientHeight;

  return distanceToBottom <= threshold;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMeta(meta) {
  if (!meta) {
    return "";
  }

  if (typeof meta === "string") {
    return meta;
  }

  return Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      if (typeof value === "object") {
        return `${key}: ${JSON.stringify(value, null, 2)}`;
      }

      return `${key}: ${value}`;
    })
    .join("\n");
}

function renderLogEntry(entry) {
  if (!DOM.logList) {
    return;
  }

  const autoStick = shouldStickLogToBottom();

  if (DOM.logEmptyState) {
    DOM.logEmptyState.remove();
    DOM.logEmptyState = null;
  }

  const item = document.createElement("div");
  item.className = `log-entry ${entry.level}`;

  const metaText = formatMeta(entry.meta);

  item.innerHTML = `
    <div class="log-time">${escapeHtml(entry.time)}</div>
    <div class="log-body">
      <div class="log-message">${escapeHtml(entry.message)}</div>
      ${
        metaText
          ? `<div class="log-meta">${escapeHtml(metaText)}</div>`
          : ""
      }
    </div>
  `;

  DOM.logList.appendChild(item);

  if (autoStick) {
    DOM.logList.scrollTop = DOM.logList.scrollHeight;
  }
}

function clearLogs(summaryText = "等待任务开始") {
  AppState.logEntries = [];

  if (DOM.logList) {
    DOM.logList.innerHTML = `
      <div class="log-empty" id="logEmptyState">
        右侧会显示每一步运行记录、接口状态和失败原因。
      </div>
    `;
    DOM.logEmptyState = document.getElementById("logEmptyState");
  }

  updateLogSummary(summaryText);
}

function addLog(level, message, meta) {
  const entry = {
    id: `${Date.now()}-${AppState.logEntries.length + 1}`,
    runId: AppState.currentRunId,
    level,
    message,
    meta,
    time: getTimestamp(),
  };

  AppState.logEntries.push(entry);
  renderLogEntry(entry);
}

function copyLogs() {
  const text = AppState.logEntries
    .map((entry) => {
      const metaText = formatMeta(entry.meta);
      return metaText
        ? `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.message}\n${metaText}`
        : `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.message}`;
    })
    .join("\n\n");

  if (!text) {
    showToast("暂无日志可复制", "info");
    return;
  }

  const copyTask = navigator.clipboard?.writeText(text);

  if (copyTask && typeof copyTask.then === "function") {
    copyTask
      .then(() => {
        showToast("日志已复制", "success");
        addLog("info", "已复制当前日志到剪贴板");
      })
      .catch(() => {
        showToast("复制日志失败，请检查浏览器权限", "error");
        addLog("error", "复制日志失败", {
          reason: "浏览器未授予 clipboard 权限",
        });
      });
    return;
  }

  showToast("当前浏览器不支持复制日志", "error");
  addLog("error", "复制日志失败", {
    reason: "当前环境不支持 navigator.clipboard",
  });
}

function formatError(error, context = {}) {
  if (!error) {
    return {
      message: "未知错误",
      meta: context,
    };
  }

  const meta = { ...context };

  if (error.status) {
    meta.status = error.status;
  }

  if (error.responseText) {
    meta.response = error.responseText;
  }

  if (error.details) {
    meta.details = error.details;
  }

  if (error.name && error.name !== "Error") {
    meta.name = error.name;
  }

  return {
    message: error.message || "未知错误",
    meta,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFileExtensionFromDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    return "png";
  }

  const match = /^data:([^;]+);base64,/.exec(dataUrl);
  const mimeType = match?.[1] || "";
  const subtype = mimeType.split("/")[1];
  return subtype ? subtype.replace("jpeg", "jpg") : "png";
}

/**
 * 将文件转换为Base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩 base64 图片，确保不超过指定大小（默认 3MB）
 * 通过缩小尺寸和降低质量来实现
 */
function compressBase64Image(dataUrl, maxSizeBytes = 3 * 1024 * 1024) {
  return new Promise((resolve) => {
    const currentSize = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (currentSize <= maxSizeBytes) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let { width, height } = img;
      const maxDimension = 2048;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let result = canvas.toDataURL("image/jpeg", quality);

      while (Math.ceil((result.length - result.indexOf(",") - 1) * 0.75) > maxSizeBytes && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }

      console.log(`图片压缩: ${(currentSize / 1024 / 1024).toFixed(1)}MB → ${(Math.ceil((result.length - result.indexOf(",") - 1) * 0.75) / 1024 / 1024).toFixed(1)}MB (quality=${quality.toFixed(1)})`);
      resolve(result);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * 下载图片（兼容跨域）
 */
function downloadImage(url, filename) {
  return new Promise((resolve) => {
    // 方式1：尝试使用 canvas 转换下载
    const img = new Image();
    img.crossOrigin = "anonymous"; // 尝试跨域

    img.onload = () => {
      try {
        // 创建 canvas
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // 转为 blob 并下载
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = blobUrl;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
              resolve(true);
            } else {
              // blob 失败，使用降级方案
              fallbackDownload(url, filename);
              resolve(false);
            }
          },
          "image/jpeg",
          0.95,
        );
      } catch (e) {
        // canvas 跨域污染，使用降级方案
        fallbackDownload(url, filename);
        resolve(false);
      }
    };

    img.onerror = () => {
      // 图片加载失败，使用降级方案
      fallbackDownload(url, filename);
      resolve(false);
    };

    img.src = url;
  });
}

/**
 * 降级下载方案（直接使用链接）
 */
function fallbackDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========== 提示词字数统计 ==========
DOM.promptInput.addEventListener("input", () => {
  const length = DOM.promptInput.value.length;
  DOM.charCount.textContent = `${length} 字`;
});

DOM.clearLogsBtn.addEventListener("click", () => {
  clearLogs();
  showToast("日志已清空", "info");
});

DOM.copyLogsBtn.addEventListener("click", () => {
  copyLogs();
});

// ========== 人物图上传 ==========

// 点击上传
DOM.characterUpload.addEventListener("click", (e) => {
  // 如果点击的是删除按钮，不触发上传
  if (e.target.classList.contains("remove-btn")) return;
  DOM.characterImageInput.click();
});

// 拖拽上传
DOM.characterUpload.addEventListener("dragover", (e) => {
  e.preventDefault();
  DOM.characterUpload.classList.add("dragover");
});

DOM.characterUpload.addEventListener("dragleave", () => {
  DOM.characterUpload.classList.remove("dragover");
});

DOM.characterUpload.addEventListener("drop", (e) => {
  e.preventDefault();
  DOM.characterUpload.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleCharacterImage(file);
  }
});

// 文件选择
DOM.characterImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleCharacterImage(file);
  }
});

// 删除人物图
DOM.removeCharacterBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearCharacterImage();
});

/**
 * 处理人物图上传
 */
async function handleCharacterImage(file) {
  const base64 = await fileToBase64(file);
  AppState.characterImage = base64;

  // 显示预览
  DOM.characterPreviewImg.src = base64;
  DOM.characterPreview.style.display = "block";
  DOM.characterPlaceholder.style.display = "none";

  showToast("人物图已上传", "success");
  addLog("info", "人物图上传完成", {
    name: file.name,
    size: `${(file.size / 1024).toFixed(1)} KB`,
    type: file.type,
  });
}

/**
 * 清除人物图
 */
function clearCharacterImage() {
  AppState.characterImage = null;
  DOM.characterPreviewImg.src = "";
  DOM.characterPreview.style.display = "none";
  DOM.characterPlaceholder.style.display = "block";
  DOM.characterImageInput.value = "";
  showToast("人物图已移除", "info");
  addLog("info", "人物图已移除");
}

// ========== 场景图上传（支持多张） ==========

// 点击上传区域或添加按钮
DOM.sceneUpload.addEventListener("click", (e) => {
  // 如果点击的是删除按钮或清空按钮，不触发上传
  if (
    e.target.classList.contains("remove-btn") ||
    e.target.classList.contains("clear-all-btn")
  )
    return;
  DOM.sceneImageInput.click();
});

// 拖拽上传
DOM.sceneUpload.addEventListener("dragover", (e) => {
  e.preventDefault();
  DOM.sceneUpload.classList.add("dragover");
});

DOM.sceneUpload.addEventListener("dragleave", () => {
  DOM.sceneUpload.classList.remove("dragover");
});

DOM.sceneUpload.addEventListener("drop", (e) => {
  e.preventDefault();
  DOM.sceneUpload.classList.remove("dragover");
  const files = Array.from(e.dataTransfer.files).filter((f) =>
    f.type.startsWith("image/"),
  );
  if (files.length > 0) {
    handleSceneImages(files);
  }
});

// 文件选择（支持多选）
DOM.sceneImageInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    handleSceneImages(files);
  }
  // 重置input，允许重复选择相同文件
  e.target.value = "";
});

// 清空全部场景图
DOM.clearAllSceneBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearAllSceneImages();
});

/**
 * 处理多张场景图上传
 */
async function handleSceneImages(files) {
  for (const file of files) {
    const base64 = await fileToBase64(file);
    AppState.sceneImages.push(base64);
    addLog("info", "场景图已加入队列", {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      totalScenes: AppState.sceneImages.length,
    });
  }

  // 更新UI
  renderSceneImages();
  showToast(`已添加 ${files.length} 张场景图`, "success");
}

/**
 * 渲染场景图预览（水平滚动）
 */
function renderSceneImages() {
  const count = AppState.sceneImages.length;

  // 更新计数
  DOM.sceneCount.textContent = `(${count}张)`;

  // 显示/隐藏清空按钮
  DOM.clearAllSceneBtn.style.display = count > 0 ? "block" : "none";

  // 显示/隐藏占位符
  DOM.scenePlaceholder.style.display = count === 0 ? "block" : "none";

  // 渲染预览
  if (count > 0) {
    DOM.sceneScrollContainer.innerHTML =
      AppState.sceneImages
        .map(
          (img, index) => `
      <div class="scene-item" data-index="${index}">
        <img src="${img}" alt="场景图 ${index + 1}">
        <span class="scene-number">${index + 1}</span>
        <button class="scene-remove-btn" data-index="${index}" onclick="event.stopPropagation(); removeSceneImage(${index})">×</button>
      </div>
    `,
        )
        .join("") +
      `
      <div class="scene-item scene-add-btn" onclick="event.stopPropagation(); DOM.sceneImageInput.click();">
        <span class="add-icon">+</span>
        <span class="add-text">添加</span>
      </div>
    `;
    DOM.scenePreviewContainer.style.display = "flex";
    DOM.sceneScrollContainer.style.display = "flex";
  } else {
    DOM.scenePreviewContainer.style.display = "none";
    DOM.sceneScrollContainer.style.display = "none";
  }
}

/**
 * 删除单张场景图
 */
function removeSceneImage(index) {
  AppState.sceneImages.splice(index, 1);
  renderSceneImages();
  showToast("已移除该场景图", "info");
  addLog("info", "已移除场景图", {
    sceneIndex: index + 1,
    remainingScenes: AppState.sceneImages.length,
  });
}

/**
 * 清空所有场景图
 */
function clearAllSceneImages() {
  AppState.sceneImages = [];
  renderSceneImages();
  showToast("已清空所有场景图", "info");
  addLog("warning", "已清空全部场景图");
}

// ========== 生成组图 ==========

// 超时与并发配置
const REQUEST_PROFILE = {
  volcengineDefault: {
    timeoutMs: 30000,
    concurrency: 5,
  },
  volcengineCharacterFusion: {
    timeoutMs: 120000,
    concurrency: 2,
  },
  volcengineCharacterFusion4K: {
    timeoutMs: 180000,
    concurrency: 1,
  },
  nano2K: {
    timeoutMs: NANO_CONFIG.timeoutMsBySize["2K"],
    concurrency: 2,
  },
  nano4K: {
    timeoutMs: NANO_CONFIG.timeoutMsBySize["4K"],
    concurrency: 1,
  },
};

function getRequestProfile({ provider, hasCharacterImage, size }) {
  if (provider === PROVIDERS.NANO) {
    return size === "4K" ? REQUEST_PROFILE.nano4K : REQUEST_PROFILE.nano2K;
  }

  if (!hasCharacterImage) {
    return REQUEST_PROFILE.volcengineDefault;
  }

  if (size === "4K") {
    return REQUEST_PROFILE.volcengineCharacterFusion4K;
  }

  return REQUEST_PROFILE.volcengineCharacterFusion;
}

function buildRequestSummary({ provider, model, size, prompt, imageCount }) {
  return {
    provider,
    model,
    size,
    imageCount,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 120),
  };
}

async function parseJsonSafely(response) {
  const responseText = await response.text();

  if (!responseText) {
    return { data: null, responseText: "" };
  }

  try {
    return {
      data: JSON.parse(responseText),
      responseText,
    };
  } catch (error) {
    return {
      data: null,
      responseText,
      parseError: error,
    };
  }
}

function formatDurationMs(ms) {
  const seconds = Math.round(ms / 1000);
  return `${seconds}秒`;
}

function estimateJsonSizeKb(payload) {
  try {
    const text = JSON.stringify(payload);
    return (new TextEncoder().encode(text).length / 1024).toFixed(1);
  } catch {
    return "unknown";
  }
}

async function postJson(url, payload, options = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  const { data, responseText, parseError } = await parseJsonSafely(response);

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || data?.message || `请求失败 (${response.status})`,
    );
    error.status = response.status;
    error.responseText = responseText?.slice(0, 500);
    error.details = data?.error?.details || parseError?.message;
    throw error;
  }

  if (parseError) {
    const error = new Error("接口返回内容不是合法 JSON");
    error.status = response.status;
    error.responseText = responseText?.slice(0, 500);
    error.details = parseError.message;
    throw error;
  }

  return data;
}

async function uploadNanoReferenceImage({ dataUrl, filename, role, sceneIndex }) {
  // 上传前压缩图片，避免超过 Vercel 4.5MB 请求体限制
  const compressedDataUrl = await compressBase64Image(dataUrl);

  addLog("info", "uploadStart", {
    provider: PROVIDERS.NANO,
    role,
    sceneIndex,
    filename,
  });

  const data = await postJson(NANO_CONFIG.uploadEndpoint, {
    dataUrl: compressedDataUrl,
    filename,
  });

  addLog("success", "uploadDone", {
    provider: PROVIDERS.NANO,
    role,
    sceneIndex,
    filename,
    url: data.url,
  });

  return data.url;
}

async function createNanoTask({ apiKey, prompt, imageUrls, resolution, sceneIndex }) {
  const data = await postJson(NANO_CONFIG.createTaskEndpoint, {
    apiKey,
    prompt,
    imageUrls,
    resolution,
  });

  addLog("info", "taskCreated", {
    provider: PROVIDERS.NANO,
    sceneIndex,
    taskId: data.taskId,
    resolution,
    imageCount: imageUrls.length,
  });

  return data.taskId;
}

async function pollNanoTask({ apiKey, taskId, resolution, sceneIndex, timeoutMs }) {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    if (AppState.cancelRequested) {
      throw new Error("已取消");
    }

    attempt += 1;
    const data = await postJson(NANO_CONFIG.taskStatusEndpoint, {
      apiKey,
      taskId,
    });

    addLog("info", "polling", {
      provider: PROVIDERS.NANO,
      sceneIndex,
      taskId,
      attempt,
      state: data.state,
      resolution,
    });

    if (data.state === "success" && data.url) {
      addLog("success", "taskSuccess", {
        provider: PROVIDERS.NANO,
        sceneIndex,
        taskId,
        costTime: data.costTime,
      });
      return { url: data.url };
    }

    if (data.state === "fail") {
      addLog("error", "taskFail", {
        provider: PROVIDERS.NANO,
        sceneIndex,
        taskId,
        failMsg: data.failMsg,
      });
      const error = new Error(data.failMsg || "Nano 任务失败");
      error.details = `taskId=${taskId}`;
      throw error;
    }

    await sleep(NANO_CONFIG.pollIntervalMs);
  }

  const error = new Error(`Nano 轮询超时（${formatDurationMs(timeoutMs)}）`);
  error.details = `taskId=${taskId}, sceneIndex=${sceneIndex}, timeoutMs=${timeoutMs}`;
  throw error;
}

async function getNanoSceneUrl({ sceneImage, sceneIndex, sceneUrlCache }) {
  if (!sceneUrlCache.has(sceneIndex)) {
    const extension = getFileExtensionFromDataUrl(sceneImage);
    sceneUrlCache.set(
      sceneIndex,
      uploadNanoReferenceImage({
        dataUrl: sceneImage,
        filename: `scene-${sceneIndex}.${extension}`,
        role: "scene",
        sceneIndex,
      }),
    );
  }

  return sceneUrlCache.get(sceneIndex);
}

async function callNanoAPI({
  apiKey,
  sceneImage,
  characterUrl,
  prompt,
  size,
  sceneIndex,
  timeoutMs,
  sceneUrlCache,
}) {
  const sceneUrl = await getNanoSceneUrl({
    sceneImage,
    sceneIndex,
    sceneUrlCache,
  });
  const imageUrls = [];

  if (characterUrl) {
    imageUrls.push(characterUrl);
  }
  imageUrls.push(sceneUrl);

  const taskId = await createNanoTask({
    apiKey,
    prompt,
    imageUrls,
    resolution: size,
    sceneIndex,
  });

  return pollNanoTask({
    apiKey,
    taskId,
    resolution: size,
    sceneIndex,
    timeoutMs,
  });
}

async function callProviderAPI({
  provider,
  model,
  apiKey,
  sceneImage,
  characterImage,
  characterUrl,
  prompt,
  size,
  sceneIndex,
  timeoutMs,
  sceneUrlCache,
}) {
  if (provider === PROVIDERS.NANO) {
    return callNanoAPI({
      apiKey,
      sceneImage,
      characterUrl,
      prompt,
      size,
      sceneIndex,
      timeoutMs,
      sceneUrlCache,
    });
  }

  return callVolcengineAPI({
    model,
    apiKey,
    sceneImage,
    characterImage,
    prompt,
    size,
    sceneIndex,
    timeoutMs,
  });
}

function summarizeResponsePayload(data) {
  if (!data || typeof data !== "object") {
    return "empty response";
  }

  return JSON.stringify(
    {
      created: data.created,
      model: data.model,
      dataLength: Array.isArray(data.data) ? data.data.length : 0,
      hasFirstUrl: Boolean(data.data?.[0]?.url),
      error: data.error?.message || data.message,
    },
    null,
    2,
  );
}

DOM.generateBtn.addEventListener("click", async () => {
  // 获取配置
  const model = DOM.modelSelect.value;
  const provider = getProviderForModel(model);
  const apiKey = DOM.apiKeyInput.value.trim();
  const size = DOM.sizeSelect.value;
  const prompt = DOM.promptInput.value.trim();
  const sceneCount = AppState.sceneImages.length;
  const runId = `run-${Date.now()}`;

  clearLogs("准备开始新任务...");
  setRunContext(runId);
  addLog("info", "收到生成请求，开始执行前置校验", {
    runId,
  });

  // 验证 API Key
  if (!apiKey) {
    showToast("请输入 API Key", "error");
    addLog("error", "生成前校验失败", {
      reason: "缺少 API Key",
    });
    return;
  }

  // 检查是否有场景图
  if (sceneCount === 0) {
    showToast("请上传至少1张场景图", "error");
    addLog("error", "生成前校验失败", {
      reason: "未上传场景图",
    });
    return;
  }

  // 开始生成
  AppState.isGenerating = true;
  AppState.cancelRequested = false;
  AppState.results = [];
  DOM.generateBtn.disabled = true;
  DOM.cancelBtn.style.display = "inline-flex";
  DOM.cancelBtn.disabled = false;
  DOM.resultGrid.innerHTML = "";
  DOM.resultActions.style.display = "none";

  updateStatus(`准备生成 ${sceneCount} 张图片...`, true);
  addLog("info", "开始新的生成任务", {
    runId: AppState.currentRunId,
    provider,
    model,
    size,
    sceneCount,
    hasCharacterImage: AppState.characterImage ? "是" : "否",
    promptLength: prompt.length,
  });
  updateLogSummary(
    `任务 ${AppState.currentRunId} 进行中，待处理 ${sceneCount} 张场景图`,
  );

  try {
    // 批量处理场景图
    const results = [];
    const failed = [];
    let completed = 0;
    const startedAt = Date.now();
    const sceneUrlCache = new Map();
    let nanoCharacterUrl = null;

    const requestProfile = getRequestProfile({
      provider,
      hasCharacterImage: !!AppState.characterImage,
      size,
    });
    const { concurrency, timeoutMs } = requestProfile;
    addLog("info", "并发参数已锁定", {
      provider,
      concurrency,
      timeoutMs,
    });

    if (provider === PROVIDERS.NANO && AppState.characterImage) {
      const extension = getFileExtensionFromDataUrl(AppState.characterImage);
      nanoCharacterUrl = await uploadNanoReferenceImage({
        dataUrl: AppState.characterImage,
        filename: `character-reference.${extension}`,
        role: "character",
        sceneIndex: "shared",
      });
    }

    for (let i = 0; i < sceneCount; i += concurrency) {
      // 检查是否取消
      if (AppState.cancelRequested) {
        showToast("已取消生成", "info");
        addLog("warning", "检测到取消标记，停止后续批次");
        break;
      }

      const batch = AppState.sceneImages.slice(i, i + concurrency);
      const batchLabel = `${i + 1}-${i + batch.length}`;
      addLog("info", "开始处理批次", {
        batch: batchLabel,
        count: batch.length,
      });
      updateLogSummary(`正在处理批次 ${batchLabel}，总进度 ${completed}/${sceneCount}`);

      // 当前批次并发调用
      const batchPromises = batch.map(async (sceneImage, batchIndex) => {
        const globalIndex = i + batchIndex;

        // 再次检查是否取消
        if (AppState.cancelRequested) {
          addLog("warning", "请求在发出前被取消", {
            sceneIndex: globalIndex + 1,
          });
          return {
            success: false,
            error: "已取消",
            index: globalIndex,
            cancelled: true,
          };
        }

        try {
          // 构建提示词
          const fullPrompt = buildPrompt(sceneImage, prompt);
          addLog("info", "准备发起图片生成请求", {
            sceneIndex: globalIndex + 1,
            ...buildRequestSummary({
              provider,
              model,
              size,
              prompt: fullPrompt,
              imageCount: AppState.characterImage ? 2 : 1,
            }),
            timeoutMs,
          });

          // 调用API（带超时）
          const result = await callProviderAPI({
            provider,
            model,
            apiKey,
            sceneImage,
            characterImage: AppState.characterImage,
            characterUrl: nanoCharacterUrl,
            prompt: fullPrompt,
            size,
            sceneIndex: globalIndex + 1,
            timeoutMs,
            sceneUrlCache,
          });

          completed++;
          updateProgress(completed, sceneCount);
          updateLogSummary(`已完成 ${completed}/${sceneCount}，最近成功第 ${globalIndex + 1} 张`);

          // 立即显示结果
          if (result.url) {
            // 同时更新 AppState.results 以便 Lightbox 使用
            AppState.results.push({ url: result.url, sceneIndex: globalIndex });
            appendResultCard(result.url, AppState.results.length - 1);
            results.push({ url: result.url, sceneIndex: globalIndex });
            addLog("success", "图片生成成功", {
              sceneIndex: globalIndex + 1,
              outputIndex: AppState.results.length,
              url: result.url,
            });
          }

          return { success: true, result, index: globalIndex };
        } catch (error) {
          completed++;
          updateProgress(completed, sceneCount);
          const formattedError = formatError(error, {
            sceneIndex: globalIndex + 1,
          });
          console.warn(`第${globalIndex + 1}张场景图生成失败:`, error.message);
          addLog(
            "error",
            `第 ${globalIndex + 1} 张场景图生成失败：${formattedError.message}`,
            formattedError.meta,
          );
          updateLogSummary(`已完成 ${completed}/${sceneCount}，最近失败第 ${globalIndex + 1} 张`);

          return { success: false, error: error.message, index: globalIndex };
        }
      });

      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);

      // 收集结果
      batchResults.forEach((r) => {
        if (!r.success && !r.cancelled) {
          failed.push({ index: r.index, error: r.error });
        }
      });

      addLog("info", "批次处理结束", {
        batch: batchLabel,
        success: batchResults.filter((item) => item.success).length,
        failed: batchResults.filter((item) => !item.success && !item.cancelled).length,
        cancelled: batchResults.filter((item) => item.cancelled).length,
      });
    }

    // 生成完成
    const successCount = results.length;
    const failCount = failed.length;
    const durationMs = Date.now() - startedAt;

    if (successCount > 0) {
      DOM.resultActions.style.display = "flex";

      if (failCount > 0) {
        showToast(
          `生成完成：成功 ${successCount} 张，失败 ${failCount} 张`,
          "warning",
        );
        updateStatus(
          `已完成（成功${successCount}张，失败${failCount}张）`,
          true,
        );
        updateLogSummary(`任务完成：成功 ${successCount}，失败 ${failCount}`);
        addLog("warning", "任务完成，但存在失败项", {
          successCount,
          failCount,
          cancelled: AppState.cancelRequested ? "是" : "否",
          durationMs,
        });
      } else {
        showToast(`成功生成 ${successCount} 张图片！`, "success");
        updateStatus(`生成完成（${successCount}张）`, true);
        updateLogSummary(`任务完成：全部 ${successCount} 张生成成功`);
        addLog("success", "任务完成，全部图片生成成功", {
          successCount,
          durationMs,
        });

        // 全部成功时自动下载
        autoDownloadAllImages();
      }
    } else {
      showToast("没有成功生成任何图片", "error");
      updateStatus("生成失败", false);
      updateLogSummary("任务结束：没有成功结果");
      addLog("error", "任务结束，没有成功生成任何图片", {
        failCount,
        cancelled: AppState.cancelRequested ? "是" : "否",
        durationMs,
      });
      DOM.resultGrid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">❌</span>
          <p>生成失败，请重试</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("生成失败:", error);
    showToast(`生成失败: ${error.message}`, "error");
    updateStatus("生成失败", false);
    updateLogSummary("任务异常中断");
    const formattedError = formatError(error);
    addLog(
      "error",
      `任务执行过程中出现未捕获错误：${formattedError.message}`,
      formattedError.meta,
    );
  } finally {
    AppState.isGenerating = false;
    DOM.generateBtn.disabled = false;
    DOM.cancelBtn.style.display = "none";
    DOM.cancelBtn.textContent = "取消生成";
    addLog("info", "任务收尾完成", {
      runId: AppState.currentRunId,
      resultCount: AppState.results.length,
      cancelled: AppState.cancelRequested ? "是" : "否",
    });
  }
});

/**
 * 构建提示词
 */
function buildPrompt(sceneImage, userPrompt) {
  const hasCharacter = !!AppState.characterImage;

  if (hasCharacter) {
    // 有场景图 + 人物图：场景锁定，人物融入
    return `${PROMPT_CONFIG.sceneLock}

【用户要求】${userPrompt || "将人物自然融入场景中，姿势自然放松"}`;
  } else {
    // 只有场景图：场景锁定，文字生成人物
    return `${PROMPT_CONFIG.textGenerate}

【人物描述】${userPrompt || "一个自然站立的人，姿势放松，表情自然"}`;
  }
}

/**
 * 更新进度显示
 */
function updateProgress(completed, total) {
  const percent = Math.round((completed / total) * 100);
  updateStatus(`正在处理 ${completed}/${total} (${percent}%)`, true);
}

/**
 * 调用单个API（带超时）
 */
async function callVolcengineAPI({
  model,
  apiKey,
  sceneImage,
  characterImage,
  prompt,
  size,
  sceneIndex,
  timeoutMs,
}) {
  const controller = new AbortController();
  const effectiveTimeoutMs = timeoutMs || REQUEST_PROFILE.volcengineDefault.timeoutMs;
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

  try {
    // 构建请求体
    const requestBody = {
      model: model,
      prompt: prompt,
      size: size,
      response_format: "url",
      watermark: false,
    };

    // 传递图片
    const images = [];
    if (characterImage) images.push(characterImage);
    if (sceneImage) images.push(sceneImage);
    if (images.length > 0) {
      requestBody.image = images.length === 1 ? images[0] : images;
    }
    const requestSizeKb = estimateJsonSizeKb(requestBody);

    addLog("info", "请求已发送到图像生成接口", {
      sceneIndex,
      endpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      timeoutMs: effectiveTimeoutMs,
      imageCount: images.length,
      requestSizeKb,
    });

    const response = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);
    const { data, responseText, parseError } = await parseJsonSafely(response);

    addLog("info", "接口已返回响应", {
      sceneIndex,
      status: response.status,
      ok: response.ok ? "是" : "否",
    });

    if (!response.ok) {
      const error = new Error(
        data?.error?.message || data?.message || `API调用失败 (${response.status})`,
      );
      error.status = response.status;
      error.responseText = responseText?.slice(0, 500);
      if (parseError) {
        error.details = "错误响应不是合法 JSON";
      }
      throw error;
    }

    if (parseError) {
      const error = new Error("接口返回内容不是合法 JSON");
      error.status = response.status;
      error.responseText = responseText?.slice(0, 500);
      error.details = parseError.message;
      throw error;
    }

    // 解析结果
    if (data.data && data.data.length > 0 && data.data[0].url) {
      addLog("success", "接口返回了可用图片 URL", {
        sceneIndex,
        status: response.status,
        dataLength: data.data.length,
      });
      return { url: data.data[0].url };
    }

    const error = new Error("API未返回图片 URL");
    error.status = response.status;
    error.responseText = responseText?.slice(0, 500);
    error.details = summarizeResponsePayload(data);
    throw error;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutError = new Error(`生成超时（${formatDurationMs(effectiveTimeoutMs)}）`);
      timeoutError.details = `sceneIndex=${sceneIndex}, timeoutMs=${effectiveTimeoutMs}`;
      throw timeoutError;
    }
    throw error;
  }
}

// 取消生成
DOM.cancelBtn.addEventListener("click", () => {
  AppState.cancelRequested = true;
  DOM.cancelBtn.disabled = true;
  DOM.cancelBtn.textContent = "正在取消...";
  showToast("正在取消生成...", "info");
  updateLogSummary("已收到取消请求，等待当前批次收尾");
  addLog("warning", "用户点击了取消生成", {
    runId: AppState.currentRunId,
  });
});

/**
 * 逐张添加结果卡片（流式输出用）
 */
function appendResultCard(url, index) {
  // 创建卡片元素
  const card = document.createElement("div");
  card.className = "result-card fade-in";
  card.dataset.index = index;
  card.onclick = () => openLightbox(index);

  card.innerHTML = `
    <img src="${url}" alt="生成图片 ${index + 1}">
    <div class="overlay">
      <button class="download-btn" onclick="event.stopPropagation(); downloadSingleImage(${index})">
        下载
      </button>
    </div>
  `;

  // 添加到结果网格
  DOM.resultGrid.appendChild(card);
}

/**
 * 渲染生成结果
 */
function renderResults() {
  if (AppState.results.length === 0) {
    DOM.resultGrid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🖼️</span>
                <p>等待生成...</p>
            </div>
        `;
    DOM.resultActions.style.display = "none";
    return;
  }

  DOM.resultGrid.innerHTML = AppState.results
    .map(
      (img, index) => `
        <div class="result-card" data-index="${index}" onclick="openLightbox(${index})">
            <img src="${img.url}" alt="生成图片 ${index + 1}">
            <div class="overlay">
                <button class="download-btn" onclick="event.stopPropagation(); downloadSingleImage(${index})">
                    下载
                </button>
            </div>
        </div>
    `,
    )
    .join("");

  // 添加提示文字
  showToast("点击图片可预览大图", "info");

  DOM.resultActions.style.display = "flex";
}

/**
 * 下载单张图片
 */
async function downloadSingleImage(index) {
  if (AppState.results[index]) {
    const timestamp = new Date().toISOString().slice(0, 10);
    addLog("info", "开始下载单张图片", {
      index: index + 1,
      filename: `group-image-${timestamp}-${index + 1}.jpg`,
    });
    await downloadImage(
      AppState.results[index].url,
      `group-image-${timestamp}-${index + 1}.jpg`,
    );
    showToast("下载完成", "success");
    addLog("success", "单张图片下载完成", {
      index: index + 1,
    });
  }
}

// ========== 一键下载全部 ==========
DOM.downloadAllBtn.addEventListener("click", async () => {
  if (AppState.results.length === 0) {
    showToast("没有可下载的图片", "error");
    addLog("error", "批量下载失败", {
      reason: "当前没有可下载的结果",
    });
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const total = AppState.results.length;

  showToast(`开始下载 ${total} 张图片...`, "success");
  updateLogSummary(`开始批量下载 ${total} 张图片`);
  addLog("info", "开始批量下载图片", {
    total,
  });

  // 逐个下载，避免浏览器阻止
  for (let i = 0; i < total; i++) {
    const img = AppState.results[i];
    await downloadImage(img.url, `group-image-${timestamp}-${i + 1}.jpg`);

    // 更新进度
    if (i < total - 1) {
      updateStatus(`下载中... (${i + 1}/${total})`, true);
    }

    // 间隔500ms
    if (i < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  updateStatus(`下载完成 (${total}张)`, true);
  showToast(`已下载全部 ${total} 张图片！`, "success");
  updateLogSummary(`批量下载完成，共 ${total} 张`);
  addLog("success", "批量下载完成", {
    total,
  });
});

/**
 * 自动下载所有图片（生成完成后自动调用）
 */
async function autoDownloadAllImages() {
  const total = AppState.results.length;
  const timestamp = new Date().toISOString().slice(0, 10);
  addLog("info", "全部成功，开始自动下载", {
    total,
  });

  for (let i = 0; i < total; i++) {
    const img = AppState.results[i];
    await downloadImage(img.url, `group-image-${timestamp}-${i + 1}.jpg`);

    // 更新下载进度
    updateStatus(`下载中... (${i + 1}/${total})`, true);

    // 间隔500ms，避免浏览器阻止
    if (i < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  updateStatus(`已完成 (${total}张)`, true);
  showToast(`已自动下载全部 ${total} 张图片到本地！`, "success");
  updateLogSummary(`自动下载完成，共 ${total} 张`);
  addLog("success", "自动下载完成", {
    total,
    prefix: `group-image-${timestamp}-*.jpg`,
  });
}

// ========== Lightbox 图片预览功能 ==========

/**
 * 打开 Lightbox 预览
 */
function openLightbox(index) {
  if (AppState.results.length === 0) return;

  AppState.lightboxIndex = index;
  updateLightboxImage();
  DOM.lightbox.classList.add("active");

  // 禁止页面滚动
  document.body.style.overflow = "hidden";
}

/**
 * 关闭 Lightbox
 */
function closeLightbox() {
  DOM.lightbox.classList.remove("active");
  document.body.style.overflow = "";
}

/**
 * 更新 Lightbox 显示的图片
 */
function updateLightboxImage() {
  const total = AppState.results.length;
  const index = AppState.lightboxIndex;

  DOM.lightboxImage.src = AppState.results[index].url;
  DOM.lightboxCounter.textContent = `${index + 1} / ${total}`;
}

/**
 * 显示上一张
 */
function prevLightbox() {
  const total = AppState.results.length;
  AppState.lightboxIndex = (AppState.lightboxIndex - 1 + total) % total;
  updateLightboxImage();
}

/**
 * 显示下一张
 */
function nextLightbox() {
  const total = AppState.results.length;
  AppState.lightboxIndex = (AppState.lightboxIndex + 1) % total;
  updateLightboxImage();
}

/**
 * 从 Lightbox 下载当前图片
 */
function downloadFromLightbox() {
  downloadSingleImage(AppState.lightboxIndex);
}

// 绑定 Lightbox 事件
DOM.lightboxClose.addEventListener("click", closeLightbox);
DOM.lightboxPrev.addEventListener("click", prevLightbox);
DOM.lightboxNext.addEventListener("click", nextLightbox);
DOM.lightboxDownload.addEventListener("click", downloadFromLightbox);

// 点击背景关闭
DOM.lightbox.addEventListener("click", (e) => {
  if (e.target === DOM.lightbox) {
    closeLightbox();
  }
});

// 键盘控制
document.addEventListener("keydown", (e) => {
  if (!DOM.lightbox.classList.contains("active")) return;

  switch (e.key) {
    case "Escape":
      closeLightbox();
      break;
    case "ArrowLeft":
      prevLightbox();
      break;
    case "ArrowRight":
      nextLightbox();
      break;
  }
});

// ========== 初始化 ==========
clearLogs();
setRunContext("idle");
addLog("info", "页面初始化完成，日志面板已就绪");

console.log("========================================");
console.log("AI 组图生成工具 已启动");
console.log("========================================");
console.log("使用说明:");
console.log("1. 配置 API Key 和模型");
console.log("2. (可选) 上传人物图 - 保持人物特征");
console.log("3. 上传多张场景图 - 每张场景生成1张结果");
console.log("4. 输入描述内容");
console.log('5. 点击"生成组图"按钮');
console.log("6. 生成完成后可下载图片");
console.log("========================================");
console.log("提示：");
console.log("- 有场景图+人物图：场景不变，人物融入场景");
console.log("- 只有场景图：场景不变，文字生成人物");
console.log("- 都不上传：纯文字生成图片");
console.log("========================================");
