#!/usr/bin/env node

const { program } = require("commander");

program.version(require("../package.json").version);

program
  .command("start")
  .description("开启部署监听服务") // description + action 可防止查找 command拼接文件
  .option("-p, --port <port>", "指定部署服务监听端口", 7777)
  .option("-w, --password <key>", "设置登录密码", 888888)
  .action((args) => {
    require("./start")(args); // args 为 { port: '12323', password: '999' }
  });

program.parse();
