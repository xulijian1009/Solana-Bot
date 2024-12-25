const axios = require('axios');

// RugCheck API 地址
const rugCheckApiUrl = 'https://api.rugcheck.xyz/v1/check';

// 查询合约地址的函数
async function checkAddress(address) {
    try {
        // 调用 RugCheck API
        const response = await axios.get(rugCheckApiUrl, {
            params: { address: address }
        });

        const data = response.data;
        
        // 处理返回的数据，检查合约标记是否为“良好”
        if (data && data.status === 'success') {
            const contractStatus = data.result.status; // "Good", "Warning", "Risky"
            const largeHolderControl = data.result.largeHolderControl; // 是否大户控制过多供应量
            const largeHolderThreshold = 0.05; // 设置大户控制供应量的阈值，假设5%

            if (contractStatus === 'Good' && largeHolderControl < largeHolderThreshold) {
                console.log('合约标记为“良好”，且大户控制供应量未超过阈值。');
            } else {
                console.log('合约存在风险或大户控制供应量过多。');
            }
        } else {
            console.log('查询失败，错误信息:', data.message);
        }
    } catch (error) {
        console.error('请求失败:', error);
    }
}

// 示例地址（用你实际想要检查的合约地址替换）
const contractAddress = '8cY5Bs11oBTzgeDrDBiGTsctnPoFDV1dQHbAJNtppuif';
checkAddress(contractAddress);
