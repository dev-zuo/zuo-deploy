const fs = require("fs");
const logger = require("./logger");

// 使用子进程执行命令
function runCmd(cmd, args, callback, socketIo, msgTag = "common-msg") {
  const spawn = require("child_process").spawn;
  const child = spawn(cmd, args); // sh xxx.sh
  let resp = "";
  // let resp = "当前执行路径：" + process.cwd() + "\n";
  // logger.info(resp);
  // socketIo && socketIo.emit(msgTag, resp);
  // let shellCmd = cmd + " " + args + "\n";
  let shellText = args[0].includes(".sh")
    ? fs.readFileSync(args[0] || "").toString()
    : "";
  // socketIo && socketIo.emit(msgTag, `开始执行脚本： ${shellCmd}`);
  socketIo && socketIo.emit(msgTag, `--------------`);
  socketIo && socketIo.emit(msgTag, shellText);
  socketIo && socketIo.emit(msgTag, `--------------`);
  child.stdout.on("data", (buffer) => {
    let info = buffer.toString();
    info = `${new Date().toLocaleString()}: ${info}`;
    resp += info;
    logger.info(info);
    socketIo && socketIo.emit(msgTag, info);
    // log 较多时，怎么实时将消息通过接口返给前端，只能是 socket ？
    // 除了 socket 怎么将 log 数据一点点通过接口传给前端
  });
  child.stdout.on("end", function () {
    callback(resp);
  });

  // shell 脚本执行错误信息也返回
  // let errorMsg = ""; // 错误信息 end、正常信息 end 可能有先后，统一成一个信息
  child.stderr.on("data", (buffer) => {
    let info = buffer.toString();
    info = `${new Date().toLocaleString()}: ${info}`;
    resp += info;
    logger.info(info);
    socketIo && socketIo.emit(msgTag, info);
  });
  child.stderr.on("end", function () {
    callback(resp);
  });
}

module.exports = runCmd;
