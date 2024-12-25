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
const { sellTokens } = require('./Sell.js'); // 引入 Sell.js 中的 sellTokens 函数
const { getTokenDetail } = require('./TokenDetail.js'); // 引入 TokenDetail.js 中的 getTokenDetail 函数
const { getTokenPrice } = require('./TokenPrice.js'); // 引入 TokenPrice.js 中的 getTokenPrice 函数
const { getTokenBalance } = require('./TokenBalance.js'); // 引入 TokenBalance.js 中的 fatchTokenBalance 函数

// 加载环境变量
dotenv.config();

// 配置常量

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const SCORE = process.env.SCORE;
const EXCEL_NAME = process.env.EXCEL_NAME;

const SLIP = process.env.SLIP;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL;

// 初始化 Solana 客户端和账户
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
// 解码 bs58 编码的私钥
const secretKey = bs58.decode(PRIVATE_KEY);

// 创建 Solana 密钥对
const keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);

// 保存卖出记录到 Excel
function saveSellRecord(tokenName, tokenAddress, sellAmount, sellPrice) {
    try {
        const fileName = EXCEL_NAME;
        let workbook;

        workbook = xlsx.readFile(fileName);
        

        // 获取 Sell 工作表
        let sheet = workbook.Sheets['Sell'];
        
        // 新的行数据
        const newRow = [tokenName, tokenAddress, sellAmount, sellPrice];
        xlsx.utils.sheet_add_aoa(sheet, [newRow], { origin: -1 });

        // 保存到 Excel 文件
        xlsx.writeFile(workbook, fileName);
        console.log(`卖出 ${tokenName} 的记录  已成功保存至${EXCEL_NAME}`);
    } catch (e) {
        console.log(`写入卖出数据失败: ${e.message}`);
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


// 监控并卖出代币
async function monitorAndSell(tokenAddress, buyPrice) {
    try {
        let tokenSold = false;
        let currentPrice = await fetchCurrentPrice(tokenAddress);
        console.log(`购买价格：${buyPrice}，当前价格：${currentPrice}`);

        // 如果当前价格是购买价格的两倍，执行卖出
        if (currentPrice && currentPrice >= buyPrice * 2) {
            let tokenName = await fetchTokenName(tokenAddress);
            // let tokenCount = await fatchTokenBalance(tokenAddress);
            // 如果需要卖出全部代币，传递全部数量到 sellTokens 中
            const sellSuccess = await sellTokens(tokenAddress, SLIP, 0.8);
            if (sellSuccess) {
                // 记录卖出信息
                await saveSellRecord(tokenName, tokenAddress, 0, currentPrice);
                console.log(`成功卖出代币 ${tokenName}，已回本......`);
                tokenSold = sellSuccess; // 标记卖出成功
            }
        }else if (isRug(buyPrice,currentPrice)) {
            let tokenName = await fetchTokenName(tokenAddress);
            // let tokenCount = await fatchTokenBalance(tokenAddress);
            // 记录卖出信息
            await saveSellRecord(tokenName, tokenAddress, 0, 'RUG');
            console.log(`代币 ${tokenName} 已被判断为跑路，记录后不再监控......`);
            tokenSold = true; // 标记卖出成功
        }
        // else if (currentPrice && currentPrice <= buyPrice * 0.5) {
        //     //比购买价格下跌50%抛售
        //     let tokenName = await fetchTokenName(tokenAddress);
        //     let tokenCount = await fatchTokenBalance(tokenAddress);
        //     console.log(`代币 ${tokenName} 下跌幅度过大，抛售后不再监控......`);
        //     // 如果需要卖出全部代币，传递 1 到 sellTokens 中
        //     const sellSuccess = await sellTokens(tokenAddress, SLIP, 0.99);
        //     if (sellSuccess) {
        //         // 记录卖出信息
        //         await saveSellRecord(tokenName, tokenAddress, 'CUT', currentPrice);
        //         tokenSold = sellSuccess; // 标记卖出成功
        //     }
        // }

        return tokenSold; // 如果卖出成功，返回 true
    } catch (e) {
        console.error(`监控代币 ${tokenAddress} 时出错: ${e.message}`);
        return false; // 如果出错，返回 false
    }
}


// 判断代币是否跑路
function isRug(buyPrice, currentPrice) {
    try {
        if (buyPrice > 0 && currentPrice > 0) {
            const buyPriceFraction = buyPrice / 10000;
            return currentPrice < buyPriceFraction;
        }
    } catch (e) {
        console.error(`判断代币是否跑路: ${e.message}`);
    }
    return false;
}




// 主程序
async function main() {
    try{
        while (true) {
            try {
                let processedTokens = new Set();
                let tokenBuyPrices = {};
                // 从 Excel 文件加载已买入但未卖出的代币地址和买入价格
                try {
                    const buyData = xlsx.readFile(EXCEL_NAME);
                    const buySheet = buyData.Sheets['Buy'];
                    if (buySheet) {
                        let rows = xlsx.utils.sheet_to_json(buySheet);
                        rows.forEach(row => {
                            processedTokens.add(row['代币地址']);
                            tokenBuyPrices[row['代币地址']] = row['购买价格'];
                        });
                    }
                    // console.log('扫描到的购买记录', Array.from(processedTokens));
                } catch (e) {
                    console.log('扫描购买记录失败');
                }
    
                // 监控未卖出的代币
                let soldTokens = new Set();
                try {
                    const sellData = xlsx.readFile(EXCEL_NAME);
                    const sellSheet = sellData.Sheets['Sell'];
                    if (sellSheet) {
                        let rows = xlsx.utils.sheet_to_json(sellSheet);
                        rows.forEach(row => {
                            soldTokens.add(row['代币地址']);
                        });
                    }
                    // console.log('扫描到的出售记录', Array.from(soldTokens));
                } catch (e) {
                    console.log('扫描出售记录失败');
                }
    
                let tokensToMonitor = [...processedTokens].filter(token => !soldTokens.has(token));
    
                // 如果 tokensToMonitor 为空，输出提示并等待
                if (tokensToMonitor.length === 0) {
                    console.log(`暂无符合出售条件的代币，${CHECK_INTERVAL / 1000}秒后再次扫描......`);
                } else {
                    // 监控已购买但未卖出的代币
                    // console.log(`当前监控卖出的代币 ${tokensToMonitor}`);
                    for (let tokenAddress of tokensToMonitor) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        console.log(`监控卖出:  ${tokenAddress}`);
                        let buyPrice = tokenBuyPrices[tokenAddress];
                        if (buyPrice > 0) {
                            const sellSuccess = await monitorAndSell(tokenAddress, buyPrice);
                            if (sellSuccess) {
                                // 卖出成功后，移除监控列表
                                tokensToMonitor = tokensToMonitor.filter(token => token !== tokenAddress);
                                console.log(`代币 ${tokenAddress} 卖出成功，已从监控列表移除`);
                            }
                        }
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

