# 使用 Nginx 镜像作为基础镜像
FROM nginx:alpine

# 维护者信息（可选）
LABEL maintainer="1657677267@qq.com"

# 删除默认的 Nginx 静态页面
RUN rm -rf /usr/share/nginx/html/*

# 将构建的静态文件复制到 Nginx 默认静态目录
COPY .vitepress/dist /usr/share/nginx/html

# 暴露 Nginx 默认端口
EXPOSE 80

# 启动 Nginx 服务
CMD ["nginx", "-g", "daemon off;"]
