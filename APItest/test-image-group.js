/**
 * 火山引擎 组图生成 API 测试脚本
 * 运行: node test-image-group.js
 *
 * 功能: 一次性生成多张风格统一的连贯图片（如四季变迁、系列插画等）
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ========== 配置 ==========
const CONFIG = {
  endpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
  apiKey: "19d0b662-ba7b-4565-99c2-7cec9e3e5f74",
  model: "doubao-seedream-4-5-251128",  // Seedream 4.5 模型ID
};

// ========== 组图生成函数 ==========
async function generateImageGroup(prompt, maxImages = 4) {
  console.log("========================================");
  console.log("🎨 火山引擎 组图生成 API 测试");
  console.log("========================================\n");

  console.log("📋 配置信息:");
  console.log(`   模型: ${CONFIG.model}`);
  console.log(`   生成数量: ${maxImages} 张`);
  console.log(`   API Key: ${CONFIG.apiKey.substring(0, 10)}...\n`);

  // 请求体 - 组图生成专用配置
  const requestBody = {
    model: CONFIG.model,
    prompt: prompt,
    size: "2K", // 图片尺寸：2K高清
    sequential_image_generation: "auto", // 组图生成模式：auto 自动
    sequential_image_generation_options: {
      max_images: maxImages, // 最多生成图片数量
    },
    stream: false, // 非流式响应
    // output_format 参数仅 5.0-lite 支持，4.5模型默认输出jpeg
    response_format: "url", // 返回图片URL
    watermark: false, // 不添加水印
  };

  console.log("📤 发送请求...");
  console.log(`   提示词: ${prompt}\n`);
  console.log("⏳ 组图生成中，请耐心等待（可能需要1-2分钟）...\n");

  const url = new URL(CONFIG.endpoint);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        console.log(`📥 响应状态: ${res.statusCode}`);

        try {
          const json = JSON.parse(data);

          if (res.statusCode === 200 && json.data) {
            console.log("\n✅ 组图生成成功!\n");
            console.log("📊 结果信息:");
            console.log(`   模型: ${json.model}`);
            console.log(`   生成图片数: ${json.data.length} 张`);

            // 显示每张图片的信息
            console.log("\n🖼️ 图片列表:");
            json.data.forEach((img, index) => {
              console.log(`   [${index + 1}] ${img.url}`);
            });

            console.log("\n========================================");
            console.log("🎉 组图生成完成！");
            console.log("========================================\n");
            resolve(json);
          } else {
            console.log("\n❌ 生成失败!\n");
            console.log("错误信息:", JSON.stringify(json, null, 2));
            reject(json);
          }
        } catch (e) {
          console.log("\n❌ 解析响应失败!");
          console.log("原始响应:", data);
          reject(e);
        }
      });
    });

    req.on("error", (e) => {
      console.log("\n❌ 请求失败!");
      console.log("错误:", e.message);
      reject(e);
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

// ========== 下载图片函数（可选）==========
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(filepath);
        });
      })
      .on("error", (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
  });
}

// ========== 主函数 ==========
async function main() {
  // 示例提示词：四季变迁组图
  const prompt =
    "生成一组共4张连贯插画，核心为同一庭院一角的四季变迁，以统一风格展现四季独特色彩、元素与氛围";

  try {
    const result = await generateImageGroup(prompt, 4);

    // 可选：下载所有图片到本地
    console.log("💾 是否要下载图片到本地？（当前仅显示URL）");
    console.log("   如需下载，请取消注释 main() 函数中的下载代码\n");

    // ========== 取消下面的注释可自动下载图片 ==========
    /*
        const downloadDir = path.join(__dirname, 'generated-images');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir);
        }
        
        console.log('📥 正在下载图片...');
        for (let i = 0; i < result.data.length; i++) {
            const img = result.data[i];
            const filename = `image-${i + 1}.png`;
            const filepath = path.join(downloadDir, filename);
            await downloadImage(img.url, filepath);
            console.log(`   ✓ 已保存: ${filename}`);
        }
        console.log('\n✅ 所有图片已保存到 generated-images 文件夹');
        */
  } catch (err) {
    console.log("\n生成结束");
    process.exit(1);
  }
}

// 运行主函数
main();
