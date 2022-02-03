# js-deploy
用 js 写一个 CI、CD 工具

## start
```bash
# 初始化 package.json
npm init

# 添加 eslint、prettier
npm install eslint@7.32.0 --save-dev
npx eslint --init # 初始化 .eslintrc.json 如果是 js，type 为 module 时改为 .cjs
# 支持 es modlues
# package.json 设置 type 为 module
npm install --save-dev --save-exact prettier
npm install eslint-config-prettier --save-dev # 处理与 eslint 的冲突
npm install eslint-plugin-prettier --save-dev # 将 prettier 以插件形式集成到 eslint 处理流程中
# prettier 如果配置没生效，重启 vscode 即可
# 配置参考 https://github.com/prettier/eslint-plugin-prettier

```
