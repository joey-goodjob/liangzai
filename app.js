/**
 * AI 模特工作室 - 主程序
 * 
 * 使用火山引擎（字节跳动）图片生成API
 */

// ========== 全局状态 ==========
const AppState = {
    selectedModel: null,      // 当前选中的模特
    candidates: [],           // 候选模特列表
    envImages: [],            // 已上传的环境图
    outputs: [],              // 输出结果
    isProcessing: false,      // 是否正在处理
    lightboxIndex: 0          // Lightbox 当前显示的图片索引
};

// ========== DOM 元素引用 ==========
const DOM = {
    // 第一步 - 模特生成
    modelDescription: document.getElementById('modelDescription'),
    refImageInput: document.getElementById('refImageInput'),
    refImagePreview: document.getElementById('refImagePreview'),
    refImageUpload: document.getElementById('refImageUpload'),
    generateModelBtn: document.getElementById('generateModelBtn'),
    candidateGrid: document.getElementById('candidateGrid'),
    selectedModel: document.getElementById('selectedModel'),
    changeModelBtn: document.getElementById('changeModelBtn'),
    templateList: document.getElementById('templateList'),
    
    // 第二步 - 批量融图
    envImagesInput: document.getElementById('envImagesInput'),
    envImagesUpload: document.getElementById('envImagesUpload'),
    envImagesList: document.getElementById('envImagesList'),
    positionPreference: document.getElementById('positionPreference'),
    sizePreference: document.getElementById('sizePreference'),
    startMergeBtn: document.getElementById('startMergeBtn'),
    outputGrid: document.getElementById('outputGrid'),
    outputActions: document.getElementById('outputActions'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    
    // 状态显示
    modelStatus: document.getElementById('modelStatus'),
    
    // 加载遮罩
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    progressFill: document.getElementById('progressFill'),
    
    // Toast提示
    toast: document.getElementById('toast'),
    
    // 图片预览模态框
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxClose: document.getElementById('lightboxClose'),
    lightboxPrev: document.getElementById('lightboxPrev'),
    lightboxNext: document.getElementById('lightboxNext'),
    lightboxCounter: document.getElementById('lightboxCounter'),
    lightboxSelect: document.getElementById('lightboxSelect')
};

// ========== 工具函数 ==========

/**
 * 显示Toast提示
 * @param {string} message - 提示消息
 * @param {string} type - 类型：'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
    DOM.toast.textContent = message;
    DOM.toast.className = `toast show ${type}`;
    setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 3000);
}

/**
 * 显示/隐藏加载遮罩
 * @param {boolean} show - 是否显示
 * @param {string} text - 加载文字
 * @param {number} progress - 进度百分比 (0-100)
 */
function setLoading(show, text = '处理中...', progress = 0) {
    DOM.loadingOverlay.classList.toggle('active', show);
    DOM.loadingText.textContent = text;
    DOM.progressFill.style.width = `${progress}%`;
}

/**
 * 将文件转换为Base64
 * @param {File} file - 文件对象
 * @returns {Promise<string>} - Base64字符串
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
 * 下载图片
 * @param {string} url - 图片URL
 * @param {string} filename - 文件名
 */
function downloadImage(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ========== Tab切换逻辑 ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // 切换按钮状态
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 切换内容区域
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabId}Tab`).classList.add('active');
    });
});

// ========== 第一步：模特生成 ==========

// 参考图上传 - 点击
DOM.refImageUpload.addEventListener('click', () => {
    DOM.refImageInput.click();
});

// 参考图上传 - 拖拽
DOM.refImageUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.refImageUpload.classList.add('dragover');
});

DOM.refImageUpload.addEventListener('dragleave', () => {
    DOM.refImageUpload.classList.remove('dragover');
});

DOM.refImageUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.refImageUpload.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleRefImage(file);
    }
});

// 参考图上传 - 文件选择
DOM.refImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleRefImage(file);
    }
});

/**
 * 处理参考图上传
 * @param {File} file - 图片文件
 */
async function handleRefImage(file) {
    const base64 = await fileToBase64(file);
    DOM.refImagePreview.src = base64;
    DOM.refImagePreview.style.display = 'block';
    DOM.refImageUpload.querySelector('.upload-placeholder').style.display = 'none';
}

// 生成模特按钮点击
DOM.generateModelBtn.addEventListener('click', async () => {
    const description = DOM.modelDescription.value.trim();
    const hasRefImage = DOM.refImagePreview.style.display !== 'none';
    
    if (!description && !hasRefImage) {
        showToast('请输入模特描述或上传参考图', 'error');
        return;
    }
    
    // 获取生成数量
    const numImages = API_CONFIG.generationParams.model.numImages || 4;
    
    // 先显示生成中的占位卡片
    showGeneratingPlaceholders(numImages);
    
    // 隐藏已选模特区域
    DOM.selectedModel.style.display = 'none';
    AppState.selectedModel = null;
    
    setLoading(true, '准备生成...', 0);
    
    let successCount = 0;
    
    // 定义进度回调
    const onProgress = (index, url, error) => {
        if (url) {
            // 成功生成一张
            addCandidateImage(index, url);
            successCount++;
            setLoading(true, `正在生成第 ${index + 1}/${numImages} 张...`, Math.round(((index + 1) / numImages) * 100));
        } else if (error) {
            // 生成失败
            console.error(`第 ${index + 1} 张生成失败:`, error);
        }
    };
    
    try {
        if (hasRefImage) {
            // 有参考图：使用图生图
            await VolcengineAPI.generateModelFromRef(
                DOM.refImagePreview.src, 
                description,
                onProgress
            );
        } else {
            // 纯文字描述：使用文生图
            await VolcengineAPI.generateModel(
                description,
                onProgress
            );
        }
        
        setLoading(false);
        
        if (successCount > 0) {
            showToast(`成功生成 ${successCount} 个候选模特`, 'success');
        } else {
            showToast('未能生成任何图片，请检查API配置或稍后重试', 'error');
        }
        
    } catch (error) {
        console.error('生成模特失败:', error);
        setLoading(false);
        showToast('生成失败: ' + error.message, 'error');
    }
});

/**
 * 显示候选模特
 * @param {string[]} candidates - 图片URL数组
 */
function displayCandidates(candidates) {
    AppState.candidates = candidates;
    
    DOM.candidateGrid.innerHTML = candidates.map((url, index) => `
        <div class="candidate-card" data-index="${index}">
            <img src="${url}" alt="候选模特 ${index + 1}">
            <span class="preview-hint">点击预览</span>
            <span class="select-badge">已选定</span>
        </div>
    `).join('');
    
    // 绑定点击事件 - 点击图片打开预览
    document.querySelectorAll('.candidate-card').forEach(card => {
        const img = card.querySelector('img');
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            openLightbox(parseInt(card.dataset.index));
        });
        
        // 双击直接选定
        card.addEventListener('dblclick', () => {
            selectModel(parseInt(card.dataset.index));
        });
        
        // 单击也选定（保持原有行为）
        card.addEventListener('click', () => {
            selectModel(parseInt(card.dataset.index));
        });
    });
}

/**
 * 添加单张候选图片（用于逐张生成）
 * @param {number} index - 图片索引
 * @param {string} url - 图片URL
 */
function addCandidateImage(index, url) {
    // 确保候选列表有足够空间
    while (AppState.candidates.length <= index) {
        AppState.candidates.push(null);
    }
    AppState.candidates[index] = url;
    
    // 检查是否需要创建新的卡片
    const existingCards = DOM.candidateGrid.querySelectorAll('.candidate-card');
    
    if (existingCards.length <= index) {
        // 移除空状态（如果存在）
        const emptyState = DOM.candidateGrid.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        // 创建新卡片
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.dataset.index = index;
        card.innerHTML = `
            <img src="${url}" alt="候选模特 ${index + 1}">
            <span class="preview-hint">点击预览</span>
            <span class="select-badge">已选定</span>
        `;
        
        // 绑定事件
        const img = card.querySelector('img');
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            openLightbox(index);
        });
        
        card.addEventListener('click', () => {
            selectModel(index);
        });
        
        DOM.candidateGrid.appendChild(card);
    } else {
        // 更新现有卡片
        const card = existingCards[index];
        if (card.classList.contains('generating')) {
            card.classList.remove('generating');
            card.innerHTML = `
                <img src="${url}" alt="候选模特 ${index + 1}">
                <span class="preview-hint">点击预览</span>
                <span class="select-badge">已选定</span>
            `;
            
            // 重新绑定事件
            const imgEl = card.querySelector('img');
            imgEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openLightbox(index);
            });
            
            card.addEventListener('click', () => {
                selectModel(index);
            });
        }
    }
}

/**
 * 显示生成中的占位卡片
 * @param {number} total - 总数量
 */
function showGeneratingPlaceholders(total) {
    // 清空候选区
    DOM.candidateGrid.innerHTML = '';
    AppState.candidates = [];
    
    // 创建占位卡片
    for (let i = 0; i < total; i++) {
        const card = document.createElement('div');
        card.className = 'candidate-card generating';
        card.dataset.index = i;
        DOM.candidateGrid.appendChild(card);
        AppState.candidates.push(null);
    }
}

/**
 * 选定模特
 * @param {number} index - 候选索引
 */
function selectModel(index) {
    // 更新选中状态
    document.querySelectorAll('.candidate-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });
    
    AppState.selectedModel = AppState.candidates[index];
    
    // 更新状态栏
    DOM.modelStatus.innerHTML = '<span class="status-dot active"></span> 模特: 已选定';
    
    // 显示已选模特信息
    DOM.selectedModel.style.display = 'block';
    DOM.selectedModel.querySelector('.selected-model-card').innerHTML = `
        <img src="${AppState.selectedModel}" alt="选定的模特">
        <div class="info">
            <p><strong>模特 #${index + 1}</strong></p>
            <p>点击下方按钮可更换</p>
        </div>
    `;
    
    // 更新融图按钮状态
    updateMergeButtonState();
    
    showToast('模特已选定，可以开始融图', 'success');
}

// 更换模特按钮
DOM.changeModelBtn.addEventListener('click', () => {
    AppState.selectedModel = null;
    DOM.selectedModel.style.display = 'none';
    document.querySelectorAll('.candidate-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    DOM.modelStatus.innerHTML = '<span class="status-dot"></span> 模特: 未选定';
    updateMergeButtonState();
});

// ========== 第二步：批量融图 ==========

// 环境图上传 - 点击
DOM.envImagesUpload.addEventListener('click', () => {
    DOM.envImagesInput.click();
});

// 环境图上传 - 拖拽
DOM.envImagesUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.envImagesUpload.classList.add('dragover');
});

DOM.envImagesUpload.addEventListener('dragleave', () => {
    DOM.envImagesUpload.classList.remove('dragover');
});

DOM.envImagesUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.envImagesUpload.classList.remove('dragover');
    handleEnvImages(e.dataTransfer.files);
});

// 环境图上传 - 文件选择
DOM.envImagesInput.addEventListener('change', (e) => {
    handleEnvImages(e.target.files);
});

/**
 * 处理环境图上传
 * @param {FileList} files - 文件列表
 */
async function handleEnvImages(files) {
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            const base64 = await fileToBase64(file);
            AppState.envImages.push({
                name: file.name,
                url: base64
            });
        }
    }
    renderEnvImagesList();
    updateMergeButtonState();
}

/**
 * 渲染环境图列表
 */
function renderEnvImagesList() {
    DOM.envImagesList.innerHTML = AppState.envImages.map((img, index) => `
        <div class="env-image-item" data-index="${index}">
            <img src="${img.url}" alt="${img.name}">
            <button class="remove-btn" onclick="removeEnvImage(${index})">×</button>
        </div>
    `).join('');
}

/**
 * 移除环境图
 * @param {number} index - 图片索引
 */
function removeEnvImage(index) {
    AppState.envImages.splice(index, 1);
    renderEnvImagesList();
    updateMergeButtonState();
}

/**
 * 更新融图按钮状态
 */
function updateMergeButtonState() {
    const canMerge = AppState.selectedModel && AppState.envImages.length > 0;
    DOM.startMergeBtn.disabled = !canMerge;
}

// 开始融图按钮点击
DOM.startMergeBtn.addEventListener('click', async () => {
    if (!AppState.selectedModel || AppState.envImages.length === 0) {
        showToast('请先选定模特并上传环境图', 'error');
        return;
    }
    
    AppState.outputs = [];
    DOM.outputGrid.innerHTML = '';
    
    const total = AppState.envImages.length;
    
    // 构建合成提示词
    const position = DOM.positionPreference.value;
    const size = DOM.sizePreference.value;
    
    let positionHint = '';
    switch(position) {
        case 'center': positionHint = '人物位于画面中央'; break;
        case 'left': positionHint = '人物位于画面左侧'; break;
        case 'right': positionHint = '人物位于画面右侧'; break;
        default: positionHint = '人物位置自然布局';
    }
    
    let sizeHint = '';
    switch(size) {
        case 'small': sizeHint = '人物较小，适合远景'; break;
        case 'medium': sizeHint = '人物中等大小'; break;
        case 'large': sizeHint = '人物较大，适合近景'; break;
        default: sizeHint = '';
    }
    
    const composePrompt = `将人物自然地合成到场景中，${positionHint}，${sizeHint}，保持光影一致，透视正确，风格协调，照片级真实感`;
    
    for (let i = 0; i < total; i++) {
        const envImage = AppState.envImages[i];
        const progress = Math.round(((i + 1) / total) * 100);
        
        setLoading(true, `正在处理第 ${i + 1}/${total} 张图片...`, progress);
        
        try {
            // 调用火山引擎API进行图像合成
            const resultUrl = await VolcengineAPI.composeImage(
                AppState.selectedModel,
                envImage.url,
                { prompt: composePrompt }
            );
            
            AppState.outputs.push({
                name: envImage.name,
                url: resultUrl
            });
            
            // 实时显示结果
            addOutputCard(resultUrl, envImage.name, i);
            
        } catch (error) {
            console.error(`处理 ${envImage.name} 失败:`, error);
            showToast(`${envImage.name} 处理失败: ${error.message}`, 'error');
        }
    }
    
    setLoading(false);
    
    if (AppState.outputs.length > 0) {
        DOM.outputActions.style.display = 'flex';
        showToast(`融图完成！共处理 ${AppState.outputs.length} 张图片`, 'success');
    } else {
        showToast('所有图片处理失败，请检查API配置', 'error');
    }
});

/**
 * 添加输出卡片
 * @param {string} url - 图片URL
 * @param {string} name - 文件名
 * @param {number} index - 索引
 */
function addOutputCard(url, name, index) {
    const card = document.createElement('div');
    card.className = 'output-card';
    card.innerHTML = `
        <img src="${url}" alt="${name}">
        <div class="overlay">
            <button class="download-btn" onclick="downloadImage('${url}', 'merged_${index + 1}.jpg')">
                下载
            </button>
        </div>
    `;
    DOM.outputGrid.appendChild(card);
}

// 全部下载按钮
DOM.downloadAllBtn.addEventListener('click', () => {
    if (AppState.outputs.length === 0) {
        showToast('没有可下载的图片', 'error');
        return;
    }
    
    AppState.outputs.forEach((output, index) => {
        setTimeout(() => {
            downloadImage(output.url, `merged_${index + 1}.jpg`);
        }, index * 500); // 间隔500ms下载，避免浏览器阻止
    });
    
    showToast('开始下载所有图片...', 'success');
});

// ========== 初始化 ==========
console.log('========================================');
console.log('AI 模特工作室 已启动');
console.log('========================================');
console.log('当前服务商: 火山引擎 (字节跳动)');
console.log('API端点:', API_CONFIG.volcengine.endpoint);
console.log('使用模型:', API_CONFIG.volcengine.modelForGeneration);
console.log('========================================');
console.log('提示：');
console.log('1. 在"定模特"区域输入描述或上传参考图');
console.log('2. 点击"生成候选模特"');
console.log('3. 选择一个满意的模特');
console.log('4. 上传环境图');
console.log('5. 点击"开始批量融图"');
console.log('========================================');

// ========== 模板初始化 ==========
function initTemplates() {
    const templates = API_CONFIG.templates || [];
    
    DOM.templateList.innerHTML = templates.map(t => `
        <button class="template-btn" data-description="${t.description}" title="${t.description}">
            <span class="icon">${t.icon}</span>
            <span class="name">${t.name}</span>
        </button>
    `).join('');
    
    // 绑定模板点击事件
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除其他选中状态
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            // 添加当前选中状态
            btn.classList.add('active');
            // 填入描述
            DOM.modelDescription.value = btn.dataset.description;
            // 切换到文字描述 Tab
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-tab="text"]').classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('textTab').classList.add('active');
        });
    });
}

// ========== Lightbox 图片预览功能 ==========

/**
 * 打开 Lightbox 预览
 * @param {number} index - 图片索引
 */
function openLightbox(index) {
    if (AppState.candidates.length === 0) return;
    
    AppState.lightboxIndex = index;
    updateLightboxImage();
    DOM.lightbox.classList.add('active');
    
    // 禁止页面滚动
    document.body.style.overflow = 'hidden';
}

/**
 * 关闭 Lightbox
 */
function closeLightbox() {
    DOM.lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * 更新 Lightbox 显示的图片
 */
function updateLightboxImage() {
    const total = AppState.candidates.length;
    const index = AppState.lightboxIndex;
    
    DOM.lightboxImage.src = AppState.candidates[index];
    DOM.lightboxCounter.textContent = `${index + 1} / ${total}`;
}

/**
 * 显示上一张
 */
function prevLightbox() {
    const total = AppState.candidates.length;
    AppState.lightboxIndex = (AppState.lightboxIndex - 1 + total) % total;
    updateLightboxImage();
}

/**
 * 显示下一张
 */
function nextLightbox() {
    const total = AppState.candidates.length;
    AppState.lightboxIndex = (AppState.lightboxIndex + 1) % total;
    updateLightboxImage();
}

/**
 * 从 Lightbox 中选定当前显示的模特
 */
function selectFromLightbox() {
    selectModel(AppState.lightboxIndex);
    closeLightbox();
}

// 绑定 Lightbox 事件
DOM.lightboxClose.addEventListener('click', closeLightbox);
DOM.lightboxPrev.addEventListener('click', prevLightbox);
DOM.lightboxNext.addEventListener('click', nextLightbox);
DOM.lightboxSelect.addEventListener('click', selectFromLightbox);

// 点击背景关闭
DOM.lightbox.addEventListener('click', (e) => {
    if (e.target === DOM.lightbox) {
        closeLightbox();
    }
});

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (!DOM.lightbox.classList.contains('active')) return;
    
    switch(e.key) {
        case 'Escape':
            closeLightbox();
            break;
        case 'ArrowLeft':
            prevLightbox();
            break;
        case 'ArrowRight':
            nextLightbox();
            break;
        case 'Enter':
            selectFromLightbox();
            break;
    }
});

// 页面加载完成后初始化模板
document.addEventListener('DOMContentLoaded', initTemplates);
// 如果 DOM 已经加载完成，立即初始化
if (document.readyState !== 'loading') {
    initTemplates();
}
