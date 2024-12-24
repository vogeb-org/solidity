# 开发环境配置

本指南将帮助您搭建 Solidity 智能合约开发环境。

## 开发工具选择

### 1. 在线 IDE

#### Remix IDE
- 优点：
  - 无需安装，直接使用
  - 内置编译器和调试工具
  - 支持部署和测试
  - 适合快速开发和学习
- 缺点：
  - 功能相对有限
  - 不适合大型项目
  - 网络依赖性强

### 2. 本地开发框架

#### Hardhat
- 优点：
  - 完整的开发环境
  - 强大的测试功能
  - 丰富的插件生态
  - TypeScript 支持
- 安装：
  ```bash
  npm init -y
  npm install --save-dev hardhat
  npx hardhat init
  ```

#### Foundry
- 优点：
  - 使用 Solidity 编写测试
  - 编译和测试速度快
  - 强大的模糊测试
  - 内置部署工具
- 安装：
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

## IDE 配置

### VS Code
1. 安装扩展：
   - Solidity + Hardhat
   - Solidity Visual Developer
   - Prettier - Code formatter

2. 推荐设置：
   ```json
   {
     "solidity.formatter": "prettier",
     "solidity.compileUsingRemoteVersion": "v0.8.20",
     "editor.formatOnSave": true
   }
   ```

### IntelliJ IDEA
1. 安装插件：
   - Solidity
   - EthereumJ

2. 配置编译器：
   - 设置 Solidity 编译器版本
   - 配置本地编译器路径

## 网络配置

### 1. 本地测试网络

#### Hardhat Network
```typescript
// hardhat.config.ts
module.exports = {
  networks: {
    hardhat: {
      chainId: 31337
    }
  }
};
```

#### Ganache
```bash
npm install -g ganache
ganache --port 8545
```

### 2. 公共测试网络

#### Sepolia
```typescript
// hardhat.config.ts
module.exports = {
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/YOUR-PROJECT-ID",
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

#### Mumbai (Polygon)
```typescript
module.exports = {
  networks: {
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

## 工具配置

### 1. 代码验证工具

#### Solhint
```bash
npm install --save-dev solhint
npx solhint init
```

配置文件 `.solhint.json`：
```json
{
  "extends": "solhint:recommended",
  "rules": {
    "compiler-version": ["error", "^0.8.0"],
    "func-visibility": ["error", {"ignoreConstructors": true}]
  }
}
```

#### Slither
```bash
pip3 install slither-analyzer
slither .
```

### 2. 测试工具

#### Mocha 配置
```typescript
// test/sample-test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Contract", function () {
  it("Should work", async function () {
    // 测试代码
  });
});
```

#### Gas 报告
```typescript
// hardhat.config.ts
module.exports = {
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: "YOUR-API-KEY"
  }
};
```

## 环境变量

### 1. 创建 .env 文件
```bash
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 2. 配置 .env 支持
```bash
npm install dotenv
```

```typescript
// hardhat.config.ts
import * as dotenv from "dotenv";
dotenv.config();
```

## 项目结构

推荐的项目结构：
```
project/
├── contracts/           # 智能合约源码
├── scripts/            # 部署脚本
├── test/               # 测试文件
├── hardhat.config.ts   # Hardhat 配置
├── .env               # 环境变量
├── .gitignore         # Git 忽略文件
└── package.json       # 项目配置
```

## 常见问题

### 1. 编译错误
- 检查 Solidity 版本
- 确保依赖正确安装
- 查看编译器错误信息

### 2. 网络连接问题
- 检查网络配置
- 确认 RPC URL 正确
- 验证账户余额

### 3. Gas 相关问题
- 使用 Gas 报告分析
- 优化合约代码
- 考虑使用 Layer 2 解决方案 