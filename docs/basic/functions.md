# Functions in Solidity

## Introduction

Functions are the building blocks of smart contracts, containing the executable code that defines contract behavior. Understanding function types, visibility, and modifiers is crucial for effective smart contract development.

## Function Declaration

### Basic Structure
```solidity
function functionName(
    parameterType parameterName
) 
    visibility
    stateModifier
    returns (returnType)
{
    // Function body
}
```

### Example
```solidity
function transfer(address to, uint256 amount) 
    public 
    payable 
    returns (bool)
{
    // Transfer logic
    return true;
}
```

## Function Visibility

### Public
```solidity
function publicFunction() public {
    // Accessible from anywhere
}
```
- Accessible internally and externally
- Creates a getter function for state variables
- Most gas intensive

### External
```solidity
function externalFunction() external {
    // Only accessible from outside
}
```
- Only callable from outside the contract
- More gas efficient for large parameters
- Cannot be called internally

### Internal
```solidity
function internalFunction() internal {
    // Only accessible internally
}
```
- Accessible only within contract and derived contracts
- Similar to protected in OOP
- Common for helper functions

### Private
```solidity
function privateFunction() private {
    // Only accessible in this contract
}
```
- Only accessible within the current contract
- Not visible in derived contracts
- Most restrictive visibility

## State Mutability

### View Functions
```solidity
function getValue() public view returns (uint) {
    return someValue;
}
```
- Read-only access to state
- No state modifications
- No gas cost when called externally

### Pure Functions
```solidity
function calculate(uint x, uint y) public pure returns (uint) {
    return x + y;
}
```
- No state access or modification
- Only works with parameters
- Most gas efficient

### Payable Functions
```solidity
function deposit() public payable {
    // Handle incoming Ether
}
```
- Can receive Ether
- Special handling required
- Common in payment systems

## Function Parameters

### Parameter Types
```solidity
function complexFunction(
    uint256 number,
    string memory text,
    address[] calldata addresses
) public {
    // Function logic
}
```
- Value types passed by value
- Reference types need location specifier
- Arrays and strings need special handling

### Named Returns
```solidity
function divide(uint256 a, uint256 b)
    public
    pure
    returns (uint256 quotient, uint256 remainder)
{
    quotient = a / b;
    remainder = a % b;
}
```
- Improves code readability
- Automatically returned
- Can still use return statement

## Function Modifiers

### Custom Modifiers
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

function restrictedFunction() public onlyOwner {
    // Only owner can call this
}
```
- Reusable code
- Access control
- Function validation

### Multiple Modifiers
```solidity
modifier costs(uint price) {
    require(msg.value >= price, "Not enough");
    _;
}

function premium() 
    public 
    payable 
    onlyOwner 
    costs(0.1 ether)
{
    // Function logic
}
```
- Execute in order
- Can take parameters
- Common for complex validation

## Best Practices

1. Function Design
   - Single responsibility principle
   - Clear naming conventions
   - Appropriate visibility
   - Efficient parameter usage

2. Security
   - Input validation
   - Access control
   - Reentrancy protection
   - Error handling

3. Gas Optimization
   - Minimize state changes
   - Use appropriate visibility
   - Batch operations
   - Consider calldata vs memory

## Common Patterns

### Fallback Function
```solidity
fallback() external payable {
    // Handle unknown calls
}

receive() external payable {
    // Handle direct Ether transfers
}
```

### Getter Functions
```solidity
mapping(address => uint) private balances;

function getBalance(address account) 
    public 
    view 
    returns (uint)
{
    return balances[account];
}
```

## Practice Exercise

Create a contract with:
1. Different visibility functions
2. State modifying functions
3. View and pure functions
4. Custom modifiers
5. Payable functions

## Key Takeaways

- Choose appropriate visibility
- Use state mutability correctly
- Implement proper access control
- Consider gas costs
- Follow security best practices

Remember: Well-designed functions are key to secure and efficient smart contracts. 