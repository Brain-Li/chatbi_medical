# ChatBI Medical 部署与迭代更新手册

本文记录当前 ChatBI Medical 前端项目的部署方式和日常更新步骤，供后续直接查阅。

> 重要：本手册只操作 ChatBI，不修改量化系统的代码、Nginx 配置、服务或数据。

## 1. 当前部署信息

| 项目 | 当前值 |
| --- | --- |
| 本机项目目录 | `C:\Users\Li\Desktop\chatbi_medical` |
| GitHub 仓库 | `git@github.com:Brain-Li/chatbi_medical.git` |
| 服务器登录账户 | `ops` |
| 服务器 ChatBI 运行账户 | `chatbi`（不能 SSH 登录） |
| 服务器代码目录 | `/opt/chatbi-medical/app` |
| 构建产物目录 | `/opt/chatbi-medical/app/dist` |
| Nginx 配置 | `/etc/nginx/sites-available/chatbi-medical` |
| 访问地址（HTTP） | `http://chatbi.quantitativeanalysis.cn` |

当前项目是 Vite/React 静态前端：Nginx 直接托管 `dist` 文件，**没有独立的 Node 后端服务，也不需要 systemd 服务**。

## 2. 日常发布：本机推送代码

在 Windows PowerShell 打开项目目录：

```powershell
cd C:\Users\Li\Desktop\chatbi_medical
```

先查看本次修改：

```powershell
git status
```

`.gitignore` 已排除以下无需部署或不应上传的内容：

- `node_modules/`：可在服务器通过 `npm ci` 重新安装。
- `dist/`：构建产物，服务器会重新生成。
- `.env`、`.env.*`：可能含密码、密钥或真实配置。
- `artifacts/`：设计比对截图和开发过程图片。

不要把真实 API Key、密码、数据库文件、压缩包、大数据集或无关视频提交到 GitHub。页面运行必须用到的 `src/assets/` 图片、SVG、字体等资源应保留在仓库中。

暂存并复核：

```powershell
git add .
git diff --cached --stat
git diff --cached --name-only
```

确认列表中没有 `.env`、`node_modules/`、`dist/`、`artifacts/` 或无关大文件后，提交并推送：

```powershell
git commit -m "feat: 简要描述本次修改"
git push
```

如果 GitHub 推送提示网络连接失败，先检查本机网络和 Git 代理配置：

```powershell
Test-NetConnection github.com -Port 443
git config --global --get-regexp "http\..*proxy|https\..*proxy"
```

## 3. 日常发布：服务器更新并重新构建

登录服务器：

```powershell
ssh ops@101.43.3.191
```

在服务器执行以下四步。不要直接 `cd /opt/chatbi-medical/app` 后运行 npm：`ops` 没有该私有目录的读取权限。必须使用 `chatbi` 用户执行。

```bash
# 1. 拉取 GitHub 上刚推送的新代码；--ff-only 避免意外生成合并提交
sudo -H -u chatbi bash -c 'cd /opt/chatbi-medical/app && git pull --ff-only'

# 2. 按 package-lock.json 安装精确依赖
sudo -H -u chatbi bash -c 'cd /opt/chatbi-medical/app && npm ci'

# 3. 重新生成 dist 静态文件
sudo -H -u chatbi bash -c 'cd /opt/chatbi-medical/app && npm run build'

# 4. 确保 Nginx 可以读取新的构建文件
sudo chmod -R a+rX /opt/chatbi-medical/app/dist
```

检查 Nginx 配置并无中断地加载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

只有 `sudo nginx -t` 显示 `syntax is ok` 和 `test is successful` 时，才执行 reload。

> `reload` 不会中断已有站点；不要为了更新纯前端项目而重启量化系统或重启整台服务器。

## 4. 发布后验证

先在服务器确认构建产物存在：

```bash
sudo -H -u chatbi ls -la /opt/chatbi-medical/app/dist
```

应看到 `index.html` 和 `assets` 目录。

再用浏览器访问：

```text
http://chatbi.quantitativeanalysis.cn
```

浏览器可能缓存旧的静态资源。若页面没有显示新版本，使用 `Ctrl + F5` 强制刷新，或开无痕窗口重新访问。

可在服务器直接测试 Nginx 是否按域名转发到 ChatBI：

```bash
curl -I -H 'Host: chatbi.quantitativeanalysis.cn' http://127.0.0.1
```

期望状态为 `HTTP/1.1 200 OK`，或首次访问时为正常的 `301/302` 跳转（未来启用 HTTPS 后）。

## 5. 常见问题

### 5.1 `Permission denied` 或在 `/home/ops` 找不到 `package.json`

原因：`ops` 无权直接进入 `/opt/chatbi-medical`，导致命令在错误目录运行。

解决：不要使用普通的 `cd`；使用本手册第 3 节中的命令：

```bash
sudo -H -u chatbi bash -c 'cd /opt/chatbi-medical/app && npm run build'
```

### 5.2 `sudo: you are not permitted to use the -D option`

该服务器的 sudo 策略不允许 `--chdir`。不要用 `sudo --chdir=...`，改用本手册中的 `sudo -H -u chatbi bash -c 'cd ... && 命令'`。

### 5.3 `git pull` 认证失败

ChatBI 服务器使用独立部署密钥，私钥位置为：

```text
/opt/chatbi-medical/.ssh/id_ed25519
```

确认 GitHub 仓库 `Brain-Li/chatbi_medical` 的：

```text
Settings → Deploy keys
```

中仍有名为 `tencent-cloud-chatbi` 的只读部署密钥。不要把服务器私钥复制到本机或发给他人。

### 5.4 Nginx 配置报错或页面 404

查看语法与错误日志：

```bash
sudo nginx -t
sudo tail -n 80 /var/log/nginx/error.log
```

确认 ChatBI 配置中的两项完全一致：

```nginx
server_name chatbi.quantitativeanalysis.cn;
root /opt/chatbi-medical/app/dist;
```

不要编辑量化系统的 Nginx 配置文件。

### 5.5 本机无法推送 GitHub

这通常是本机网络、代理或 GitHub 连接问题，不是服务器问题。检查：

```powershell
Test-NetConnection github.com -Port 443
git remote -v
```

当前仓库远程地址应为：

```text
git@github.com:Brain-Li/chatbi_medical.git
```

## 6. 后续启用 HTTPS（可选，但推荐）

当前站点已通过 HTTP 可访问。若未来接入真实登录、医疗数据、文件上传或 API Key，应启用 HTTPS。

前提：

1. 腾讯云安全组放行 TCP `443`。
2. 若 UFW 已启用，在服务器放行 TCP `443`。
3. `chatbi.quantitativeanalysis.cn` 的 A 记录仍解析到 `101.43.3.191`。

执行：

```bash
sudo ufw allow 443/tcp
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chatbi.quantitativeanalysis.cn
sudo certbot renew --dry-run
```

Certbot 询问是否将 HTTP 自动跳转 HTTPS 时，选择重定向即可。该证书操作只会作用于 `chatbi.quantitativeanalysis.cn`，不会改动量化系统。

## 7. 当前项目边界

当前仓库包含模拟登录和模拟数据。部署完成代表前端页面可以稳定访问，不代表已具备真实后端、用户数据库、医疗数据存储或 AI 接口。未来接入这些能力时，需要额外部署 API 服务、数据库和环境变量，并为敏感数据强制启用 HTTPS。
