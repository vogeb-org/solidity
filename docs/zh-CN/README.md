# Solidity教程

Solidity智能合约开发教程，涵盖基础概念、高级应用、实战案例和最佳实践。

[English Version](../../README.md)

## 项目简介

本项目旨在提供一个全面的Solidity智能合约开发教程，帮助开发者从基础到高级逐步掌握Solidity编程。教程内容包括基础概念、高级应用、实战案例和最佳实践。

## 项目结构

```
.
├── .dockerignore
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── docs/
│   ├── .vitepress/
│   │   ├── cache/
│   │   ├── config.ts
│   │   ├── theme/
│   │   │   ├── custom.css
│   │   │   └── index.ts
│   ├── advanced/
│   ├── basic/
│   ├── guide/
│   ├── index.md
│   └── zh-CN/
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

## 依赖项

本项目依赖以下工具和库：

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/)
- [VitePress](https://vitepress.vuejs.org/)

## 安装

首先，确保你已经安装了 [Node.js](https://nodejs.org/) 和 [pnpm](https://pnpm.io/)。然后在项目根目录下运行以下命令来安装依赖：

```sh
pnpm install
```

## 开发环境设置

在项目根目录下运行以下命令来启动开发服务器：

```sh
pnpm run docs:dev
```

开发服务器启动后，可以在浏览器中访问 `http://localhost:3000` 查看文档。

## 部署

### 使用 Docker 部署

1. 构建 Docker 镜像：

```sh
docker-compose build
```

2. 启动 Docker 容器：

```sh
docker-compose up
```

3. 部署完成后，可以在浏览器中访问 `http://localhost` 查看文档。

### 手动部署

1. 构建静态文件：

```sh
pnpm run docs:build
```

2. 将生成的静态文件（位于 `dist` 目录下）复制到你的静态文件服务器（如 Nginx）中。

## 贡献

欢迎提交问题和拉取请求来帮助改进本项目。请确保你的贡献符合以下指南：

1. Fork 本仓库并创建你的分支。
2. 提交你的修改并推送到你的分支。
3. 创建一个 Pull Request 并描述你的修改内容。

## 许可证

本项目基于 MIT 许可证发布。