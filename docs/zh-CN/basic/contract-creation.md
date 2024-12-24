# Solidity 创建合约

## 概述

本文档介绍了 Solidity 中创建合约的各种方式和模式。包括使用 new 关键字、create2 操作码、最小代理模式等不同的合约创建方法，以及工厂模式的实现。

## 创建方式

### 1. new 关键字
- 最基本的创建方式
- 支持构造函数参数
- 可以发送以太币
- 地址是确定的

### 2. create2 操作码
- 可预测地址
- 使用 salt 值
- 支持确定性部署
- 适合二层解决方案

### 3. 最小代理模式
- 克隆现有合约
- 节省 gas 成本
- 共享实现逻辑
- 适合批量部署

## 详细说明

### 1. 基本合约创建

```solidity
// 子合约
contract Child {
    uint public value;
    address public owner;
    
    constructor(uint _value) {
        value = _value;
        owner = msg.sender;
    }
}

// 工厂合约
contract Factory {
    Child[] public children;
    
    function createChild(uint _value) public {
        Child child = new Child(_value);
        children.push(child);
    }
    
    function createChildWithEther(uint _value) public payable {
        Child child = new Child{value: msg.value}(_value);
        children.push(child);
    }
}
```

### 2. Create2 部署

```solidity
contract Factory2 {
    event ContractCreated(address indexed childAddress);
    
    function createChild2(uint _value, bytes32 _salt) public {
        Child child = new Child{salt: _salt}(_value);
        emit ContractCreated(address(child));
    }
    
    function predictAddress(bytes32 _salt, uint _value) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(Child).creationCode,
            abi.encode(_value)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint(hash)));
    }
}
```

### 3. 最小代理模式

```solidity
contract CloneFactory {
    address public implementation;
    
    constructor(address _implementation) {
        implementation = _implementation;
    }
    
    function createClone() public returns (address) {
        bytes20 targetBytes = bytes20(implementation);
        address clone;
        
        assembly {
            let clone_code := mload(0x40)
            mstore(clone_code, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone_code, 0x14), targetBytes)
            mstore(add(clone_code, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            clone := create(0, clone_code, 0x37)
        }
        
        return clone;
    }
}
```

## 高级模式

### 1. 高级工厂模式

```solidity
contract AdvancedFactory {
    event ContractCreated(address indexed creator, address indexed newContract);
    mapping(address => address[]) public createdContracts;
    
    function createContract(uint _value, bytes32 _salt) public payable returns (address) {
        Child child = new Child{salt: _salt, value: msg.value}(_value);
        createdContracts[msg.sender].push(address(child));
        emit ContractCreated(msg.sender, address(child));
        return address(child);
    }
    
    function getContracts(address _creator) public view returns (address[] memory) {
        return createdContracts[_creator];
    }
}
```

### 2. 安全工厂模式

```solidity
contract SecureFactory is Ownable {
    mapping(address => bool) public whitelist;
    
    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "Not whitelisted");
        _;
    }
    
    function addToWhitelist(address _user) public onlyOwner {
        whitelist[_user] = true;
    }
    
    function createChild(uint _value) public onlyWhitelisted {
        Child child = new Child(_value);
        // ... 其他逻辑
    }
}
```

## 最佳实践

### 1. 创建策略
- 选择合适的创建方式
- 考虑 gas 成本
- 预测地址需求
- 安全性考虑

### 2. 代码组织
- 清晰的工厂结构
- 完善的事件记录
- 合理的访问控制
- 优化的存储结构

### 3. 安全考虑
- 权限管理
- 输入验证
- 重入防护
- 地址检查

## 使用场景

### 1. 标准代理
```solidity
contract ProxyFactory {
    function createProxy(address _logic) public returns (address) {
        bytes memory code = abi.encodePacked(
            bytes20(0x3D602d80600A3D3981F3363d3d373d3D3D363d73),
            bytes20(_logic),
            bytes15(0x5af43d82803e903d91602b57fd5bf3)
        );
        address proxy;
        assembly {
            proxy := create(0, add(code, 0x20), mload(code))
        }
        return proxy;
    }
}
```

### 2. 批量创建
```solidity
contract BatchFactory {
    function createMultiple(uint _count, uint _value) public {
        for(uint i = 0; i < _count; i++) {
            bytes32 salt = keccak256(abi.encodePacked(msg.sender, i));
            new Child{salt: salt}(_value);
        }
    }
}
```

## 注意事项

### 1. Gas 消耗
- 创建成本
- 代码大小
- 存储开销
- 批量操作

### 2. 地址管理
- 地址追踪
- 确定性部署
- 地址冲突
- 地址验证

### 3. 错误处理
- 创建失败
- 参数验证
- 异常恢复
- 状态一致性

## 总结

合约创建是智能合约开发中的重要环节，合理使用各种创建方式可以：
- 优化部署成本
- 提高灵活性
- 增强安全性
- 改善可维护性

通过正确选择和实现合约创建模式，可以构建更加高效和安全的智能合约系统。 