# Deployment in Solidity

## Introduction

Deploying smart contracts requires careful planning and execution. This guide covers deployment strategies, verification, and best practices for successful contract deployment.

## Basic Deployment

### Simple Deployment
```javascript
const { ethers } = require("hardhat");

async function main() {
    // Get contract factory
    const Token = await ethers.getContractFactory("Token");
    
    // Deploy contract
    const token = await Token.deploy();
    await token.deployed();
    
    console.log("Token deployed to:", token.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Parameterized Deployment
```javascript
async function deployWithParams() {
    const [deployer] = await ethers.getSigners();
    
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy(
        "MyToken",           // name
        "MTK",              // symbol
        ethers.utils.parseEther("1000000")  // initial supply
    );
    
    await token.deployed();
    
    // Verify deployment
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    
    console.log("Token deployed:", {
        address: token.address,
        name,
        symbol,
        totalSupply: ethers.utils.formatEther(totalSupply)
    });
}
```

## Advanced Deployment

### Proxy Deployment
```solidity
contract ProxyDeployer {
    event Deployed(address proxy, address implementation);
    
    function deployProxy(
        bytes memory implementationBytecode,
        bytes memory initData
    ) public returns (address proxy) {
        // Deploy implementation
        address implementation;
        assembly {
            implementation := create(0, add(implementationBytecode, 0x20),
                mload(implementationBytecode))
        }
        require(implementation != address(0), "Implementation deployment failed");
        
        // Deploy proxy
        proxy = address(new TransparentUpgradeableProxy(
            implementation,
            msg.sender,
            initData
        ));
        
        emit Deployed(proxy, implementation);
    }
}
```

### Factory Pattern
```solidity
contract TokenFactory {
    mapping(address => address[]) public deployedTokens;
    event TokenDeployed(address token, string name, string symbol);
    
    function deployToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) public returns (address) {
        Token token = new Token(name, symbol, initialSupply, msg.sender);
        deployedTokens[msg.sender].push(address(token));
        
        emit TokenDeployed(address(token), name, symbol);
        return address(token);
    }
    
    function getDeployedTokens() public view returns (address[] memory) {
        return deployedTokens[msg.sender];
    }
}
```

## Deployment Strategies

### Deterministic Deployment
```solidity
contract DeterministicDeployer {
    function deployDeterministic(
        bytes memory bytecode,
        bytes32 salt
    ) public returns (address) {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(addr != address(0), "Deployment failed");
        return addr;
    }
    
    function computeAddress(
        bytes memory bytecode,
        bytes32 salt
    ) public view returns (address) {
        return address(uint160(uint(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(bytecode)
        )))));
    }
}
```

### Batch Deployment
```solidity
contract BatchDeployer {
    struct DeploymentParams {
        bytes bytecode;
        bytes initData;
    }
    
    function deployBatch(
        DeploymentParams[] memory params
    ) public returns (address[] memory) {
        address[] memory deployed = new address[](params.length);
        
        for (uint i = 0; i < params.length; i++) {
            address addr;
            assembly {
                addr := create(0, add(mload(add(params, mul(i, 0x20))), 0x20),
                    mload(mload(add(params, mul(i, 0x20)))))
            }
            require(addr != address(0), "Deployment failed");
            
            if (params[i].initData.length > 0) {
                (bool success,) = addr.call(params[i].initData);
                require(success, "Initialization failed");
            }
            
            deployed[i] = addr;
        }
        
        return deployed;
    }
}
```

## Best Practices

1. Pre-deployment
   - Audit code
   - Test thoroughly
   - Verify bytecode
   - Check dependencies

2. Deployment Process
   - Use safe networks
   - Monitor gas prices
   - Verify transactions
   - Document addresses

3. Post-deployment
   - Verify source code
   - Test functionality
   - Monitor events
   - Update documentation

## Common Patterns

### Contract Verification
```javascript
async function verifyContract(address, constructorArguments) {
    await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArguments,
    });
}

async function deployAndVerify() {
    // Deploy
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("MyToken", "MTK", 1000000);
    await token.deployed();
    
    // Wait for few block confirmations
    await token.deployTransaction.wait(5);
    
    // Verify
    await verifyContract(token.address, ["MyToken", "MTK", 1000000]);
}
```

### Safe Deployment
```solidity
contract SafeDeployer {
    event DeploymentStarted(bytes32 deployId);
    event DeploymentCompleted(bytes32 deployId, address deployed);
    
    mapping(bytes32 => bool) public completedDeployments;
    
    function safeDeploy(
        bytes32 deployId,
        bytes memory bytecode
    ) public returns (address) {
        require(!completedDeployments[deployId], "Already deployed");
        
        emit DeploymentStarted(deployId);
        
        address deployed;
        assembly {
            deployed := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(deployed != address(0), "Deployment failed");
        
        completedDeployments[deployId] = true;
        emit DeploymentCompleted(deployId, deployed);
        
        return deployed;
    }
}
```

## Practice Exercise

Create deployments that:
1. Use proxy pattern
2. Implement deterministic deployment
3. Handle batch operations
4. Include verification
5. Monitor deployment status

## Key Takeaways

- Plan deployments carefully
- Use appropriate patterns
- Verify all contracts
- Monitor transactions
- Document everything

Remember: Successful deployment is crucial for contract security and usability. 