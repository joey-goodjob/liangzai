/**
 * AI 组图生成工具 - 主程序
 *
 * 功能：通过可视化界面调用火山引擎组图生成API
 */

// ========== 全局状态 ==========
const AppState = {
  refImages: [], // 参考图片列表 (base64)
  results: [], // 生成结果
  isGenerating: false, // 是否正在生成
  lightboxIndex: 0, // Lightbox 当前显示的图片索引
};

// ========== DOM 元素引用 ==========
const DOM = {
  // 配置
  modelSelect: document.getElementById("modelSelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  numImagesInput: document.getElementById("numImagesInput"),
  sizeSelect: document.getElementById("sizeSelect"),

  // 提示词
  promptInput: document.getElementById("promptInput"),
  charCount: document.getElementById("charCount"),

  // 参考图
  refImageUpload: document.getElementById("refImageUpload"),
  refImageInput: document.getElementById("refImageInput"),
  refImagesGrid: document.getElementById("refImagesGrid"),

  // 生成
  generateBtn: document.getElementById("generateBtn"),

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

// ========== 参考图片上传 ==========

// 点击上传
DOM.refImageUpload.addEventListener("click", () => {
  DOM.refImageInput.click();
});

// 拖拽上传
DOM.refImageUpload.addEventListener("dragover", (e) => {
  e.preventDefault();
  DOM.refImageUpload.classList.add("dragover");
});

DOM.refImageUpload.addEventListener("dragleave", () => {
  DOM.refImageUpload.classList.remove("dragover");
});

DOM.refImageUpload.addEventListener("drop", (e) => {
  e.preventDefault();
  DOM.refImageUpload.classList.remove("dragover");
  handleRefImages(e.dataTransfer.files);
});

// 文件选择
DOM.refImageInput.addEventListener("change", (e) => {
  handleRefImages(e.target.files);
});

/**
 * 处理参考图片上传
 */
async function handleRefImages(files) {
  const maxImages = 14;
  const currentCount = AppState.refImages.length;
  const availableSlots = maxImages - currentCount;

  if (availableSlots <= 0) {
    showToast("最多只能上传14张参考图片", "error");
    return;
  }

  const filesToProcess = Array.from(files).slice(0, availableSlots);

  for (const file of filesToProcess) {
    if (file.type.startsWith("image/")) {
      const base64 = await fileToBase64(file);
      AppState.refImages.push(base64);
    }
  }

  renderRefImages();

  if (files.length > availableSlots) {
    showToast(`已添加 ${filesToProcess.length} 张图片，已达上限`, "info");
  } else {
    showToast(`已添加 ${filesToProcess.length} 张参考图片`, "success");
  }
}

/**
 * 渲染参考图片列表
 */
function renderRefImages() {
  if (AppState.refImages.length === 0) {
    DOM.refImagesGrid.innerHTML = "";
    return;
  }

  DOM.refImagesGrid.innerHTML = AppState.refImages
    .map(
      (img, index) => `
        <div class="ref-image-item" data-index="${index}">
            <img src="${img}" alt="参考图 ${index + 1}">
            <button class="remove-btn" onclick="removeRefImage(${index})">×</button>
        </div>
    `,
    )
    .join("");
}

/**
 * 移除参考图片
 */
function removeRefImage(index) {
  AppState.refImages.splice(index, 1);
  renderRefImages();
}

// ========== 生成组图 ==========

DOM.generateBtn.addEventListener("click", async () => {
  // 获取配置
  const model = DOM.modelSelect.value;
  const apiKey = DOM.apiKeyInput.value.trim();
  const numImages = parseInt(DOM.numImagesInput.value) || 4;
  const size = DOM.sizeSelect.value;
  const prompt = DOM.promptInput.value.trim();

  // 验证
  if (!apiKey) {
    showToast("请输入 API Key", "error");
    return;
  }

  if (!prompt) {
    showToast("请输入提示词", "error");
    return;
  }

  if (numImages < 1 || numImages > 15) {
    showToast("生成数量必须在 1-15 之间", "error");
    return;
  }

  // 检查参考图数量限制
  // 输入的参考图数量 + 最终生成的图片数量 <= 15张
  const maxGeneratable = 15 - AppState.refImages.length;
  const actualNumImages = Math.min(numImages, maxGeneratable);

  if (AppState.refImages.length > 0 && actualNumImages < numImages) {
    showToast(
      `已有 ${AppState.refImages.length} 张参考图，最多可生成 ${maxGeneratable} 张`,
      "info",
    );
  }

  if (actualNumImages <= 0) {
    showToast("参考图已达上限，无法生成更多图片", "error");
    return;
  }

  // 开始生成
  AppState.isGenerating = true;
  AppState.results = [];
  DOM.generateBtn.disabled = true;
  DOM.resultGrid.innerHTML = "";
  DOM.resultActions.style.display = "none";

  updateStatus("正在生成...", true);

  // 流式模式：在结果区域显示进度，不使用全屏遮罩
  DOM.resultGrid.innerHTML = `
    <div class="streaming-progress">
      <div class="streaming-spinner"></div>
      <p class="streaming-text">正在调用API，准备生成...</p>
    </div>
  `;

  try {
    // 构建组图提示词（在用户提示词前加上组图引导）
    let groupPrompt = prompt;
    if (actualNumImages > 1) {
      // 检查用户提示词是否已包含"组"或"张"等关键词
      if (
        !prompt.includes("组") &&
        !prompt.includes("张") &&
        !prompt.includes("系列")
      ) {
        groupPrompt = `生成一组共${actualNumImages}张连贯图片：${prompt}`;
      }
    }

    // 构建请求体
    const requestBody = {
      model: model,
      prompt: groupPrompt,
      size: size,
      sequential_image_generation: "auto", // 组图模式
      sequential_image_generation_options: {
        max_images: actualNumImages,
      },
      stream: true, // 启用流式输出
      response_format: "url",
      watermark: false,
    };

    // 如果有参考图片
    if (AppState.refImages.length > 0) {
      requestBody.image =
        AppState.refImages.length === 1
          ? AppState.refImages[0]
          : AppState.refImages;
    }

    // 调用API
    const response = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
    );

    // 先检查HTTP响应状态
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || `API调用失败 (${response.status})`,
      );
    }

    // 流式读取响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let totalImages = actualNumImages;
    let completedImages = 0;

    // 初始化结果网格
    DOM.resultGrid.innerHTML = "";
    AppState.results = [];

    // 流式处理数据
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("流式读取完成");
        break;
      }

      // 解码数据块
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      console.log("收到数据块:", chunk.substring(0, 200)); // 调试日志

      // 解析 SSE 格式数据 (data: {...})
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 保留未完成的行

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        console.log("解析行:", trimmedLine.substring(0, 100)); // 调试日志

        if (trimmedLine.startsWith("data: ")) {
          const jsonStr = trimmedLine.slice(6).trim();

          // 跳过空行或结束标记
          if (!jsonStr || jsonStr === "[DONE]") {
            continue;
          }

          try {
            const data = JSON.parse(jsonStr);
            console.log("解析到的数据:", data); // 调试日志

            // 检查错误
            if (data.error) {
              throw new Error(data.error.message || "API返回错误");
            }

            // 处理单张图片生成成功的流式事件
            if (
              data.type === "image_generation.partial_succeeded" &&
              data.url
            ) {
              // 添加到结果数组
              AppState.results.push({
                url: data.url,
                size: data.size,
                imageIndex: data.image_index,
              });

              // 立即渲染这张图片
              appendResultCard(data.url, AppState.results.length - 1);

              completedImages++;

              // 更新状态栏进度
              updateStatus(
                `正在生成... (${completedImages}/${totalImages})`,
                true,
              );
            }

            // 兼容非流式格式（data.data 数组）
            if (data.data && data.data.length > 0) {
              for (const img of data.data) {
                if (img.url && !img.error) {
                  AppState.results.push({
                    url: img.url,
                    size: img.size,
                  });
                  appendResultCard(img.url, AppState.results.length - 1);
                  completedImages++;
                  updateStatus(
                    `正在生成... (${completedImages}/${totalImages})`,
                    true,
                  );
                }
              }
            }
          } catch (parseError) {
            console.warn("解析流数据失败:", parseError, jsonStr);
          }
        }
      }
    }

    // 检查是否成功生成图片
    if (AppState.results.length === 0) {
      throw new Error("没有成功生成任何图片");
    }

    // 完成并自动下载
    DOM.resultActions.style.display = "flex";
    showToast(
      `成功生成 ${AppState.results.length} 张图片！正在自动下载...`,
      "success",
    );
    updateStatus(`生成完成，正在下载...`, true);

    // 自动下载所有图片
    autoDownloadAllImages();
  } catch (error) {
    console.error("生成失败:", error);
    showToast(`生成失败: ${error.message}`, "error");
    updateStatus("生成失败", false);

    // 显示空状态
    DOM.resultGrid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">❌</span>
                <p>生成失败，请重试</p>
            </div>
        `;
  } finally {
    AppState.isGenerating = false;
    DOM.generateBtn.disabled = false;
  }
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
    await downloadImage(
      AppState.results[index].url,
      `group-image-${timestamp}-${index + 1}.jpg`,
    );
    showToast("下载完成", "success");
  }
}

// ========== 一键下载全部 ==========
DOM.downloadAllBtn.addEventListener("click", async () => {
  if (AppState.results.length === 0) {
    showToast("没有可下载的图片", "error");
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const total = AppState.results.length;

  showToast(`开始下载 ${total} 张图片...`, "success");

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
});

/**
 * 自动下载所有图片（生成完成后自动调用）
 */
async function autoDownloadAllImages() {
  const total = AppState.results.length;
  const timestamp = new Date().toISOString().slice(0, 10);

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
console.log("========================================");
console.log("AI 组图生成工具 已启动");
console.log("========================================");
console.log("使用说明:");
console.log("1. 配置 API Key 和模型");
console.log("2. 输入提示词描述想要的组图");
console.log("3. (可选) 上传参考图片");
console.log('4. 点击"生成组图"按钮');
console.log("5. 生成完成后可下载图片");
console.log("========================================");
