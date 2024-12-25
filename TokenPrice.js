const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// OKX API 配置
const OKX_API_KEY = process.env.OKX_API_KEY;  //  OKX API Key
const OKX_API_SECRET = process.env.OKX_API_SECRET;  //  OKX API Secret
const OKX_API_PASSPHRASE = process.env.OKX_API_PASSPHRASE;  //  OKX API Passphrase
const OKX_API_PROJECT = process.env.OKX_API_PROJECT;  //  OKX API Project ID

const OKX_TOKEN_PRICE = process.env.OKX_TOKEN_PRICE;  //  OKX TOKEN PRICE
const OKX_TOKEN_PRICE_API = process.env.OKX_TOKEN_PRICE_API;  //  OKX TOKEN PRICE API


// 生成签名：根据请求方法（GET 或 POST）创建预签名字符串
function preHash(timestamp, method, requestPath, params) {
    try {
        let queryString = '';
        if (method === 'GET' && params) {
            queryString = '?' + new URLSearchParams(params).toString();  // 生成 queryString
        } else if (method === 'POST' && params) {
            queryString = JSON.stringify(params);  // 对 POST 请求参数进行 JSON 编码
        }
        return `${timestamp}${method}${requestPath}${queryString}`;
    } catch (e) {
        console.error('生成签名时发生错误:', e.message);
        return '';
    }
}


// 使用 HMAC SHA256 签名并返回 Base64 编码结果
function sign(message, secretKey) {
    try {
        const hmac = crypto.createHmac('sha256', secretKey);
        hmac.update(message);
        const signature = hmac.digest(); // 获取签名的二进制数据
        return Buffer.from(signature).toString('base64'); // 使用 Buffer 转换为 Base64 字符串
    } catch (e) {
        console.error('签名时发生错误:', e.message);
        return '';
    }
}


// 创建签名
function createSignature(method, requestPath, params) {
    try {
        const timestamp = new Date().toISOString();
        const message = preHash(timestamp, method, requestPath, params);
        const signature = sign(message, OKX_API_SECRET);
        return { signature, timestamp };
    } catch (e) {
        console.error('创建签名时发生错误:', e.message);
        return {};
    }
}

// 调用OKX的API获取代币实时价格
async function getTokenPrice(tokenAddress) {
    try {

        // 构建请求参数
        const params = tokenAddress.map(address => ({
            chainIndex: '501',  // 主网
            tokenAddress: address,
        }));

        // 构建 URL
        const requestPath = OKX_TOKEN_PRICE_API;

        // 创建签名
        const signatureData = await createSignature('POST', requestPath, params);
        if (!signatureData) {
            console.log('签名创建失败，无法继续请求');
            return null;
        }

        // 请求头
        const headers = {
            'OK-ACCESS-PROJECT': OKX_API_PROJECT,
            'OK-ACCESS-KEY': OKX_API_KEY,
            'OK-ACCESS-SIGN': signatureData.signature,
            'OK-ACCESS-PASSPHRASE': OKX_API_PASSPHRASE,
            'OK-ACCESS-TIMESTAMP': signatureData.timestamp,
            'Content-Type': 'application/json'
        };

        // console.log("签名:", signatureData.signature);
        // console.log("时间戳:", signatureData.timestamp);

        // 请求 URL
        const url = OKX_TOKEN_PRICE;

        // 发送请求到OKX API
        // console.log('请求 URL:', url);
        // console.log('请求参数:', params);
        // console.log('请求头:', headers);
        const response = await axios.post(url, params, {headers});

        const responseData = response.data;

        // console.log(JSON.stringify(responseData));

        return responseData;
    } catch (e) {
        console.error('查询代币时发生异常:', e.message);
    }
}


// 外部调用时传递tokenAddress
module.exports = {getTokenPrice};

// async function test(){
//     getTokenPrice(['Dhvwc4KqharM9Jg3yozKrRAr3k9qVvBFmY5QoECzpump']);
// }

// test();