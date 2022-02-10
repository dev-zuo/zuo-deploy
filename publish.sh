npm config set registry=https://registry.npmjs.org
npm login # 登陆 ，如果有 OTP, 邮箱会接收到验证码，输入即可
# 登录成功后，短时间内会保存状态，可以直接 npm pubish
npm publish # 可能会提示名称已存在，换个名字，获取使用作用域包（@xxx/xxx）
npm config set registry=https://registry.npm.taobao.org # 还原淘宝镜像