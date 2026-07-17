# Mineradio Web

一个可自托管的个人网页音乐播放器。它提供搜索、播放队列、歌单、歌词与沉浸式粒子视觉，并以 Node.js 服务统一提供网页和 API 代理。

> 这是个人使用的 Web 播放器，不是 QQ 音乐或网易云音乐的官方客户端。本仓库不再包含 Android、Capacitor、Gradle 或 APK 构建工程。

## 功能

- 搜索、播放、上一首/下一首、循环与当前播放队列
- QQ 音乐与网易云音乐的歌单、歌曲信息、歌词及登录会话支持（取决于上游服务和账号权限）
- 桌面端歌单架、沉浸式播放器与可切换的歌词/粒子视觉
- 移动端独立的搜索、歌单、设置和账户入口
- 播放队列与部分播放状态保存在浏览器本地，刷新后可继续使用
- 质量档位与视觉性能设置，适合在网络或设备性能有限时降低负载

## 使用边界

- 请只在自己控制的环境中部署和使用。
- 平台内容是否可搜索、播放或登录，受账号、地区、版权和上游接口状态影响。
- 不提供下载、绕过会员、付费或版权限制的功能。
- 服务端 Cookie 代表服务器上的登录会话；不要将带有个人 Cookie 的实例开放给不受信任的访客，也不要把 Cookie 文件提交到 Git。

## 环境要求

- Node.js 20 或 22
- npm

生产环境建议使用 Linux、systemd 与 Nginx。

## 本地运行

```bash
git clone https://github.com/Toloung/Mineradio-Web.git
cd Mineradio-Web
npm ci
npm run build
npm start
```

打开 `http://127.0.0.1:3000`。

仅调整前端样式时可以使用 Vite 开发服务器：

```bash
npm run dev
```

`npm run dev` 主要用于界面开发；需要完整搜索、播放和登录 API 时，请使用 `npm start`。

## 项目结构

```text
public/                播放器前端源码
  index.html           主界面与桌面端交互
  mobile-player.css    移动端布局与样式
  home-player.*        播放器、队列、歌词和视觉效果
server/
  web-server.js        静态站点与 API 代理入口
  server.js            上游音乐服务 API 适配
api/                   部分托管环境使用的 API 入口
www/                   npm run build 生成的部署目录
```

`www/` 是构建产物。修改 `public/` 后必须重新执行 `npm run build`，再部署新的 `www/`。

## 配置

`server/web-server.js` 支持以下环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 网页服务端口；内部 API 使用 `PORT + 1` |
| `HOST` | `0.0.0.0` | 网页服务监听地址 |
| `STATIC_DIR` | `../www` | 构建产物目录 |
| `COOKIE_FILE` | `server/.cookie` | 网易云登录 Cookie 文件 |
| `QQ_COOKIE_FILE` | `server/.qq-cookie` | QQ 音乐登录 Cookie 文件 |

公网部署时，请让 Node.js 仅监听 `127.0.0.1`，并把 Cookie 放在应用目录外的受限路径，例如 `/var/lib/mineradio-web`。

## Ubuntu 生产部署

以下示例将网页通过 Nginx 暴露在 `8088`，而 Node.js 与内部 API 都不会直接暴露到公网。

### 1. 构建与持久化目录

```bash
sudo mkdir -p /opt/mineradio-web /var/lib/mineradio-web
sudo chown -R www-data:www-data /var/lib/mineradio-web

cd /opt/mineradio-web
npm ci
npm run build
```

将仓库文件部署到 `/opt/mineradio-web`。若服务使用专用用户，请把上面示例中的 `www-data` 替换成该用户。

### 2. systemd 服务

创建 `/etc/systemd/system/mineradio-web.service`：

```ini
[Unit]
Description=Mineradio Web
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mineradio-web
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=STATIC_DIR=/opt/mineradio-web/www
Environment=COOKIE_FILE=/var/lib/mineradio-web/netease.cookie
Environment=QQ_COOKIE_FILE=/var/lib/mineradio-web/qq.cookie
ExecStart=/usr/bin/node /opt/mineradio-web/server/web-server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mineradio-web
sudo systemctl status mineradio-web
```

### 3. Nginx 反向代理

创建一个 Nginx server 配置（例如 `/etc/nginx/sites-available/mineradio-web`）：

```nginx
server {
    listen 8088;
    server_name _;
    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

只需要在防火墙或安全组中放行 `8088`；不要放行 `3000` 或内部 API 使用的 `3001`。

### 4. 验证

```bash
curl -I http://127.0.0.1:3000/
curl --get \
  --data-urlencode "keywords=许嵩" \
  --data-urlencode "limit=1" \
  http://127.0.0.1:3000/api/search
curl -I http://127.0.0.1:8088/
```

常用排查命令：

```bash
sudo systemctl status mineradio-web
sudo journalctl -u mineradio-web -f
sudo systemctl restart mineradio-web
```

## 更新部署

```bash
cd /opt/mineradio-web
git pull
npm ci
npm run build
sudo systemctl restart mineradio-web
```

更新时不要删除 `/var/lib/mineradio-web`，否则服务器保存的登录会话会丢失。

## 许可证

本项目基于 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) 演进，按 GPL-3.0 许可证发布。
