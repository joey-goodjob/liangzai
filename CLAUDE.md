# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

AI 模特工作室 - 纯前端应用，使用火山引擎（字节跳动）图片生成 API 生成虚拟模特并合成到环境图片中。

**技术栈**：原生 HTML/CSS/JavaScript（无构建工具）
**API**：火山引擎图片生成 API - doubao-seedream-5-0-260128

## 核心需求

### 第一步：定模特
- **用户提供**：模特文字描述 或 模特参考图
- **AI 生成**：多版候选模特
- **用户确认**：选定 1 个最终 AI 模特（固定形象，后续不再改）

### 第二步：批量融图（1:1 严格对应）
- **用户上传**：任意数量的「无人环境图」（酒店大堂/房间/景区风景等）
- **AI 处理**：把已确认的模特，自然合成到每一张环境图里
- **输出规则**：传多少张，就出多少张；只加人，不改场景，不删不加图

## 运行项目

```bash
# 启动本地服务器（需要 Python 或 Node.js）
start-server.bat

# 或使用 VS Code Live Server 插件
```

- 主应用：http://localhost:8080/index.html
- API 测试页：http://localhost:8080/test.html
- Node.js API 测试：`node test-api.js`

## 架构

### 文件结构

```
ai-model-studio/
├── index.html        # 主应用入口
├── style.css         # 全部样式（CSS 变量主题系统）
├── app.js            # 主逻辑 + AppState 状态管理
├── api-config.js     # API 配置 + VolcengineAPI 封装
├── start-server.bat  # 本地服务器启动脚本
├── test.html         # API 测试页面
└── test-api.js       # Node.js API 测试脚本
```

### 核心状态（app.js 中的 AppState）

```javascript
{
  selectedModel: null,   // 选中的模特图片（URL 或 Base64）
  candidates: [],        // 候选模特图片列表
  envImages: [],         // 已上传的环境图片
  outputs: []            // 合成输出结果
}
```

### API 层（api-config.js）

`VolcengineAPI` 对象提供三个主要方法：
- `generateModel(description)` - 文生图
- `generateModelFromRef(refImageUrl, description)` - 图生图
- `composeImage(modelImageUrl, envImageUrl, options)` - 多图融合

### 工作流程

1. **第一步 - 定模特**：输入文字描述或上传参考图 → 生成候选 → 选择一个
2. **第二步 - 批量融图**：上传环境图 → 设置偏好 → 批量调用 API 合成

## API 配置

编辑 `api-config.js` 配置以下内容：
- `API_CONFIG.volcengine.apiKey` - 火山引擎 API Key
- `API_CONFIG.volcengine.modelForGeneration` - 模特生成使用的模型
- `API_CONFIG.volcengine.modelForComposition` - 融图合成使用的模型
- `API_CONFIG.generationParams` - 图片尺寸、水印、返回格式

## 注意事项

- API 返回的图片 URL 24 小时内有效
- 图片可返回 URL 或 Base64 格式（`response_format` 参数）
- 多图融合支持 2-14 张参考图
- API 文档参考：`../火山api文档.md`
