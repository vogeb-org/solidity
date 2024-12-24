# Trading Systems

## Introduction

Trading systems are essential components of decentralized finance. This guide covers various trading mechanisms, implementations, and best practices.

## NFT Trading Systems

### NFT Marketplace
A basic implementation of an NFT marketplace:

```solidity
contract NFTMarketplace {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    
    mapping(address => mapping(uint256 => Listing)) public listings;
    
    event Listed(address indexed nft, uint256 indexed tokenId, uint256 price);
    event Sold(address indexed nft, uint256 indexed tokenId, address buyer, uint256 price);
    event Canceled(address indexed nft, uint256 indexed tokenId);
    
    function list(address nft, uint256 tokenId, uint256 price) external {
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        
        listings[nft][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });
        
        emit Listed(nft, tokenId, price);
    }
    
    function buy(address nft, uint256 tokenId) external payable {
        Listing storage listing = listings[nft][tokenId];
        require(listing.active, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        
        listing.active = false;
        
        IERC721(nft).transferFrom(address(this), msg.sender, tokenId);
        payable(listing.seller).transfer(msg.value);
        
        emit Sold(nft, tokenId, msg.sender, msg.value);
    }
    
    function cancel(address nft, uint256 tokenId) external {
        Listing storage listing = listings[nft][tokenId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.active, "Not listed");
        
        listing.active = false;
        
        IERC721(nft).transferFrom(address(this), msg.sender, tokenId);
        
        emit Canceled(nft, tokenId);
    }
}
```

### Auction Systems

#### English Auction
```solidity
contract EnglishAuction {
    struct Auction {
        address seller;
        uint256 startPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool ended;
    }
    
    mapping(address => mapping(uint256 => Auction)) public auctions;
    mapping(address => uint256) public pendingReturns;
    
    event AuctionCreated(address indexed nft, uint256 indexed tokenId, uint256 startPrice, uint256 duration);
    event BidPlaced(address indexed nft, uint256 indexed tokenId, address bidder, uint256 amount);
    event AuctionEnded(address indexed nft, uint256 indexed tokenId, address winner, uint256 amount);
    
    function createAuction(
        address nft,
        uint256 tokenId,
        uint256 startPrice,
        uint256 duration
    ) external {
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        
        auctions[nft][tokenId] = Auction({
            seller: msg.sender,
            startPrice: startPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + duration,
            ended: false
        });
        
        emit AuctionCreated(nft, tokenId, startPrice, duration);
    }
    
    function bid(address nft, uint256 tokenId) external payable {
        Auction storage auction = auctions[nft][tokenId];
        require(!auction.ended && block.timestamp < auction.endTime, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");
        
        if (auction.highestBidder != address(0)) {
            pendingReturns[auction.highestBidder] += auction.highestBid;
        }
        
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        
        emit BidPlaced(nft, tokenId, msg.sender, msg.value);
    }
    
    function endAuction(address nft, uint256 tokenId) external {
        Auction storage auction = auctions[nft][tokenId];
        require(!auction.ended, "Already ended");
        require(block.timestamp >= auction.endTime, "Not ended yet");
        
        auction.ended = true;
        
        if (auction.highestBidder != address(0)) {
            IERC721(nft).transferFrom(address(this), auction.highestBidder, tokenId);
            payable(auction.seller).transfer(auction.highestBid);
        } else {
            IERC721(nft).transferFrom(address(this), auction.seller, tokenId);
        }
        
        emit AuctionEnded(nft, tokenId, auction.highestBidder, auction.highestBid);
    }
    
    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        if (amount > 0) {
            pendingReturns[msg.sender] = 0;
            payable(msg.sender).transfer(amount);
        }
    }
}
```

## Token Trading Systems

### Automated Market Maker (AMM)
A simple constant product AMM implementation:

```solidity
contract SimpleAMM {
    IERC20 public tokenA;
    IERC20 public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    
    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }
    
    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 shares) {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        
        if (totalSupply == 0) {
            shares = sqrt(amountA * amountB);
        } else {
            shares = min(
                (amountA * totalSupply) / reserveA,
                (amountB * totalSupply) / reserveB
            );
        }
        
        require(shares > 0, "Insufficient liquidity");
        
        reserveA += amountA;
        reserveB += amountB;
        totalSupply += shares;
        balanceOf[msg.sender] += shares;
    }
    
    function removeLiquidity(uint256 shares) external returns (uint256 amountA, uint256 amountB) {
        require(shares > 0, "Invalid shares");
        
        amountA = (shares * reserveA) / totalSupply;
        amountB = (shares * reserveB) / totalSupply;
        
        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;
        reserveA -= amountA;
        reserveB -= amountB;
        
        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
    }
    
    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        require(amountIn > 0, "Invalid amount");
        
        bool isTokenA = tokenIn == address(tokenA);
        (IERC20 tokenIn_, IERC20 tokenOut, uint256 reserveIn, uint256 reserveOut) = isTokenA
            ? (tokenA, tokenB, reserveA, reserveB)
            : (tokenB, tokenA, reserveB, reserveA);
            
        tokenIn_.transferFrom(msg.sender, address(this), amountIn);
        
        uint256 amountInWithFee = amountIn * 997;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
        
        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }
        
        tokenOut.transfer(msg.sender, amountOut);
    }
    
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x <= y ? x : y;
    }
}
```

## Best Practices

### 1. Security
- Access control
- Input validation
- Reentrancy protection
- Price manipulation prevention

### 2. Gas Optimization
- Batch operations
- State management
- Event optimization
- Storage efficiency

### 3. User Experience
- Clear interfaces
- Error handling
- Event logging
- Price feeds

## Development Tools

### 1. Testing
- Unit tests
- Integration tests
- Price simulations
- Security checks

### 2. Deployment
- Network selection
- Contract verification
- Parameter setting
- Monitoring

### 3. Integration
- Price oracles
- Front-end interfaces
- Analytics tools
- Monitoring systems

## Implementation Guide

1. Planning
   - Choose mechanism
   - Design architecture
   - Plan security
   - Consider scalability

2. Development
   - Write secure code
   - Test thoroughly
   - Document features
   - Optimize gas

3. Deployment
   - Test on testnet
   - Audit code
   - Deploy safely
   - Monitor usage

Remember: Trading systems require robust security measures and careful consideration of economic implications. 