# 部署与上线说明

## 1. 本地运行

### Windows

最简方式：双击 `start.bat`。

终端方式：

```powershell
cd "E:\大二\鼎甲杯\xunye"
node server\index.js
```

默认端口是 `3000`。自定义端口：

```powershell
$env:PORT="8080"
node server\index.js
```

### macOS / Linux

```bash
cd xunye
node server/index.js
```

Node.js 版本要求 24 或更高。

## 2. 局域网手机演示

1. 服务监听 `HOST=0.0.0.0`。
2. 查询电脑 IP：

   ```powershell
   ipconfig
   ```

3. 手机访问 `http://电脑IPv4:3000`。
4. 防火墙允许 Node.js。

校园网、酒店 Wi-Fi 经常开启客户端隔离，手机可能无法访问电脑。这种情况下使用手机热点，或者使用接下来介绍的云部署。

## 3. Docker 部署

```bash
docker compose up -d --build
```

访问：

- 手机端：`http://服务器IP:3000`
- 管理端：`http://服务器IP:3000/admin`

数据库通过 `./data:/app/data` 持久化。升级版本前备份 `data/xunye.db`。

生产环境建议在前面加 Nginx 并配置 HTTPS。Nginx 示例：

```nginx
server {
    listen 443 ssl http2;
    server_name xunye.example.com;

    ssl_certificate /etc/letsencrypt/live/xunye.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xunye.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 后把 `COOKIE_SECURE` 设置为 `1`。

## 4. 云平台部署

### Render

1. 把项目推送到 GitHub。
2. 新建 Web Service，Build Command 留空或填写 `true`。
3. Start Command 填写 `node server/index.js`。
4. 环境变量：
   - `HOST=0.0.0.0`
   - `COOKIE_SECURE=1`
   - `NODE_ENV=production`
5. 免费实例的本地磁盘可能不持久，必须挂载持久磁盘到 `/app/data`，否则重启后数据会重置。

### Railway

1. 连接仓库。
2. 启动命令 `node server/index.js`。
3. 挂载 Volume 到 `/app/data`。
4. 设置 HTTPS 环境变量。
5. Railway 会自动分配域名。

### 云服务器

推荐 Ubuntu 24.04 + Docker：

```bash
git clone <你的仓库地址>
cd <项目目录>
docker compose up -d --build
sudo ufw allow 80
sudo ufw allow 443
```

再使用 Caddy 可更简单地自动申请证书：

```caddyfile
xunye.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

## 5. 推送到当前 GitHub 仓库

当前仓库地址：

```text
https://github.com/DpGhostCat/-.git
```

在项目目录执行：

```powershell
git init
git add .
git commit -m "feat: build xunye mobile reading platform"
git branch -M main
git remote add origin https://github.com/DpGhostCat/-.git
git push -u origin main
```

GitHub 仓库已有 `README.md` 时，本地覆盖后正常提交即可。首次 `git push` 会要求登录 GitHub，请按浏览器授权流程操作。

## 6. 正式上线检查清单

- [ ] 修改全部演示账号默认密码。
- [ ] 配置 HTTPS 和 `COOKIE_SECURE=1`。
- [ ] 将管理员密码改为强密码。
- [ ] 接入真实短信/邮箱验证码。
- [ ] 接入真实支付，并在服务端验证支付签名和金额。
- [ ] 将模拟充值回调替换为支付平台回调。
- [ ] 增加图片上传、对象存储与内容安全审核。
- [ ] 配置每日数据库备份到异地。
- [ ] 配置访问日志、错误告警和进程守护。
- [ ] 补充用户协议、隐私政策和作者收益规则。
- [ ] 进行压力测试与支付对账测试。

