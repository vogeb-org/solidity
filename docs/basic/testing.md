# Testing in Solidity

## Introduction

Testing is crucial for smart contract development. This guide covers testing frameworks, methodologies, and best practices for ensuring contract reliability.

## Basic Testing

### Unit Tests
```solidity
// Contract to test
contract Token {
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) public returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }
}

// Test contract
contract TokenTest {
    Token token;
    
    function beforeEach() public {
        token = new Token();
    }
    
    function testTransfer() public {
        token.balances(address(this)) = 100;
        bool success = token.transfer(address(1), 50);
        assert(success == true);
        assert(token.balances(address(this)) == 50);
        assert(token.balances(address(1)) == 50);
    }
    
    function testInsufficientBalance() public {
        token.balances(address(this)) = 40;
        try token.transfer(address(1), 50) {
            assert(false, "Should have reverted");
        } catch Error(string memory error) {
            assert(keccak256(bytes(error)) == keccak256(bytes("Insufficient balance")));
        }
    }
}
```

### Integration Tests
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token System", function() {
    let token;
    let owner;
    let user1;
    let user2;
    
    beforeEach(async function() {
        const Token = await ethers.getContractFactory("Token");
        [owner, user1, user2] = await ethers.getSigners();
        token = await Token.deploy();
        await token.deployed();
    });
    
    it("Should handle complete transfer workflow", async function() {
        // Initial minting
        await token.mint(user1.address, 100);
        expect(await token.balanceOf(user1.address)).to.equal(100);
        
        // Transfer between users
        await token.connect(user1).transfer(user2.address, 50);
        expect(await token.balanceOf(user1.address)).to.equal(50);
        expect(await token.balanceOf(user2.address)).to.equal(50);
        
        // Approval and transferFrom
        await token.connect(user2).approve(owner.address, 30);
        await token.connect(owner).transferFrom(user2.address, user1.address, 30);
        expect(await token.balanceOf(user2.address)).to.equal(20);
        expect(await token.balanceOf(user1.address)).to.equal(80);
    });
});
```

## Testing Frameworks

### Hardhat Example
```javascript
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Lock", function() {
    async function deployFixture() {
        const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
        const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
        
        const [owner, otherAccount] = await ethers.getSigners();
        const Lock = await ethers.getContractFactory("Lock");
        const lock = await Lock.deploy(unlockTime, { value: lockedAmount });
        
        return { lock, unlockTime, owner, otherAccount };
    }
    
    describe("Deployment", function() {
        it("Should set the right unlockTime", async function() {
            const { lock, unlockTime } = await loadFixture(deployFixture);
            expect(await lock.unlockTime()).to.equal(unlockTime);
        });
        
        it("Should revert when unlock time is not reached", async function() {
            const { lock } = await loadFixture(deployFixture);
            await expect(lock.withdraw()).to.be.revertedWith("Too early");
        });
    });
});
```

### Foundry Example
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token token;
    address user;
    
    function setUp() public {
        token = new Token();
        user = address(0x1);
        vm.deal(user, 100 ether);
    }
    
    function testMint() public {
        token.mint(user, 1000);
        assertEq(token.balanceOf(user), 1000);
    }
    
    function testFailMintToZero() public {
        token.mint(address(0), 1000);
    }
    
    function testFuzzTransfer(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1000);
        token.mint(user, 1000);
        
        vm.prank(user);
        token.transfer(address(this), amount);
        
        assertEq(token.balanceOf(user), 1000 - amount);
        assertEq(token.balanceOf(address(this)), amount);
    }
}
```

## Testing Patterns

### State Management
```solidity
contract TestHelpers {
    function createTestState() internal returns (TestState memory) {
        return TestState({
            admin: address(1),
            user1: address(2),
            user2: address(3),
            initialBalance: 1000,
            transferAmount: 100
        });
    }
    
    function setupToken(TestState memory state) internal returns (Token) {
        Token token = new Token();
        token.mint(state.user1, state.initialBalance);
        return token;
    }
}

contract TokenAdvancedTest is TestHelpers {
    function testComplexScenario() public {
        TestState memory state = createTestState();
        Token token = setupToken(state);
        
        // Test scenario
        vm.startPrank(state.user1);
        token.approve(state.user2, state.transferAmount);
        vm.stopPrank();
        
        vm.prank(state.user2);
        token.transferFrom(state.user1, state.user2, state.transferAmount);
        
        assertEq(token.balanceOf(state.user1), state.initialBalance - state.transferAmount);
        assertEq(token.balanceOf(state.user2), state.transferAmount);
    }
}
```

### Gas Testing
```solidity
contract GasTest is Test {
    Token token;
    
    function setUp() public {
        token = new Token();
    }
    
    function testGasTransfer() public {
        token.mint(address(this), 1000);
        
        uint256 gasBefore = gasleft();
        token.transfer(address(1), 100);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for transfer:", gasUsed);
        assertTrue(gasUsed < 50000, "Transfer uses too much gas");
    }
}
```

## Best Practices

1. Test Organization
   - Group related tests
   - Use descriptive names
   - Maintain test independence
   - Follow AAA pattern

2. Coverage
   - Test all code paths
   - Include edge cases
   - Test failure modes
   - Verify events

3. Maintenance
   - Keep tests simple
   - Update with code changes
   - Document test cases
   - Review test results

## Common Patterns

### Event Testing
```solidity
contract EventTest {
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    function testTransferEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(this), address(1), 100);
        
        token.transfer(address(1), 100);
    }
}
```

### Fuzzing Tests
```solidity
contract FuzzTest {
    function testFuzzingScenario(
        address to,
        uint256 amount,
        bytes32 data
    ) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0 && amount <= 1000000);
        
        token.mint(address(this), amount);
        token.transfer(to, amount);
        
        assertEq(token.balanceOf(to), amount);
    }
}
```

## Practice Exercise

Create tests that:
1. Cover basic functionality
2. Include integration tests
3. Test gas optimization
4. Verify events
5. Use fuzzing

## Key Takeaways

- Test thoroughly
- Use multiple approaches
- Maintain test quality
- Monitor gas usage
- Document test cases

Remember: Good tests are essential for contract reliability and maintenance. 