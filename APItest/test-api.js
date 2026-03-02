/**
 * 火山引擎 API 测试脚本
 * 运行: node test-api.js
 */

const https = require('https');

// ========== 配置 ==========
const CONFIG = {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    apiKey: '19d0b662-ba7b-4565-99c2-7cec9e3e5f74',
    model: 'doubao-seedream-5-0-260128'
};

// ========== 测试函数 ==========
async function testAPI() {
    console.log('========================================');
    console.log('🔥 火山引擎 API 测试');
    console.log('========================================\n');

    console.log('📋 配置信息:');
    console.log(`   模型: ${CONFIG.model}`);
    console.log(`   端点: ${CONFIG.endpoint}`);
    console.log(`   API Key: ${CONFIG.apiKey.substring(0, 10)}...\n`);

    // 请求体 - 按照官方示例
    const requestBody = {
        model: CONFIG.model,
        prompt: '一只可爱的橘猫坐在窗台上看风景，阳光照射，照片级真实感',
        size: '2K',
        output_format: 'png',
        watermark: false
    };

    console.log('📤 发送请求...');
    console.log(`   提示词: ${requestBody.prompt}\n`);

    const url = new URL(CONFIG.endpoint);
    
    const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.apiKey}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📥 响应状态: ${res.statusCode}`);
                
                try {
                    const json = JSON.parse(data);
                    
                    if (res.statusCode === 200 && json.data) {
                        console.log('\n✅ 测试成功!\n');
                        console.log('📊 结果信息:');
                        console.log(`   模型: ${json.model}`);
                        console.log(`   生成图片数: ${json.usage?.generated_images || 1}`);
                        console.log(`   图片尺寸: ${json.data[0]?.size || '未知'}`);
                        console.log(`   图片URL: ${json.data[0]?.url || '无'}`);
                        console.log('\n========================================');
                        console.log('🎉 API 配置正确，可以使用！');
                        console.log('========================================\n');
                        resolve(json);
                    } else {
                        console.log('\n❌ 测试失败!\n');
                        console.log('错误信息:', JSON.stringify(json, null, 2));
                        reject(json);
                    }
                } catch (e) {
                    console.log('\n❌ 解析响应失败!');
                    console.log('原始响应:', data);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.log('\n❌ 请求失败!');
            console.log('错误:', e.message);
            reject(e);
        });

        req.write(JSON.stringify(requestBody));
        req.end();
    });
}

// 运行测试
testAPI().catch(err => {
    console.log('\n测试结束');
    process.exit(1);
});
