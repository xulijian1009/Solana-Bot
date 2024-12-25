// 引入必需的库
const axios = require('axios');
require('dotenv').config();  // 加载 .env 文件

async function getToken() {
    try {
        // 从环境变量获取参数
        const config = {
            chainIds: process.env.CHAIN_ID,
            changeMax: process.env.CHANGE_MAX,
            changeMin: process.env.CHANGE_MIN,
            changePeriod: process.env.CHANGE_PERIOD,
            desc: process.env.DESC,
            fdvMax: process.env.FDV_MAX,
            fdvMin: process.env.FDV_MIN,
            holdersMax: process.env.HOLDERS_MAX,
            holdersMin: process.env.HOLDERS_MIN,
            liquidityMax: process.env.LIQUIDITY_MAX,
            liquidityMin: process.env.LIQUIDITY_MIN,
            marketCapMax: process.env.MARKET_CAP_MAX,
            marketCapMin: process.env.MARKET_CAP_MIN,
            periodType: process.env.PERIOD_TYPE,
            rankBy: process.env.RANK_BY,
            riskFilter: process.env.RISK_FILTER,
            stableTokenFilter: process.env.STABLE_TOKEN_FILTER,
            tags: process.env.TAGS,
            tokenAgeMax: process.env.TOKEN_AGE_MAX,
            tokenAgeMin: process.env.TOKEN_AGE_MIN,
            tokenAgeType: process.env.TOKEN_AGE_TYPE,
            tradeNumMax: process.env.TRADE_NUM_MAX,
            tradeNumMin: process.env.TRADE_NUM_MIN,
            tradeNumPeriod: process.env.TRADE_NUM_PERIOD,
            txsMax: process.env.TXS_MAX,
            txsMin: process.env.TXS_MIN,
            txsPeriod: process.env.TXS_PERIOD,
            uniqueTraderMax: process.env.UNIQUE_TRADER_MAX,
            uniqueTraderMin: process.env.UNIQUE_TRADER_MIN,
            uniqueTraderPeriod: process.env.UNIQUE_TRADER_PERIOD,
            volumeMax: process.env.VOLUME_MAX,
            volumeMin: process.env.VOLUME_MIN,
            volumePeriod: process.env.VOLUME_PERIOD,
            totalPage: process.env.TOTAL_PAGE,
            page: process.env.PAGE,
            pageSize: process.env.PAGE_SIZE
        };

        // 请求头
        const headers = {
            'Content-Type': 'application/json'
        };

        // 基础 URL
        const baseUrl = 'https://www.okx.com/priapi/v1/dx/market/v2/advanced/ranking/content';

        // 动态拼接 URL 参数
        const urlParams = Object.keys(config)
            .filter(key => config[key])  // 只拼接有值的参数
            .map(key => `${key}=${config[key]}`)
            .join('&');

        const url = `${baseUrl}?${urlParams}`;

        // 发送请求到 OKX API
        console.log('请求 URL:', url);
        console.log('请求头:', headers);
        const response = await axios.get(url, { headers });

        const tokenList = response.data.data.marketListsTokenInfos;

        console.log(JSON.stringify(tokenList)); // 输出格式化的完整数组

        if (!Array.isArray(tokenList)) {
            console.log("tokens 数据不是列表");
        }

    } catch (e) {
        console.error('获取代币时发生异常:', e);
    }
}

getToken();
