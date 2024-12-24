# Solidity 数据类型

## 概述

本文档介绍了 Solidity 中的主要数据类型，包括基本类型、引用类型、常量和不可变变量等。通过示例代码展示了各种数据类型的声明和使用方法。

## 数据类型分类

### 1. 基本类型（Value Types）
- 整数类型（Integer）
- 地址类型（Address）
- 布尔类型（Boolean）
- 字符串类型（String）
- 字节类型（Bytes）

### 2. 引用类型（Reference Types）
- 数组（Array）
- 映射（Mapping）
- 结构体（Struct）

### 3. 特殊类型
- 常量（Constant）
- 不可变量（Immutable）

## 详细说明

### 1. 基本类型

#### 整数类型
```solidity
uint256 public number;
```
- uint：无符号整数，范围 0 到 2^256-1
- int：有符号整数
- 可以指定位数：uint8 到 uint256，默认 uint256
- 常用于计数、金额等

#### 地址类型
```solidity
address public owner;
```
- 存储 20 字节的以太坊地址
- 可以是普通地址或合约地址
- 有 payable 和非 payable 两种形式

#### 布尔类型
```solidity
bool public isActive;
```
- 值为 true 或 false
- 用于条件判断和状态标记
- 默认值为 false

#### 字符串类型
```solidity
string public name;
```
- 用于存储文本数据
- 实际是特殊的字节数组
- 存储成本较高

### 2. 引用类型

#### 数组
```solidity
uint[] public numbers;
```
- 可以是固定长度或动态长度
- 元素类型必须相同
- 支持多维数组

#### 映射
```solidity
mapping(address => uint) public balances;
```
- 键值对存储结构
- 键类型有限制
- 值类型可以是任意类型
- 不支持遍历

### 3. 特殊类型

#### 常量
```solidity
uint256 public constant MAX_SUPPLY = 1000;
```
- 使用 constant 关键字
- 必须在声明时初始化
- 不能被修改
- 节省 gas 费用

#### 不可变量
```solidity
uint256 immutable public createdAt;
```
- 使用 immutable 关键字
- 可以在构造函数中赋值
- 赋值后不能修改
- 比常规状态变量节省 gas

## 数据类型特点

### 1. 存储位置
- storage：永久存储，状态变量
- memory：临时存储，函数参数和返回值
- calldata：只读存储，外部函数参数

### 2. 默认值
- uint：0
- bool：false
- address：0x0
- string：""
- array：[]
- mapping：所有键映射到默认值

### 3. 类型转换
- 隐式转换：小类型到大类型
- 显式转换：需要强制类型转换
- 地址转换：需要特殊处理

## 使用示例

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataTypes {
    // 基本类型
    uint256 public number;         // 无符号整数
    address public owner;          // 地址类型
    bool public isActive;          // 布尔类型
    string public name;            // 字符串
    
    // 引用类型
    uint[] public numbers;         // 动态数组
    mapping(address => uint) public balances;  // 映射
    
    // 常量和不可变变量
    uint256 public constant MAX_SUPPLY = 1000;  // 常量
    uint256 immutable public createdAt;         // 不可变量
    
    constructor() {
        createdAt = block.timestamp;
    }
}
```

## 最佳实践

1. 类型选择
   - 使用最小够用的类型
   - 考虑 gas 成本
   - 注意数值范围

2. 存储优化
   - 合理使用 storage/memory
   - 压缩数据结构
   - 避免不必要的状态变量

3. 安全考虑
   - 防止整数溢出
   - 注意类型转换安全
   - 考虑边界情况

## 注意事项

1. 数值处理
   - 注意整数溢出
   - 考虑除法精度损失
   - 使用安全数学库

2. 引用类型
   - 注意存储位置
   - 考虑 gas 消耗
   - 合理设计数据结构

3. 常量和不可变量
   - 优先使用 constant
   - 合理使用 immutable
   - 提高代码可维护性

## 总结

Solidity 提供了丰富的数据类型支持，合理使用这些类型可以：
- 提高代码效率
- 优化存储成本
- 增强合约安全性
- 提升代码可读性 