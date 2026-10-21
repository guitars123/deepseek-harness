# 胥瓷智库：独立产品层

产品分支 codex/xc-product 继承 guitars123/deepseek-harness 的原生提交历史。所有定制文件只放在 custom/xc-product/；仓库根目录是原生 DSH，原生文件不打补丁。网关通过官方 dsh CLI、profile overlay 和外部 Cordis 插件组合产品。

| 组件 | 责任 |
|---|---|
| gateway/ | 账号登录、加密持久登录、HTTP/升级请求代理、账号到 DSH 实例映射 |
| plugins/xc-ui/ | 原生 slot 注册账号菜单、余额设置页、品牌图标；ECharts SVG 趋势 |
| desktop/ | Electron 远程界面壳，不启动本机 DSH |
| 仓库根目录 ../.. | 原生 DSH，由 master 单向同步 |
| .data/users/<hash>/ | 每账号独立 DSH_HOME、工作目录、持久会话 |

## 本地启动

要求 Node 24、pnpm，先在仓库根目录运行原生构建。产品有独立 pnpm workspace 和锁文件，不修改根目录依赖配置。

~~~powershell
git switch codex/xc-product
pnpm install --frozen-lockfile
pnpm run build
cd custom/xc-product
pnpm install --frozen-lockfile
pnpm run build
Copy-Item .env.example .env
pnpm start
~~~

打开 http://127.0.0.1:3090。账号来自部署配置的账号服务；代码不含用户名、密码或 API 密钥。登录先验证账号及模型，再启动该账号专属实例。外部只获得产品 Cookie，DSH 启动 token 和内部 Cookie 留在网关。

桌面开发：pnpm desktop。desktop/config.json 指向服务器 HTTPS 地址后运行 pnpm desktop:pack。首次安装 Electron 需要运行 pnpm approve-builds 并批准 Electron 安装脚本，或显式运行 node node_modules/electron/install.js。桌面禁用 Node 集成、开启 sandbox/contextIsolation，站外链接交给系统浏览器。

## 使用与恢复

退出登录只撤销产品会话，保留用户 DSH 数据。再次登录使用服务端认证返回的稳定账号 ID 找回同一目录。网关重启后从加密文件恢复登录，按需重启同一 DSH_HOME。备份整个 .data/，包含 session.key；丢失密钥无法解密登录记录。密码不落盘，JWT 和模型密钥加密存储，DSH 子进程只接收当前账号模型密钥。

通用设置、模型、插件、预设使用原生页面及原生 owner 权限，作用于当前账号的独立 DSH_HOME，不通过共享实例伪造用户权限。模型初始路由由账号有效 API Key 配置。

## 部署边界

进程模式提供应用数据隔离，多个进程仍共享服务器操作系统身份。启用 shell/文件工具并面向不可信公网用户时，必须给每账号实例配置独立容器或系统账号及资源限制，再上线；仅凭目录不同不能承诺恶意用户之间的文件系统安全。当前默认进程模式适合可信内测。

HTTPS 反向代理只转发至网关，DSH 只监听 127.0.0.1，不公开每用户端口。设置 XC_PUBLIC_URL 为对外完整 origin；代理需保留 Host 和 WebSocket Upgrade。服务器执行、附件上传均由服务端 DSH 负责，本机绝对路径不可当作服务器路径。

当前 UI 只替换官方已有 slot，不复制官方聊天界面。官方首页仍保留原有无 slot 文案；无法宣称对当前 fork 的全部视觉逐像素复刻。官方 API 尚未稳定，升级需重新构建和验证插件兼容性。

## 检查与升级

~~~powershell
pnpm test
pnpm run build
pnpm run verify:upstream
~~~

同步流程见 BRANCHING.md。升级前备份数据，master 只接受官方更新，产品分支只接受 master 的合并。安装和构建原生 DSH 后，在本目录重建插件并验证登录、账号互不可见、退出重登、会话续聊、四个设置页和桌面连接。原生文件保持干净不代表上游接口变化永远无需适配。
