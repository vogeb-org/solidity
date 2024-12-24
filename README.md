# Solidity Tutorial

A comprehensive tutorial on Solidity smart contract development, covering basic concepts, advanced applications, practical examples, and best practices.

[中文版本](./docs/zh-CN/README.md)

## Project Overview

This project aims to provide a comprehensive tutorial on Solidity smart contract development, helping developers master Solidity programming from basic to advanced levels. The tutorial content includes basic concepts, advanced applications, practical examples, and best practices.

## Project Structure

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

## Dependencies

This project relies on the following tools and libraries:

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/)
- [VitePress](https://vitepress.vuejs.org/)

## Installation

First, make sure you have installed [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/). Then run the following command in the project root directory to install the dependencies:

```sh
pnpm install
```

## Development Setup

Run the following command in the project root directory to start the development server:

```sh
pnpm run docs:dev
```

Once the development server is started, you can view the documentation in your browser at `http://localhost:3000`.

## Deployment

### Deploy with Docker

1. Build the Docker image:

```sh
docker-compose build
```

2. Start the Docker container:

```sh
docker-compose up
```

3. Once deployed, you can view the documentation in your browser at `http://localhost`.

### Manual Deployment

1. Build the static files:

```sh
pnpm run docs:build
```

2. Copy the generated static files (located in the `dist` directory) to your static file server (e.g., Nginx).

## Contributing

We welcome issues and pull requests to help improve this project. Please ensure your contributions adhere to the following guidelines:

1. Fork this repository and create your branch.
2. Commit your changes and push them to your branch.
3. Create a Pull Request and describe your changes.

## License

This project is licensed under the MIT License.
