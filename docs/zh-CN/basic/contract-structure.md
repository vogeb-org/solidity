# Solidity 合约结构

## 概述

本文档介绍了 Solidity 智能合约的基本结构和组成部分。通过一个简单的示例合约，展示了合约的主要组成要素，包括状态变量、事件、构造函数、修饰器和函数等核心概念。

## 基本结构

一个标准的 Solidity 合约通常包含以下部分：

1. 许可证声明
2. 编译器版本声明
3. 合约声明
4. 状态变量
5. 事件
6. 构造函数
7. 修饰器
8. 函数

## 详细说明

### 1. 许可证声明
```solidity
// SPDX-License-Identifier: MIT
```
- 声明代码的开源许可证类型
- 建议在每个源文件开头添加
- MIT 是最常用的开源许可证之一

### 2. 编译器版本声明
```solidity
pragma solidity ^0.8.0;
```
- 指定合约使用的编译器版本
- `^` 表示向上兼容
- 可以指定具体版本或版本范围

### 3. 合约声明
```solidity
contract MyContract {
    // 合约内容
}
```
- 使用 `contract` 关键字声明
- 类似于面向对象编程中的类
- 包含合约的所有代码

### 4. 状态变量
```solidity
uint256 private number;
address public owner;
```
- 永久存储在区块链上的变量
- 可以设置访问修饰符：public、private、internal
- 常用类型：uint、address、bool、string 等

### 5. 事件
```solidity
event NumberChanged(uint256 newNumber);
```
- 用于记录合约状态变化
- 可以被外部监听和查询
- 通过 `emit` 关键字触发

### 6. 构造函数
```solidity
constructor() {
    owner = msg.sender;
}
```
- 合约部署时执行一次
- 用于初始化合约状态
- 可以接收部署参数

### 7. 修饰器
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}
```
- 用于函数的访问控制
- 可以在函数执行前后添加逻辑
- `_` 表示执行被修饰的函数体

### 8. 函数
```solidity
function setNumber(uint256 _number) public onlyOwner {
    number = _number;
    emit NumberChanged(_number);
}

function getNumber() public view returns (uint256) {
    return number;
}
```
- 合约的功能实现
- 可以设置可见性：public、private、internal、external
- 可以添加修饰符：view、pure、payable 等

## 最佳实践

1. 代码组织
   - 按类型分组组织代码
   - 相关功能放在一起
   - 保持代码结构清晰

2. 命名规范
   - 合约名使用大驼峰
   - 函数名和变量名使用小驼峰
   - 私有变量前缀下划线

3. 注释规范
   - 重要逻辑添加注释
   - 使用 NatSpec 格式
   - 说明函数用途和参数含义

4. 安全考虑
   - 合理使用访问控制
   - 检查输入参数
   - 考虑边界情况

## 注意事项

1. 状态变量
   - 谨慎使用 public
   - 考虑存储成本
   - 合理设置类型大小

2. 函数设计
   - 单一职责原则
   - 参数验证
   - 返回值规范

3. 事件使用
   - 重要状态变更记录
   - 合理设计事件参数
   - 考虑索引字段

4. 修饰器
   - 避免复杂逻辑
   - 注意重入风险
   - 合理使用组合

## 示例代码

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    // 状态变量
    uint256 private number;
    address public owner;
    
    // 事件
    event NumberChanged(uint256 newNumber);
    
    // 构造函数
    constructor() {
        owner = msg.sender;
    }
    
    // 修饰器
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // 函数
    function setNumber(uint256 _number) public onlyOwner {
        number = _number;
        emit NumberChanged(_number);
    }
    
    function getNumber() public view returns (uint256) {
        return number;
    }
}
```

## 总结

合约结构是 Solidity 开发的基础，良好的结构设计可以提高代码的可读性、可维护性和安全性。通过合理组织代码结构，使用适当的访问控制和事件机制，可以开发出高质量的智能合约。 