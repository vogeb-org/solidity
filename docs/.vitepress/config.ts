import { defineConfig } from 'vitepress'

export default defineConfig({
  // SEO 配置
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['meta', { name: 'author', content: 'Solidity Tutorial' }],
    ['meta', { name: 'keywords', content: 'Solidity, Smart Contract, Blockchain, Ethereum, Web3, DApp, Token, NFT, DeFi' }],
    
    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Solidity Tutorial' }],
    
    // 规范链接
    ['link', { rel: 'canonical', href: 'https://solidity.vogeb.com' }]
  ],

  // 站点地图
  sitemap: {
    hostname: 'https://solidity.vogeb.com'
  },

  // 清理 URL
  cleanUrls: true,

  // 最后更新时间
  lastUpdated: true,

  // Markdown 配置
  // markdown: {
  //   theme: 'github-light',
  //   lineNumbers: true
  // },

  // 语言切换
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: "Solidity Tutorial",
      description: "Comprehensive Solidity smart contract development tutorial covering basic concepts, advanced applications, practical cases and best practices",
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Guide', link: '/guide/' },
          { text: 'Solidity Basics', link: '/basic/' },
          { text: 'Solidity Advanced', link: '/advanced/' }
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Introduction', link: '/guide/' },
                { text: 'Getting Started', link: '/guide/getting-started' },
                { text: 'Development', link: '/guide/development' }
              ]
            }
          ],
          '/basic/': [
            {
              text: 'Solidity Basics',
              items: [
                { text: '1. Contract Structure', link: '/basic/contract-structure' },
                { text: '2. Data Types', link: '/basic/data-types' },
                { text: '3. Functions', link: '/basic/functions' },
                { text: '4. Modifiers', link: '/basic/modifiers' },
                { text: '5. Events', link: '/basic/events' },
                { text: '6. Error Handling', link: '/basic/error-handling' },
                { text: '7. Mappings', link: '/basic/mapping' },
                { text: '8. Interfaces', link: '/basic/interfaces' },
                { text: '9. Libraries', link: '/basic/libraries' },
                { text: '10. Fallback', link: '/basic/fallback' },
                { text: '11. Contract Creation', link: '/basic/contract-creation' },
                { text: '12. ABI', link: '/basic/abi' },
                { text: '13. Proxy Pattern', link: '/basic/proxy-pattern' },
                { text: '14. Storage Slots', link: '/basic/storage-slots' },
                { text: '15. Gas Optimization', link: '/basic/gas-optimization' },
                { text: '16. Timelock & Multisig', link: '/basic/timelock-multisig' }
              ]
            }
          ],
          '/advanced/': [
            {
              text: 'Token Standards',
              items: [
                { text: '1. ERC20 Implementation', link: '/advanced/standards/erc20' },
                { text: '2. ERC721 Implementation', link: '/advanced/standards/erc721' },
                { text: '3. ERC4626 Tokenized Vault', link: '/advanced/standards/erc4626' }
              ]
            },
            {
              text: 'Token Systems',
              items: [
                { text: '1. Token Swap', link: '/advanced/tokens/token-swap' },
                { text: '2. Token Staking', link: '/advanced/tokens/token-staking' },
                { text: '3. Token Lending', link: '/advanced/tokens/token-lending' },
                { text: '4. Token Dividend Pool', link: '/advanced/tokens/token-dividend-pool' },
                { text: '5. Token Dividend', link: '/advanced/tokens/token-dividend' },
                { text: '6. Liquidity Mining', link: '/advanced/tokens/liquidity-mining' },
                { text: '7. Token Recycle', link: '/advanced/tokens/token-recycle' },
                { text: '8. Token Buyback', link: '/advanced/tokens/token-buyback' },
                { text: '9. Token Vote Weight', link: '/advanced/tokens/token-vote-weight' },
                { text: '10. Token Voting', link: '/advanced/tokens/token-voting' },
                { text: '11. Trading Bot', link: '/advanced/tokens/trading-bot' },
                { text: '12. Token Distribution', link: '/advanced/tokens/token-distribution' },
                { text: '13. Token Vesting', link: '/advanced/tokens/token-vesting' },
                { text: '14. Token Rate Limit', link: '/advanced/tokens/token-rate-limit' },
                { text: '15. Token Fee', link: '/advanced/tokens/token-fee' },
                { text: '16. Token Snapshot', link: '/advanced/tokens/token-snapshot' },
                { text: '17. Token Blacklist', link: '/advanced/tokens/token-blacklist' },
                { text: '18. Token Exchange', link: '/advanced/tokens/token-exchange' },
                { text: '19. Token Airdrop', link: '/advanced/tokens/token-airdrop' },
                { text: '20. Token Lock', link: '/advanced/tokens/token-lock' },
                { text: '21. Token Linear Release', link: '/advanced/tokens/token-linear-release' },
                { text: '22. Token Governance', link: '/advanced/tokens/token-governance' },
                { text: '23. Token Upgrade', link: '/advanced/tokens/token-upgrade' },
                { text: '24. Token Bridge', link: '/advanced/tokens/token-bridge' },
                { text: '25. Token Flash Loan', link: '/advanced/tokens/token-flash-loan' },
                { text: '26. Token Yield Aggregator', link: '/advanced/tokens/token-yield-aggregator' },
                { text: '27. Token Liquidity Oracle', link: '/advanced/tokens/token-liquidity-oracle' },
                { text: '28. Token Deflation', link: '/advanced/tokens/token-deflation' },
                { text: '29. Token Proof of Stake', link: '/advanced/tokens/token-proof-of-stake' },
                { text: '30. Token Liquidity Protection', link: '/advanced/tokens/token-liquidity-protection' }
              ]
            },
            {
              text: 'Trading Systems',
              items: [
                { text: '1. English Auction', link: '/advanced/trading/english-auction' },
                { text: '2. NFT Marketplace', link: '/advanced/trading/nft-marketplace' },
                { text: '3. Dutch Auction', link: '/advanced/trading/dutch-auction' }
              ]
            }
          ]
        },
        docFooter: {
          prev: 'Previous',
          next: 'Next'
        },
        lastUpdatedText: 'Last updated at',
        editLink: {
          pattern: 'https://github.com/vogeb-org/solidity/edit/main/docs/:path',
          text: 'Edit this page on GitHub'
        },
        outlineTitle: 'On this page'
      }
    },
    'zh-CN': {
      label: '简体中文',
      lang: 'zh-CN',
      title: "Solidity教程",
      description: "最全面的 Solidity 智能合约开发教程，包含基础概念、高级应用、实战案例和最佳实践",
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh-CN' },
          { text: '教程指南', link: '/zh-CN/guide/' },
          { text: 'Solidity入门', link: '/zh-CN/basic/' },
          { text: 'Solidity高级', link: '/zh-CN/advanced/' },
        ],
        sidebar: {
          '/zh-CN/guide/': [
            {
              text: '教程指南',
              items: [
                { text: '介绍', link: '/zh-CN/guide/' },
                { text: '快速开始', link: '/zh-CN/guide/getting-started' },
                { text: '开发环境', link: '/zh-CN/guide/development' }
              ]
            }
          ],
          '/zh-CN/basic/': [
            {
              text: 'Solidity入门',
              items: [
                { text: '1. 合约结构', link: '/zh-CN/basic/contract-structure' },
                { text: '2. 数据类型', link: '/zh-CN/basic/data-types' },
                { text: '3. 函数', link: '/zh-CN/basic/functions' },
                { text: '4. 修饰器', link: '/zh-CN/basic/modifiers' },
                { text: '5. 事件', link: '/zh-CN/basic/events' },
                { text: '6. 错误处理', link: '/zh-CN/basic/error-handling' },
                { text: '7. 映射', link: '/zh-CN/basic/mapping' },
                { text: '8. 接口继承', link: '/zh-CN/basic/interfaces' },
                { text: '9. 库合约', link: '/zh-CN/basic/libraries' },
                { text: '10. 回退函数', link: '/zh-CN/basic/fallback' },
                { text: '11. 创建合约', link: '/zh-CN/basic/contract-creation' },
                { text: '12. ABI编码', link: '/zh-CN/basic/abi' },
                { text: '13. 代理合约模式', link: '/zh-CN/basic/proxy-pattern' },
                { text: '14. 存储槽管理', link: '/zh-CN/basic/storage-slots' },
                { text: '15. Gas优化技巧', link: '/zh-CN/basic/gas-optimization' },
                { text: '16. 时间锁和多重签名', link: '/zh-CN/basic/timelock-multisig' }
              ]
            }
          ],
          '/zh-CN/advanced/': [
            {
              text: '基础标准',
              items: [
                { text: '1. ERC20标准实现', link: '/zh-CN/advanced/standards/erc20' },
                { text: '2. ERC721标准实现', link: '/zh-CN/advanced/standards/erc721' },
                { text: '3. ERC4626代币化金库', link: '/zh-CN/advanced/standards/erc4626' }
              ]
            },
            {
              text: '代币系统',
              items: [
                { text: '1. 代币交换系统', link: '/zh-CN/advanced/tokens/token-swap' },
                { text: '2. 代币质押挖矿', link: '/zh-CN/advanced/tokens/token-staking' },
                { text: '3. 代币借贷系统', link: '/zh-CN/advanced/tokens/token-lending' },
                { text: '4. 代币分红池', link: '/zh-CN/advanced/tokens/token-dividend-pool' },
                { text: '5. 代币分红系统', link: '/zh-CN/advanced/tokens/token-dividend' },
                { text: '6. 代币流动性挖矿', link: '/zh-CN/advanced/tokens/liquidity-mining' },
                { text: '7. 代币回收系统', link: '/zh-CN/advanced/tokens/token-recycle' },
                { text: '8. 代币回购销毁', link: '/zh-CN/advanced/tokens/token-buyback' },
                { text: '9. 代币投票权重', link: '/zh-CN/advanced/tokens/token-vote-weight' },
                { text: '10. 代币投票系统', link: '/zh-CN/advanced/tokens/token-voting' },
                { text: '11. 代币交易机器人', link: '/zh-CN/advanced/tokens/trading-bot' },
                { text: '12. 代币分发系统', link: '/zh-CN/advanced/tokens/token-distribution' },
                { text: '13. 代币归属机制', link: '/zh-CN/advanced/tokens/token-vesting' },
                { text: '14. 代币限速系统', link: '/zh-CN/advanced/tokens/token-rate-limit' },
                { text: '15. 代币费用系统', link: '/zh-CN/advanced/tokens/token-fee' },
                { text: '16. 代币快照系统', link: '/zh-CN/advanced/tokens/token-snapshot' },
                { text: '17. 代币封禁系统', link: '/zh-CN/advanced/tokens/token-blacklist' },
                { text: '18. 代币兑换系统', link: '/zh-CN/advanced/tokens/token-exchange' },
                { text: '19. 代币空投系统', link: '/zh-CN/advanced/tokens/token-airdrop' },
                { text: '20. 代币锁仓系统', link: '/zh-CN/advanced/tokens/token-lock' },
                { text: '21. 代币线性释放', link: '/zh-CN/advanced/tokens/token-linear-release' },
                { text: '22. 代币治理系统', link: '/zh-CN/advanced/tokens/token-governance' },
                { text: '23. 代币升级系统', link: '/zh-CN/advanced/tokens/token-upgrade' },
                { text: '24. 代币桥接系统', link: '/zh-CN/advanced/tokens/token-bridge' },
                { text: '25. 代币闪电贷', link: '/zh-CN/advanced/tokens/token-flash-loan' },
                { text: '26. 代币收益聚合', link: '/zh-CN/advanced/tokens/token-yield-aggregator' },
                { text: '27. 代币流动性预言机', link: '/zh-CN/advanced/tokens/token-liquidity-oracle' },
                { text: '28. 代币通缩机制', link: '/zh-CN/advanced/tokens/token-deflation' },
                { text: '29. 代币权益证明', link: '/zh-CN/advanced/tokens/token-proof-of-stake' },
                { text: '30. 代币流动性保护', link: '/zh-CN/advanced/tokens/token-liquidity-protection' }
              ]
            },
            {
              text: '交易系统',
              items: [
                { text: '1. 英式拍卖', link: '/zh-CN/advanced/trading/english-auction' },
                { text: '2. NFT交易所', link: '/zh-CN/advanced/trading/nft-marketplace' },
                { text: '3. 荷兰拍卖', link: '/zh-CN/advanced/trading/dutch-auction' }
              ]
            }
          ]
        },
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        lastUpdatedText: '最后更新于',
        editLink: {
          pattern: 'https://github.com/vogeb-org/solidity/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页'
        },
        outlineTitle: '本页目录'
      }
    }
  },

  themeConfig: {
    logo: '/logo.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vogeb-org/solidity' }
    ],

    footer: {
      message: 'Released under the MIT License by Vogeb.',
      copyright: 'Copyright © 2024-present Vogeb'
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search documentation'
              },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Reset search',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close'
                }
              }
            }
          },
          'zh-CN': {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    }
  }
}) 