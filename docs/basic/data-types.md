# Data Types in Solidity

## Introduction

Solidity is a statically typed language, which means each variable must be declared with a specific type. Understanding these types is crucial for efficient smart contract development.

## Value Types

### Boolean
```solidity
bool public isActive = true;
bool public isFinished = false;
```
- Only `true` or `false`
- Default value is `false`
- Common in conditional statements

### Integers
```solidity
uint256 public positiveNumber = 100;
int256 public wholeNumber = -50;
uint8 public smallNumber = 255;
```
- `uint`: Unsigned integer (≥0)
- `int`: Signed integer
- Common sizes: 8, 16, 32, 64, 128, 256 bits
- Default is 256 bits

### Address
```solidity
address public userAddress = 0x742d35Cc6634C0532925a3b844Bc454e4438f44e;
address payable public payableAddress;
```
- 20 bytes (160 bits)
- Represents Ethereum addresses
- `payable` allows receiving Ether
- Has members like `balance` and `transfer`

### Fixed-Size Byte Arrays
```solidity
bytes1 public singleByte = 0x42;
bytes32 public hash = keccak256("Hello");
```
- Fixed length of 1 to 32 bytes
- More gas efficient than dynamic arrays
- Common in cryptographic operations

### Enums
```solidity
enum Status { Pending, Active, Closed }
Status public currentStatus = Status.Pending;
```
- User-defined type
- Internally represented as integers
- Useful for state machines
- Zero-based indexing

## Reference Types

### Dynamic Arrays
```solidity
uint[] public numbers;
string[] public names;

function addNumber(uint _number) public {
    numbers.push(_number);
}
```
- Variable length
- Can be resized
- More gas intensive
- Common methods: `push`, `pop`, `length`

### Fixed Arrays
```solidity
uint[5] public fixedNumbers;
bytes32[3] public hashes;
```
- Fixed length
- More gas efficient
- Length checked at compile time

### Mappings
```solidity
mapping(address => uint) public balances;
mapping(uint => mapping(address => bool)) public approvals;
```
- Key-value pairs
- No length or iteration
- All values initialized
- Efficient lookups

### Structs
```solidity
struct User {
    string name;
    uint age;
    address wallet;
}

User public newUser = User("Alice", 25, msg.sender);
```
- Custom data structure
- Groups related data
- Can contain different types
- Used for complex data

## Data Locations

### Storage
```solidity
User[] public users;  // Storage by default for state variables
```
- Persistent between function calls
- Most expensive gas-wise
- State variables are always storage

### Memory
```solidity
function processUser(string memory _name) public {
    User memory tempUser = User(_name, 0, address(0));
}
```
- Temporary during function execution
- Cleared after function ends
- Less expensive than storage

### Calldata
```solidity
function processData(bytes calldata _data) external {
    // Process immutable input data
}
```
- Read-only
- Only for external function parameters
- Most gas efficient
- Cannot be modified

## Best Practices

1. Type Selection
   - Use smallest possible type
   - Consider gas costs
   - Match type to use case
   - Be explicit about sizes

2. Gas Optimization
   - Prefer fixed-size arrays
   - Use appropriate data location
   - Batch operations when possible
   - Consider packing similar types

3. Security
   - Check integer overflow/underflow
   - Validate array bounds
   - Handle mapping defaults
   - Consider visibility

## Common Patterns

### Type Conversion
```solidity
uint8 small = 255;
uint256 big = uint256(small);  // Safe conversion
```

### Type Checking
```solidity
function transfer(address _to) public {
    require(_to != address(0), "Invalid address");
}
```

## Practice Exercise

Create a contract that:
1. Uses different numeric types
2. Implements a dynamic array
3. Uses a mapping for data storage
4. Creates a custom struct
5. Demonstrates type conversion

## Key Takeaways

- Choose appropriate types for data
- Consider gas costs in type selection
- Understand data locations
- Use type safety checks
- Follow best practices for efficiency

Remember: Proper type selection is crucial for both functionality and gas efficiency. 