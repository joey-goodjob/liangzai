# AI 组图生成工具

基于火山引擎 Seedream 模型的组图生成 Web 应用。

## 项目结构

```
GUI/
├── image-group.html    # 主页面（HTML + 页面专用样式）
├── image-group.js      # 主程序（业务逻辑）
├── style.css           # 全局样式（设计系统 + 通用组件）
└── CLAUDE.md           # 本文档
```

## 技术栈

- **纯前端架构**：无框架依赖，原生 HTML/CSS/JavaScript
- **API**：火山引擎图像生成 API (`/api/v3/images/generations`)
- **模型**：Seedream 4.5 / Seedream 5.0

## 核心功能

| 功能模块 | 描述 |
|---------|------|
| API 配置 | 模型选择、API Key、生成数量(1-15)、图片尺寸(2K/4K) |
| 提示词输入 | 支持字数统计，建议不超过300汉字或600英文单词 |
| 参考图片上传 | 支持拖拽/点击上传，最多14张，格式 jpg/png/webp |
| 组图生成 | 自动添加组图引导词，调用火山引擎 API |
| 结果展示 | 网格布局展示，支持 Lightbox 大图预览 |
| 图片下载 | 单张下载 / 一键下载全部 |

## 架构设计

### 状态管理

```javascript
const AppState = {
  refImages: [],      // 参考图片列表 (base64)
  results: [],        // 生成结果
  isGenerating: false,
  lightboxIndex: 0,
};
```

### DOM 引用

所有 DOM 元素集中管理在 `DOM` 对象中，避免重复查询：

```javascript
const DOM = {
  modelSelect: document.getElementById("modelSelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  // ...
};
```

### CSS 设计系统

使用 CSS 变量定义主题：

```css
:root {
  --bg-primary: #0a0a0f;      /* 主背景 */
  --bg-secondary: #12121a;    /* 次级背景 */
  --bg-card: #1a1a24;         /* 卡片背景 */
  --accent-primary: #6366f1;  /* 主强调色 */
  --accent-secondary: #8b5cf6;/* 次强调色 */
  --border-color: #2a2a3a;    /* 边框色 */
  /* ... */
}
```

## API 调用规范

### 请求端点

```
POST https://ark.cn-beijing.volces.com/api/v3/images/generations
```

### 请求体结构

```javascript
{
  model: "doubao-seedream-4-5-251128",  // 或 "doubao-seedream-5-0-260128"
  prompt: "提示词内容",
  size: "2K",  // 或 "4K"
  sequential_image_generation: "auto",
  sequential_image_generation_options: {
    max_images: 4  // 1-15
  },
  stream: false,
  response_format: "url",
  watermark: false,
  image: [...]  // 可选，参考图片 base64 数组
}
```

### 响应结构

```javascript
{
  data: [
    { url: "https://...", size: "2048x2048" },
    // ...
  ]
}
```

## 关键业务规则

1. **图片数量限制**：参考图 + 生成图 ≤ 15 张
2. **参考图上限**：最多 14 张
3. **组图提示词**：自动检测并添加"生成一组共N张连贯图片"前缀
4. **下载间隔**：批量下载时每张间隔 500ms，避免浏览器阻止

## 开发指南

### 运行方式

直接用浏览器打开 `image-group.html` 即可，无需构建或服务器。

### 添加新功能

1. **新增配置项**：在 HTML 的 `.config-grid` 中添加，在 `DOM` 对象中引用
2. **新增 UI 组件**：优先复用 `style.css` 中的现有样式类
3. **状态变更**：统一在 `AppState` 中管理

### 代码规范

- 使用 `const`/`let`，避免 `var`
- 函数命名采用 camelCase
- DOM 操作集中在事件处理函数中
- 异步操作使用 `async/await`

## 注意事项

- API Key 直接存储在页面中（仅适用于开发/演示，生产环境应使用后端代理）
- 图片 base64 会占用大量内存，注意清理不需要的参考图
- Lightbox 打开时会禁止页面滚动（`body.overflow = hidden`）
