# Mineradio Web

Mineradio 的自托管网页音乐播放器。项目包含浏览器播放器界面和 Node.js 服务端：服务端负责静态页面、搜索、播放地址、歌词及登录会话代理；前端提供粒子歌词、播放队列、搜索和歌单交互。

这是纯 Web 项目，不包含 Android、Capacitor、Gradle 或 APK 构建流程。

## 运行要求

- Node.js 20 或 22
- npm

## 本地运行

```bash
npm ci
npm run build
npm start
```

默认服务地址为 `http://127.0.0.1:3000`。

开发前端时可使用：

```bash
npm run dev
```

## 目录说明

```text
public/   浏览器播放器源码
server/   Node.js API 与静态文件服务
api/      适用于部分托管平台的 API 入口
www/      npm run build 生成的静态文件（不提交）
```

## 生产部署

建议让 Node.js 服务仅监听 `127.0.0.1:3000`，再由 Nginx 对外反向代理。Cookie 持久化目录可设置为 `/var/lib/mineradio-mobile`。

```bash
npm ci
npm run build
node server/mobile-server.js
```

在生产环境中请使用 systemd 守护该进程，并通过 Nginx 提供公网访问。

## 说明

- 项目不是网易云音乐或 QQ 音乐的官方客户端。
- 不绕过平台会员、付费内容或版权限制。
- 登录会话和 Cookie 应只保存在你自己的服务器或浏览器中，不要提交到 Git。

## License

GPL-3.0，继承自 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)。
