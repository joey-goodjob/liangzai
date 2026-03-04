/**
 * AI 组图生成工具 - 主程序
 *
 * 功能：通过可视化界面调用火山引擎组图生成API
 */

// ========== 全局状态 ==========
const AppState = {
  characterImage: null, // 人物图 (单张 base64)
  sceneImage: null, // 场景图 (单张 base64)
  results: [], // 生成结果
  isGenerating: false, // 是否正在生成
  lightboxIndex: 0, // Lightbox 当前显示的图片索引
};

// ========== 场景锁定提示词配置 ==========
const PROMPT_CONFIG = {
  // 场景锁定指令
  sceneLock: `重要：场景背景必须完全保持不变，包括环境、光线、构图、透视。
将人物图片中的模特自然融入到场景中。
人物可以改变姿势、表情、视角角度，但场景绝对不能改变。
确保人物与场景的光影一致，透视正确，风格协调，照片级真实感。`,
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

  // 人物图
  characterUpload: document.getElementById("characterUpload"),
  characterImageInput: document.getElementById("characterImageInput"),
  characterPlaceholder: document.getElementById("characterPlaceholder"),
  characterPreview: document.getElementById("characterPreview"),
  characterPreviewImg: document.getElementById("characterPreviewImg"),
  removeCharacterBtn: document.getElementById("removeCharacterBtn"),

  // 场景图
  sceneUpload: document.getElementById("sceneUpload"),
  sceneImageInput: document.getElementById("sceneImageInput"),
  scenePlaceholder: document.getElementById("scenePlaceholder"),
  scenePreview: document.getElementById("scenePreview"),
  scenePreviewImg: document.getElementById("scenePreviewImg"),
  removeSceneBtn: document.getElementById("removeSceneBtn"),

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
}

// ========== 场景图上传 ==========

// 点击上传
DOM.sceneUpload.addEventListener("click", (e) => {
  // 如果点击的是删除按钮，不触发上传
  if (e.target.classList.contains("remove-btn")) return;
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
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleSceneImage(file);
  }
});

// 文件选择
DOM.sceneImageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleSceneImage(file);
  }
});

// 删除场景图
DOM.removeSceneBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearSceneImage();
});

/**
 * 处理场景图上传
 */
async function handleSceneImage(file) {
  const base64 = await fileToBase64(file);
  AppState.sceneImage = base64;

  // 显示预览
  DOM.scenePreviewImg.src = base64;
  DOM.scenePreview.style.display = "block";
  DOM.scenePlaceholder.style.display = "none";

  showToast("场景图已上传", "success");
}

/**
 * 清除场景图
 */
function clearSceneImage() {
  AppState.sceneImage = null;
  DOM.scenePreviewImg.src = "";
  DOM.scenePreview.style.display = "none";
  DOM.scenePlaceholder.style.display = "block";
  DOM.sceneImageInput.value = "";
  showToast("场景图已移除", "info");
}

// ========== 生成组图 ==========

DOM.generateBtn.addEventListener("click", async () => {
  // 获取配置
  const model = DOM.modelSelect.value;
  const apiKey = DOM.apiKeyInput.value.trim();
  const numImages = parseInt(DOM.numImagesInput.value) || 4;
  const size = DOM.sizeSelect.value;
  const prompt = DOM.promptInput.value.trim();

  // 验证 API Key
  if (!apiKey) {
    showToast("请输入 API Key", "error");
    return;
  }

  // 检查是否至少有场景图或人物图
  const hasCharacterImage = !!AppState.characterImage;
  const hasSceneImage = !!AppState.sceneImage;
  const hasPrompt = !!prompt;

  // 如果什么都没有，提示用户
  if (!hasCharacterImage && !hasSceneImage && !hasPrompt) {
    showToast("请上传场景图或人物图，或输入姿势描述", "error");
    return;
  }

  // 验证生成数量
  const inputImageCount = (hasCharacterImage ? 1 : 0) + (hasSceneImage ? 1 : 0);
  const maxImages = 15 - inputImageCount;
  
  if (numImages < 1 || numImages > maxImages) {
    showToast(`生成数量必须在 1-${maxImages} 之间`, "error");
    return;
  }

  const actualNumImages = Math.min(numImages, maxImages);

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
    // 根据上传的图片类型构建不同的提示词
    let fullPrompt = "";

    if (hasSceneImage && hasCharacterImage) {
      // 有场景图 + 人物图：场景锁定，人物换姿势
      fullPrompt = `${PROMPT_CONFIG.sceneLock}

用户姿势要求：${prompt || "生成人物在不同姿势下的组图"}`;
    } else if (hasSceneImage && !hasCharacterImage) {
      // 只有场景图：场景锁定，用文字生成人物
      fullPrompt = `重要：场景背景必须完全保持不变，包括环境、光线、构图、透视。
根据描述在这个场景中生成人物，人物要与场景光影一致，透视正确，风格协调，照片级真实感。

人物描述：${prompt || "自然站立的人物"}`;
    } else if (hasCharacterImage && !hasSceneImage) {
      // 只有人物图：保持人物特征，生成不同场景或姿势
      fullPrompt = `保持人物图片中人物的外貌特征、服装、风格完全一致。
${prompt || "生成人物在不同姿势和场景下的图片"}，照片级真实感。`;
    } else {
      // 纯文字生成
      fullPrompt = prompt;
    }

    // 如果是组图模式，添加数量说明
    if (actualNumImages > 1 && (hasSceneImage || hasCharacterImage)) {
      if (hasSceneImage && hasCharacterImage) {
        fullPrompt = `${PROMPT_CONFIG.sceneLock}

生成一组共${actualNumImages}张图片，人物在不同姿势下展示。
用户姿势要求：${prompt || "不同角度和姿势"}`;
      } else if (hasSceneImage) {
        fullPrompt = `重要：场景背景必须完全保持不变，包括环境、光线、构图、透视。
生成一组共${actualNumImages}张图片，根据描述在这个场景中生成人物。

人物描述：${prompt || "自然站立的人物，不同姿势"}`;
      } else if (hasCharacterImage) {
        fullPrompt = `保持人物图片中人物的外貌特征、服装、风格完全一致。
生成一组共${actualNumImages}张图片，${prompt || "人物在不同姿势和场景下展示"}，照片级真实感。`;
      }
    }

    // 构建请求体
    const requestBody = {
      model: model,
      prompt: fullPrompt,
      size: size,
      sequential_image_generation: "auto", // 组图模式
      sequential_image_generation_options: {
        max_images: actualNumImages,
      },
      stream: true, // 启用流式输出
      response_format: "url",
      watermark: false,
    };

    // 传递图片（如果有的话）
    const images = [];
    if (hasCharacterImage) images.push(AppState.characterImage);
    if (hasSceneImage) images.push(AppState.sceneImage);
    if (images.length > 0) {
      requestBody.image = images.length === 1 ? images[0] : images;
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
console.log("2. (可选) 上传人物图 - 保持人物特征");
console.log("3. (可选) 上传场景图 - 锁定场景不变");
console.log("4. 输入描述内容");
console.log('5. 点击"生成组图"按钮');
console.log("6. 生成完成后可下载图片");
console.log("========================================");
console.log("提示：");
console.log("- 有场景图+人物图：场景不变，人物换姿势");
console.log("- 只有场景图：场景不变，文字生成人物");
console.log("- 只有人物图：保持人物特征，换场景/姿势");
console.log("- 都不上传：纯文字生成图片");
console.log("========================================");
