const fs = require("fs");
const logger = require("./logger");
let timeoutTimer = undefined;

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
  socketIo &&
    socketIo.emit(
      msgTag,
      `>>> [system] child pid ${child.pid}, 正在运行中....`
    );
  let startTime = +new Date();
  let dataFunc = (buffer) => {
    if (child.killed) {
      // 如果已结束
      callback("运行超时，已停止", "isError");
      timeoutTimer && clearTimeout(timeoutTimer);
      socketIo && socketIo.emit(msgTag, `[system] child.killed, 结束`);
      return;
    }
    let info = buffer.toString();
    info = `${new Date().toLocaleString()}: ${info}`;
    resp += info;
    logger.info(info);
    socketIo && socketIo.emit(msgTag, info);
    // console.log(child);
    // log 较多时，怎么实时将消息通过接口返给前端，只能是 socket ？
    // 除了 socket 怎么将 log 数据一点点通过接口传给前端
  };
  child.stdout.on("data", dataFunc);
  child.stdout.on("end", function () {
    console.log(">>stdout end");
    callback(resp);
    timeoutTimer && clearTimeout(timeoutTimer);
    // socketIo && socketIo.emit(msgTag, `[system] child stdout end`);
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
    console.log(">>err end");
    callback(resp);
    timeoutTimer && clearTimeout(timeoutTimer);
    // socketIo && socketIo.emit(msgTag, `[system] child stderr end`);
  });

  child.on("close", (code) => {
    console.log(">>close", code);
    if (code !== 0) {
      // let log = `[system] child 子进程非正常退出，ps process exited with code ${code}`;
      // socketIo && socketIo.emit(msgTag, log);
    }
    let useTime = (+new Date() - startTime) / 1000;
    socketIo &&
      socketIo.emit(
        msgTag,
        `>>> [system] child close 完成运行! 耗时：${useTime}s`
      );
  });

  const TIME_OUT_SEC = 1000 * 60;
  timeoutTimer = setTimeout(() => {
    let log = `>>> [system] 执行超时 ${TIME_OUT_SEC / 1000}s，结束执行!`;
    socketIo && socketIo.emit(msgTag, log);
    child.kill();
  }, TIME_OUT_SEC);
}

module.exports = runCmd;
