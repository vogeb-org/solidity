# 使用官方 Node.js 镜像作为基础镜像
# Use official Node.js image as the base image
FROM node:20.4.0-alpine AS build

# 设置工作目录
# Set the working directory
WORKDIR /usr/src/app

# 复制 package.json 和 pnpm-lock.yaml 文件到工作目录
# Copy package.json and pnpm-lock.yaml to the working directory
COPY package.json pnpm-lock.yaml ./

# 安装项目依赖
# Install project dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 安装 git / Install git
RUN apk update && apk add git

# 复制项目文件到工作目录
# Copy project files to the working directory
COPY . .

# 构建项目
# Build the project
RUN pnpm run docs:build

RUN echo "build success!"

# 使用一个更小的基础镜像来运行应用
# Use a smaller base image to run the application
FROM nginx:alpine

# 复制构建输出到 Nginx 目录
# Copy build output to Nginx directory
COPY --from=build /usr/src/app/docs/.vitepress/dist /usr/share/nginx/html

# 复制自定义的 Nginx 配置文件
# Copy custom Nginx configuration file
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
# Expose port
EXPOSE 80

# 启动 Nginx
# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
