# 快速开始

本指南将帮助您快速上手 Solidity 智能合约开发。

## 前置要求

在开始之前，请确保您已经：

1. 了解基本的编程概念
2. 熟悉 JavaScript/TypeScript（推荐）
3. 对区块链和智能合约有基本认识

## 第一个智能合约

让我们从一个简单的智能合约开始：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message;
    
    constructor(string memory _message) {
        message = _message;
    }
    
    function setMessage(string memory _message) public {
        message = _message;
    }
    
    function getMessage() public view returns (string memory) {
        return message;
    }
}
```

### 合约解释

1. `SPDX-License-Identifier`：声明代码的开源协议
2. `pragma solidity ^0.8.20`：指定编译器版本
3. `contract HelloWorld`：定义合约名称
4. `string public message`：声明状态变量
5. `constructor`：构造函数，部署时调用
6. `setMessage`：修改消息的函数
7. `getMessage`：读取消息的函数

## 部署和测试

### 使用 Remix IDE

1. 打开 [Remix IDE](https://remix.ethereum.org/)
2. 创建新文件 `HelloWorld.sol`
3. 复制上面的代码
4. 点击编译按钮
5. 在部署页面：
   - 选择环境（如 Remix VM）
   - 输入构造函数参数
   - 点击部署
6. 与合约交互：
   - 调用 `setMessage` 函数
   - 查看 `message` 变量的值

### 使用 Hardhat

1. 创建项目：
   ```bash
   mkdir my-project
   cd my-project
   npm init -y
   npm install --save-dev hardhat
   npx hardhat init
   ```

2. 创建合约：
   ```bash
   npx hardhat create HelloWorld.sol
   ```

3. 编写测试：
   ```typescript
   const { expect } = require("chai");
   
   describe("HelloWorld", function () {
     it("Should return the new message", async function () {
       const HelloWorld = await ethers.getContractFactory("HelloWorld");
       const hello = await HelloWorld.deploy("Hello, World!");
       await hello.deployed();
   
       expect(await hello.getMessage()).to.equal("Hello, World!");
   
       await hello.setMessage("Hello, Solidity!");
       expect(await hello.getMessage()).to.equal("Hello, Solidity!");
     });
   });
   ```

4. 运行测试：
   ```bash
   npx hardhat test
   ```

## 下一步

- 学习 [合约结构](/basic/contract-structure)
- 了解 [数据类型](/basic/data-types)
- 探索 [函数](/basic/functions)
- 实践 [修饰器](/basic/modifiers)

## 常见问题

### 1. 合约部署失败怎么办？
- 检查编译器版本是否正确
- 确保构造函数参数正确
- 查看错误信息进行调试

### 2. Gas 费用过高怎么处理？
- 优化合约代码
- 使用测试网进行开发
- 参考 [Gas 优化技巧](/basic/gas-optimization)

### 3. 如何调试合约？
- 使用 Remix 调试器
- 添加事件日志
- 编写单元测试 