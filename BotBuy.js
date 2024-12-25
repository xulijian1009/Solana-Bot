const axios = require('axios');
const { Connection, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const dotenv = require('dotenv');
const { table } = require('table');
const fs = require('fs');
const xlsx = require('xlsx');
const { DateTime } = require('luxon');
const bs58 = require('bs58');
const solanaWeb3 = require('@solana/web3.js');
const { purchaseTokens } = require('./Trade.js'); // 引入 Trade.js 中的 purchaseTokens 函数
const { getTokenDetail } = require('./TokenDetail.js'); // 引入 TokenDetail.js 中的 getTokenDetail 函数
const { getTokenPrice } = require('./TokenPrice.js'); // 引入 TokenPrice.js 中的 getTokenPrice 函数
const { getTokenBalance } = require('./TokenBalance.js'); // 引入 TokenBalance.js 中的 fatchTokenBalance 函数

// 加载环境变量
dotenv.config();

// 配置常量
const RUGCHECK_API = process.env.RUGCHECK_API;
const OKX_DEX_TOKENS = process.env.OKX_DEX_TOKENS;

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const SCORE = process.env.SCORE;
const EXCEL_NAME = process.env.EXCEL_NAME;

const BUY_AMOUNT_SOL = process.env.BUY_AMOUNT_SOL;
const SLIP = process.env.SLIP;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL;

// 初始化 Solana 客户端和账户
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
// 解码 bs58 编码的私钥
const secretKey = bs58.decode(PRIVATE_KEY);

// 创建 Solana 密钥对
const keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);

// 保存买入记录到 Excel
function saveBuyRecord(tokenName, tokenAddress, tokenCount, tokenPrice) {
    try {
        const fileName = EXCEL_NAME;
        let workbook;

        workbook = xlsx.readFile(fileName);

        // 获取 Buy 工作表
        let sheet = workbook.Sheets['Buy'];

        // 新的行数据
        const newRow = [tokenName, tokenAddress, tokenCount, tokenPrice];
        xlsx.utils.sheet_add_aoa(sheet, [newRow], { origin: -1 });

        // 保存到 Excel 文件
        xlsx.writeFile(workbook, fileName);
        console.log(`买入 ${tokenName} 的记录  已成功保存至${EXCEL_NAME}`);
    } catch (e) {
        console.log(`写入买入数据失败: ${e.message}`);
    }
}

// 获取新代币列表
async function fetchNewTokens() {
    let validTokens = [];  // 存放符合条件的代币
    const tokenInfo = [];    // 用于存储表格数据

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
        const baseUrl = OKX_DEX_TOKENS;

        // 动态拼接 URL 参数
        const urlParams = Object.keys(config)
            .filter(key => config[key])  // 只拼接有值的参数
            .map(key => `${key}=${config[key]}`)
            .join('&');

        const url = `${baseUrl}?${urlParams}`;

        // 发送请求到 OKX API
        // console.log('请求 URL:', url);
        // console.log('请求头:', headers);
        const response = await axios.get(url, { headers });

        const tokenList = response.data.data.marketListsTokenInfos;

        // console.log(JSON.stringify(tokenList)); // 输出格式化的完整代币信息

        if (!Array.isArray(tokenList)) {
            console.log("tokenList 数据不是列表");
            return validTokens;
        }

        // console.log("查询到的 代币地址 列表:");
        let tokenAddresses = tokenList.map(token => token.tokenContractAddress).filter(Boolean);
        // console.log(tokenAddresses.join("\n"));

        for (let token of tokenList) {
            const tokenContractAddress = token.tokenContractAddress;
            if (!tokenContractAddress) continue;

            validTokens.push(token);

            const pairCreatedAt = Math.floor(token.firstPriceTime / 1000);  // 时间戳单位转换

            const currentTime = Math.floor(Date.now() / 1000);  // 当前时间戳
            const pairAge = currentTime - pairCreatedAt;  // 计算pair的年龄

            // 将毫秒数转换为小时数
            const pairAgeHours = Math.floor(pairAge / 60 / 60);

            // 转换为以万为单位的流动性
            const liquidityInWan = Math.floor(token.liquidity / 10000);

            

            // 将信息加入表格数据
            tokenInfo.push([
                token.tokenSymbol,
                `${liquidityInWan}万`,  // 转换为万为单位
                DateTime.fromSeconds(pairCreatedAt).toFormat('yyyy-MM-dd HH:mm:ss'),  // 格式化时间
                `${pairAgeHours}小时`,  // pair年龄
            ]);
        }
        // 打印符合条件的代币信息表格
        if (tokenInfo.length > 0) {
            console.log("以下是筛选出符合条件的代币数据......");
            console.log(table([["代币名称", "流动性(美元)", "创建时间", "交易时长"], ...tokenInfo]));
        }

        return validTokens;
    } catch (e) {
        console.log(`获取数据失败: ${e.message}`);
        return validTokens;
    }
}

// 获取指定代币的余额
async function fatchTokenBalance(tokenAddress) {
    try {
        const response = await getTokenBalance(keypair.publicKey.toBase58(),[tokenAddress]);
        // console.log(JSON.stringify(response.data[0].tokenAssets));
        return response.data[0].tokenAssets[0].balance;
    } catch (e) {
        console.error('获取代币余额时发生错误:', e.message);
        return 0;
    }
}

// 获取代币名称
async function fetchTokenName(tokenAddress) {
    try {
        const response = await getTokenDetail(tokenAddress);
        // console.log(JSON.stringify(response.data[0].symbol));
        return response.data[0].symbol;
    } catch (e) {
        console.error(`获取代币名称时出错: ${e.message}`);
        return 'Unknown Token';
    }
}

// 获取实时价格
async function fetchCurrentPrice(tokenAddress) {
    try {
        const response = await getTokenPrice([tokenAddress]);
        // console.log(JSON.stringify(response.data[0].price));
        return response.data[0].price;
    } catch (e) {
        console.error(`获取实时价格出错: ${e.message}`);
        return null;
    }
}



// 检查代币安全性
async function checkTokenSafety(tokenAddress) {
    try {
        const response = await axios.get(`${RUGCHECK_API}${tokenAddress}/report`);
        const safetyReport = response.data;
        return safetyReport.score;  // 返回安全状态
    } catch (e) {
        console.error(`检查代币 ${tokenAddress} 时出错: ${e.message}`);
        return SCORE;
    }
}

// 购买代币
async function buyToken(tokenAddress) {
    try {
        const sellSuccess = await purchaseTokens(tokenAddress,BUY_AMOUNT_SOL,SLIP);
        if (sellSuccess) {
            // console.log(`成功购买代币 ${tokenAddress}`);
            let tokenName = await fetchTokenName(tokenAddress);
            // let tokenCount = await fatchTokenBalance(tokenAddress);
            let tokenPrice = await fetchCurrentPrice(tokenAddress);
            console.log(`${tokenName}购买成功......购买价格 ${tokenPrice} 开始监控卖出......`);
            await saveBuyRecord(tokenName, tokenAddress, 0, tokenPrice);
            // console.log(`成功写入代币 ${tokenAddress}`);
        }
        return sellSuccess;
    } catch (e) {
        console.error(`购买代币 ${tokenAddress} 时出错: ${e.message}`);
        return false;
    }
}


// 主程序
async function main() {
    try{
        let processedTokens = new Set();

        // 从 Excel 文件加载已买入但未卖出的代币地址和买入价格
        try {
            const buyData = xlsx.readFile(EXCEL_NAME);
            const buySheet = buyData.Sheets['Buy'];
            if (buySheet) {
                let rows = xlsx.utils.sheet_to_json(buySheet);
                rows.forEach(row => {
                    processedTokens.add(row['代币地址']);
                });
            }
            // console.log('扫描到的购买记录', Array.from(processedTokens));
        } catch (e) {
            console.log('扫描购买记录失败');
        }
    
        while (true) {
            try {
                // 获取新的代币列表
                let newTokens = await fetchNewTokens();
    
                // 如果没有符合条件的代币，给出提示并等待
                if (newTokens.length === 0) {
                    console.log(`暂无符合购买条件的代币，${CHECK_INTERVAL / 1000} 秒后再次扫描`);
                }
    
                // console.log(JSON.stringify(newTokens)); // 输出格式化的完整代币信息
    
                // 处理新的代币
                for (let token of newTokens) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    let tokenAddress = token.tokenContractAddress;
                    let tokenSymbol = token.tokenSymbol;
                    if (processedTokens.has(tokenAddress)) {
                        console.log(`代币 ${tokenSymbol} 已购买过，不重复购买`);
                        continue;
                    }
    
                    let tokenBalance = await fatchTokenBalance(tokenAddress);
                    if (tokenBalance == 0) {
                        console.log(`未购买过代币 ${tokenSymbol}：${tokenSymbol}，执行购买操作`);
                    }else {
                        console.log(`钱包内 ${tokenSymbol} 代币余额 ${tokenBalance}，不重复购买`);
                        continue;
                    }
                    
                    // console.log(tokenAddress); // 输出格式化的完整代币信息
                    // console.log('调用checkTokenSafety检查安全性'); // 输出格式化的完整代币信息
                    let score = await checkTokenSafety(tokenAddress);
                    if (score < SCORE) {
                        console.log(`检测代币 ${tokenAddress} 安全  score = ${score}，执行购买操作.`);
                        // 如果购买成功，加入到监控列表
                        if (await buyToken(tokenAddress)) {
                            processedTokens.add(tokenAddress);
                        }
                    } else {
                        console.log(`检测代币 ${tokenAddress} 危险  score = ${score}，跳过购买.`);
                    }
                }
    
                const currentTime = new Date().toLocaleString();
                console.log(`[${currentTime}] 等待${CHECK_INTERVAL / 1000}秒后执行下一次循环......`);
    
            } catch (e) {
                console.error(`[${currentTime}] 程序循环发生异常: ${e.message}`);
            }
            // 每次循环完成后，间隔一段时间（CHECK_INTERVAL）
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL)); // 转换为毫秒
        }
    }catch(e){
        await main();
    }
    
}

main();

