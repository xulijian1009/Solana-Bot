// 引入必需的库
const axios = require('axios');

async function getVerifiedToken() {
    try {

        // 请求头
        const headers = {
            'Content-Type': 'application/json'
        };

        // 基础 URL
        const url = 'https://api.rugcheck.xyz/v1/stats/verified';

        // 发送请求到 RugCheck API
        const response = await axios.get(url, { headers });

        const newTokens = response.data;

        // 如果没有符合条件的代币，给出提示并等待
        if (newTokens.length === 0) {
            console.log(`暂无近期验证通过的代币，1 分钟后再次扫描`);
        }

        console.log(JSON.stringify(newTokens)); // 输出格式化的完整代币信息

        // 处理新的代币
        for (let token of newTokens) {
            let tokenAddress = token.mint;
            let symbol = token.symbol;
            console.log(`代币 ${symbol}......代币地址......${tokenAddress}`);
            continue;
        }

    } catch (e) {
        console.error('获取代币时发生异常:', e);
    }
}

getVerifiedToken();
