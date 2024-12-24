# Solidity 映射（Mapping）

## 概述

本文档介绍了 Solidity 中的映射（Mapping）数据类型。映射是一种键值对的数据结构，用于存储和管理关联数据。它在智能合约中广泛用于管理用户余额、权限控制、数据存储等场景。

## 映射特性

### 1. 基本特点
- 所有可能的键都已被初始化（返回默认值）
- 无法获取映射的长度
- 无法直接遍历映射
- 键必须是内置类型
- 值可以是任何类型

### 2. 键的限制
- 可以使用的类型：
  - uint
  - address
  - bytes
  - string
  - bool
- 不能使用的类型：
  - 数组
  - 映射
  - 结构体

### 3. 值的特性
- 支持任何类型
- 包括自定义类型
- 可以是结构体
- 可以是数组
- 可以是另一个映射

## 详细说明

### 1. 基本映射

```solidity
contract MappingExample {
    // 基本映射示例
    mapping(address => uint) public balances;        // 地址到余额映射
    
    function demonstrateMapping() public {
        // 映射总是被初始化
        assert(balances[address(0)] == 0);      // 未赋值的键返回默认值
        
        // 设置值
        balances[msg.sender] = 100;
    }
}
```

### 2. 嵌套映射

```solidity
contract NestedMapping {
    // 嵌套映射示例
    mapping(address => mapping(uint => bool)) public userItemOwnership;
    
    function setOwnership(uint itemId, bool status) public {
        userItemOwnership[msg.sender][itemId] = status;
    }
}
```

### 3. 结构体映射

```solidity
contract StructMapping {
    struct User {
        string name;
        uint age;
    }
    
    mapping(address => User) public users;
    
    function setUserInfo(string memory _name, uint _age) public {
        users[msg.sender] = User(_name, _age);
    }
}
```

## 常见用途

### 1. 代币系统
- 用户余额管理
- 代币授权
- 交易记录
- 质押信息

### 2. 权限控制
- 角色管理
- 访问控制
- 白名单/黑名单
- 权限级别

### 3. 数据存储
- 用户信息
- 配置数据
- 状态记录
- 关系映射

### 4. 投票系统
- 投票记录
- 提案管理
- 权重分配
- 结果统计

## 最佳实践

### 1. 数据组织
- 合理设计键值结构
- 避免过深嵌套
- 考虑数据访问模式
- 优化存储成本

### 2. 遍历需求
```solidity
contract MappingWithIteration {
    mapping(address => uint) public balances;
    address[] public users;  // 存储所有用户地址
    
    function addUser() public {
        if(balances[msg.sender] == 0) {
            users.push(msg.sender);
        }
        balances[msg.sender] = 100;
    }
}
```

### 3. 安全考虑
- 访问控制
- 数据验证
- 溢出检查
- 权限管理

## 使用示例

### 1. 简单余额系统
```solidity
contract BalanceSystem {
    mapping(address => uint) public balances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}
```

### 2. 权限管理系统
```solidity
contract AccessControl {
    mapping(address => bool) public isAdmin;
    mapping(address => mapping(string => bool)) public permissions;
    
    function grantPermission(address user, string memory permission) public {
        require(isAdmin[msg.sender], "Only admin");
        permissions[user][permission] = true;
    }
}
```

### 3. 用户数据系统
```solidity
contract UserSystem {
    struct UserData {
        string name;
        uint age;
        bool active;
    }
    
    mapping(address => UserData) public users;
    
    function updateUser(string memory _name, uint _age) public {
        users[msg.sender].name = _name;
        users[msg.sender].age = _age;
        users[msg.sender].active = true;
    }
}
```

## 注意事项

### 1. 性能考虑
- 存储成本
- 读取效率
- 写入开销
- Gas 消耗

### 2. 设计限制
- 无法直接遍历
- 键类型限制
- 默认值特性
- 存储位置

### 3. 开发建议
- 清晰的数据结构
- 合理的键值设计
- 完善的错误处理
- 充分的测试验证

## 总结

映射是 Solidity 中重要的数据结构，合理使用映射可以：
- 高效管理关联数据
- 实现复杂的业务逻辑
- 优化存储结构
- 提高代码可维护性

通过正确使用映射，可以构建更加高效和可靠的智能合约。 