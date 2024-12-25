const axios = require('axios');
const crypto = require('crypto');
const bs58 = require('bs58');
const dotenv = require('dotenv');
const solanaWeb3 = require('@solana/web3.js');
const {Connection, Keypair, LAMPORTS_PER_SOL} = require('@solana/web3.js');
const { getTokenBalance } = require('./TokenBalance.js'); // 引入 TokenBalance.js 中的 fatchTokenBalance 函数
const { getTokenDetail } = require('./TokenDetail.js'); // 引入 TokenDetail.js 中的 getTokenDetail 函数

// 加载环境变量
dotenv.config();

// OKX API 配置
const OKX_API_KEY = process.env.OKX_API_KEY;  //  OKX API Key
const OKX_API_SECRET = process.env.OKX_API_SECRET;  //  OKX API Secret
const OKX_API_PASSPHRASE = process.env.OKX_API_PASSPHRASE;  //  OKX API Passphrase
const OKX_API_PROJECT = process.env.OKX_API_PROJECT;  //  OKX API Project ID

const OKX_DEX_SWAP = process.env.OKX_DEX_SWAP;  //  OKX DEX SWAP
const OKX_DEX_SWAP_API = process.env.OKX_DEX_SWAP_API;  //  OKX DEX SWAP API
const OKX_SOL_ADDRESS = process.env.OKX_SOL_ADDRESS;  //  OKX SOL ADDRESS
const SOL_TX_URL = process.env.SOL_TX_URL;  //  SOL TX URL

// 设置Solana的RPC连接
const solanaRpcUrl = process.env.SOLANA_RPC_URL;
const connection = new Connection(solanaRpcUrl, 'confirmed');

// 用 bs58 编码的私钥
const secretKeybs58 = process.env.PRIVATE_KEY;

// 解码 bs58 编码的私钥
const secretKey = bs58.decode(secretKeybs58);

// 创建 Solana 密钥对
const keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);

// console.log("公钥:", keypair.publicKey.toBase58());

// 获取指定代币的余额
async function fatchTokenBalance(tokenAddress) {
    try {
        const balance = await getTokenBalance(keypair.publicKey.toBase58(),[tokenAddress]);
        const detail = await getTokenDetail(tokenAddress);
        // console.log(JSON.stringify(balance.data[0].tokenAssets));
        // console.log(JSON.stringify(detail.data[0].decimals));
        const scale = Math.pow(10, parseInt(detail.data[0].decimals));  // 将字符串 decimals 转换为整数并计算 10^precision
    
        // 转换为真实的余额（乘法）
        const realBalance = balance.data[0].tokenAssets[0].balance * scale;
        return realBalance;
    } catch (e) {
        console.error('获取代币余额时发生错误:', e.message);
        return 0;
    }
}

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

// 调用OKX的DEX交换API进行代币卖出
async function sellTokens(tokenContractAddress, slippage, scale) {
    try {
        // 获取当前代币余额
        const tokenBalance = await fatchTokenBalance(tokenContractAddress);
        // console.log(`当前代币余额: ${tokenBalance}......`);
        if (tokenBalance === 0) {
            console.log(`出售失败，未检查到可用的代币资产`);
            return false;
        }

        // 构建请求参数
        const params = {
            chainId: 501,  // 主网
            amount: String(tokenBalance * scale), //卖出代币的数量需要处理精度
            fromTokenAddress: tokenContractAddress,  // 来源代币合约地址
            toTokenAddress: OKX_SOL_ADDRESS,  // SOL 地址
            slippage,  // 滑点
            userWalletAddress: keypair.publicKey.toBase58(),  // Solana 地址需要转为字符串
        };

        // 构建 URL
        const requestPath = OKX_DEX_SWAP_API;

        // 创建签名
        const signatureData = await createSignature('GET', requestPath, params);
        if (!signatureData) {
            console.log('签名创建失败，无法继续请求');
            return false;
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
        const url = OKX_DEX_SWAP;

        // 发送请求到OKX API
        // console.log('请求 URL:', url);
        // console.log('请求参数:', params);
        // console.log('请求头:', headers);
        const response = await axios.get(url, {params, headers});

        const responseData = response.data;

        // console.log(responseData);

        // 检查返回的状态
        if (responseData.code === '0') {
            // 提取签名交易数据
            const tx = responseData.data[0].tx;
            // console.log("OKX返回的call_data:", tx);
            // 现在调用钱包API进行交易广播
            const sellSuccess = await sendTransaction(tx.data);
            return sellSuccess;
        } else {
            console.log(`OKX的DEX交换API请求失败，错误信息：${JSON.stringify(responseData)}`);
            return false;
        }
    } catch (e) {
        console.error('出售代币时发生异常:', e.message);
        return false;
    }
}

async function sendTransaction(callData) {
    try {
        // 解码交易数据
        const transaction = bs58.decode(callData);
        let tx;
        
        // 尝试解析为 Solana 交易，支持旧版本和新版本的 callData
        try {
            tx = solanaWeb3.Transaction.from(transaction);
        } catch (error) {
            tx = solanaWeb3.VersionedTransaction.deserialize(transaction);
        }

        // 获取最新的区块哈希
        const recentBlockHash = await connection.getLatestBlockhash();
        if (tx instanceof solanaWeb3.VersionedTransaction) {
            tx.message.recentBlockhash = recentBlockHash.blockhash;
        } else {
            tx.recentBlockhash = recentBlockHash.blockhash;
        }

        // 签名交易
        if (tx instanceof solanaWeb3.VersionedTransaction) {
            // v0 callData
            await tx.sign([keypair]);
        } else {
            // legacy callData
            tx.partialSign(keypair);
        }
        // console.log('交易对象:', tx);

        // 发送交易
        const txId = await connection.sendRawTransaction(tx.serialize());
        console.log('交易ID:', txId);

        // 确认交易是否已上链
        const confirmation = await connection.confirmTransaction(txId);
        if (confirmation.value.err) {
            throw new Error(`交易确认失败: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        console.log(`交易成功，查看详情: ${SOL_TX_URL}${txId}`);

        return true;
    } catch (e) {
        console.error('发送交易过程中发生错误:', e.message);
        return false;
    }
}


// 外部调用时传递tokenContractAddress, slippage
module.exports = {sellTokens};