# 分支维护

| 分支 | 责任 | 允许修改 |
|---|---|---|
| master | 跟踪官方发布 | 只同步官方，不合并产品分支 |
| codex/xc-product | 长期产品分支 | 仅 custom/xc-product/ |

origin 是 https://github.com/guitars123/deepseek-harness.git。upstream 指向官方 https://github.com/deepseek-ai/deepseek-harness.git。发布记录应同时保留产品提交和已合并的原生提交。不要把旧的源码改造提交或独立产品仓库的无父提交直接合并到 master。

## 同步官方到 master

在工作树干净且当前 checkout 的 master 未被其他 worktree 使用时执行：

```sh
git fetch upstream master
git fetch origin master
git switch master
git merge --ff-only origin/master
git merge --ff-only upstream/master
git push origin master
```

如果尚未配置官方远端，先运行 git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git。master 快进失败时停止，检查本地或 fork 是否混入定制提交，不使用 reset --hard 或强推处理。

## 将 master 同步到产品分支

```sh
git fetch origin
git switch codex/xc-product
git merge --ff-only origin/codex/xc-product
git merge origin/master
pnpm install --frozen-lockfile
pnpm run build
cd custom/xc-product
pnpm install --frozen-lockfile
pnpm test
pnpm run build
pnpm run verify:upstream
```

检查插件、登录、真实模型对话、重登续聊、设置页和桌面连接。适配只修改 custom/xc-product/；检查完成后提交适配，再运行 git push origin codex/xc-product。采用普通 merge 保留共享历史，不反复 rebase 已发布产品分支，不强推，不把产品分支合回 master。

verify:upstream 会比较当前文件与本地 origin/master，拒绝产品目录以外的差异，包含已提交、暂存、未暂存和未忽略的新文件；执行前须成功 fetch，不能用过期远程引用证明已同步最新官方。Git 无冲突不代表插件 API 兼容，官方新增同名目录或改写历史时也仍可能冲突。

本机 E:/桌面/xc-project/deepseek-harness-master 的 master 含旧版定制提交 4a4749da，保留作历史版本，不用于快进同步官方。本产品工作树从干净的 687f282e 基线创建。
