/**
 * API 配置文件
 * 
 * 当前使用：火山引擎（字节跳动）图片生成 API
 * 文档：https://www.volcengine.com/docs/82379/1299023
 */

const API_CONFIG = {
    // ========== 服务商配置 ==========
    provider: 'volcengine',
    
    // ========== 火山引擎 API 配置 ==========
    volcengine: {
        // API 端点
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        
        // 你的 API Key（从火山引擎控制台获取）
        apiKey: '19d0b662-ba7b-4565-99c2-7cec9e3e5f74',
        
        // 模型配置
        // 当前使用：doubao-seedream-5-0-260128（Seedream 5.0）
        modelForGeneration: 'doubao-seedream-5-0-260128',  // 用于生成模特
        modelForComposition: 'doubao-seedream-5-0-260128', // 用于融图合成
    },
    
    // ========== 生成参数 ==========
    generationParams: {
        // 模特生成参数
        model: {
            size: '2K',              // 图片尺寸：2K（Seedream 5.0 最低支持2K）
            // 其他可选尺寸：
            // 2K: 2048x2048, 2848x1600, 1600x2848, 2304x1728, 1728x2304
            // 或直接指定像素: 2048x2048
            // 4K: 4096x4096, 5504x3040, 3040x5504, 4704x3520, 3520x4704
            numImages: 4,            // 一次生成几张候选
            watermark: false,        // 是否添加水印
            responseFormat: 'url',   // 返回格式：'url' 或 'b64_json'
            outputFormat: 'png'      // 输出格式：'png' 或 'jpeg'（仅5.0支持）
        },
        
        // 图像合成参数
        composition: {
            size: '2K',              // 2K尺寸
            watermark: false,
            responseFormat: 'url',
            outputFormat: 'png'
        }
    },
    
    // ========== 提示词模板 ==========
    prompts: {
        // 模特生成的基础提示词（会自动加到用户描述前面）
        modelBase: '专业时尚摄影，全身照，高质量，细节丰富，照片级真实感，8K分辨率，',

        // 负面提示词（火山引擎会自动处理，这里备用）
        negative: '模糊，低质量，变形，畸形，水印，文字，logo'
    },

    // ========== 预设描述模板 ==========
    templates: [
        {
            id: 'professional_female',
            name: '职业女模',
            icon: '👩‍💼',
            description: '25岁职业女性，气质干练，穿西装，成熟优雅，职业感强'
        },
        {
            id: 'casual_style',
            name: '休闲风格',
            icon: '👕',
            description: '20岁女生，休闲装，自然微笑，阳光活力，清新可人'
        },
        {
            id: 'business_male',
            name: '高端商务',
            icon: '👔',
            description: '30岁男性，商务正装，成熟稳重，自信大方，精英气质'
        },
        {
            id: 'fresh_natural',
            name: '清新自然',
            icon: '🌿',
            description: '22岁女生，淡妆，户外自然光，清纯甜美，邻家女孩风格'
        },
        {
            id: 'fashion_model',
            name: '时尚超模',
            icon: '👗',
            description: '24岁女性，高级脸，身材高挑，时尚穿搭，国际范，冷艳气质'
        },
        {
            id: 'sports_fitness',
            name: '运动健身',
            icon: '🏃',
            description: '25岁男性，运动装，肌肉线条明显，阳光健康，活力四射'
        }
    ]
};

// ========== 火山引擎 API 调用器 ==========
const VolcengineAPI = {
    /**
     * 调用火山引擎图片生成API
     * @param {string} prompt - 提示词
     * @param {string|null} imageUrl - 输入图片URL或Base64（可选）
     * @param {object} params - 额外参数
     * @returns {Promise<object>} - API响应
     */
    async call(prompt, imageUrl = null, params = {}) {
        const config = API_CONFIG.volcengine;
        
        // 构建请求体
        const requestBody = {
            model: params.model || config.modelForGeneration,
            prompt: prompt,
            size: params.size || API_CONFIG.generationParams.model.size,
            response_format: params.responseFormat || API_CONFIG.generationParams.model.responseFormat,
            watermark: params.watermark !== undefined ? params.watermark : API_CONFIG.generationParams.model.watermark
        };
        
        // output_format 仅 5.0 模型支持
        if (params.outputFormat || API_CONFIG.generationParams.model.outputFormat) {
            requestBody.output_format = params.outputFormat || API_CONFIG.generationParams.model.outputFormat;
        }
        
        // 如果有输入图片（用于图生图或多图融合）
        if (imageUrl) {
            requestBody.image = imageUrl;
        }
        
        console.log('火山引擎API请求:', requestBody);
        
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误响应:', errorText);
            let errorMessage = `API调用失败 (${response.status})`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
            } catch (e) {
                // 无法解析为JSON，使用原始文本
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('火山引擎API响应:', data);
        
        // 检查是否有错误
        if (data.error) {
            throw new Error(data.error.message || '生成失败');
        }
        
        return data;
    },
    
    /**
     * 生成模特图片（文生图）
     * @param {string} description - 模特描述
     * @param {function} onProgress - 每张图片生成完成时的回调 (imageIndex, imageUrl)
     * @returns {Promise<string[]>} - 返回图片URL数组
     */
    async generateModel(description, onProgress = null) {
        const fullPrompt = API_CONFIG.prompts.modelBase + description;
        const params = {
            ...API_CONFIG.generationParams.model
        };
        
        // 由于API一次只能生成一张图，需要多次调用来生成多张候选
        const numImages = params.numImages || 4;
        const results = [];
        
        for (let i = 0; i < numImages; i++) {
            try {
                const data = await this.call(fullPrompt, null, params);
                if (data.data && data.data.length > 0) {
                    // 过滤掉有错误的图片
                    const validImages = data.data.filter(img => !img.error);
                    const newImages = validImages.map(img => img.url || `data:image/jpeg;base64,${img.b64_json}`);
                    
                    // 如果有回调，立即通知
                    if (onProgress && newImages.length > 0) {
                        onProgress(i, newImages[0]);
                    }
                    
                    results.push(...newImages);
                }
            } catch (error) {
                console.error(`生成第${i+1}张图片失败:`, error);
                // 即使失败也通知进度
                if (onProgress) {
                    onProgress(i, null, error);
                }
            }
        }
        
        return results;
    },
    
    /**
     * 合成模特到环境图（多图融合）
     * @param {string} modelImageUrl - 模特图片URL或Base64
     * @param {string} envImageUrl - 环境图片URL或Base64
     * @param {object} options - 合成选项
     * @returns {Promise<string>} - 返回合成后的图片URL
     */
    async composeImage(modelImageUrl, envImageUrl, options = {}) {
        // 构建融合提示词
        const prompt = options.prompt || 
            '将人物自然地融入到这个场景中，保持光影一致，透视正确，风格协调，照片级真实感';
        
        // 多图输入：传入模特图和环境图
        // 根据API文档，image参数可以是数组，支持多张参考图
        const images = [modelImageUrl];
        
        // 如果环境图也是Base64或URL，一起传入
        if (envImageUrl) {
            images.push(envImageUrl);
        }
        
        const params = {
            model: API_CONFIG.volcengine.modelForComposition,
            ...API_CONFIG.generationParams.composition,
            ...options
        };
        
        const data = await this.call(prompt, images, params);
        
        if (data.data && data.data.length > 0) {
            // 返回第一张有效图片
            const validImage = data.data.find(img => !img.error);
            if (validImage) {
                return validImage.url || `data:image/jpeg;base64,${validImage.b64_json}`;
            }
        }
        
        throw new Error('图像合成失败，未返回有效结果');
    },
    
    /**
     * 使用参考图生成模特（图生图）
     * @param {string} refImageUrl - 参考图片URL或Base64
     * @param {string} description - 描述
     * @param {function} onProgress - 每张图片生成完成时的回调 (imageIndex, imageUrl)
     * @returns {Promise<string[]>} - 返回图片URL数组
     */
    async generateModelFromRef(refImageUrl, description, onProgress = null) {
        const fullPrompt = API_CONFIG.prompts.modelBase + (description || '根据参考图生成模特');
        const params = {
            ...API_CONFIG.generationParams.model
        };
        
        // 生成多张候选
        const numImages = params.numImages || 4;
        const results = [];
        
        for (let i = 0; i < numImages; i++) {
            try {
                const data = await this.call(fullPrompt, [refImageUrl], params);
                if (data.data && data.data.length > 0) {
                    const validImages = data.data.filter(img => !img.error);
                    const newImages = validImages.map(img => img.url || `data:image/jpeg;base64,${img.b64_json}`);
                    
                    // 如果有回调，立即通知
                    if (onProgress && newImages.length > 0) {
                        onProgress(i, newImages[0]);
                    }
                    
                    results.push(...newImages);
                }
            } catch (error) {
                console.error(`生成第${i+1}张图片失败:`, error);
                if (onProgress) {
                    onProgress(i, null, error);
                }
            }
        }
        
        return results;
    }
};

// 导出（如果使用模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, VolcengineAPI };
}
