const Koa = require("koa");
const KoaStatic = require("koa-static");
const KoaRouter = require("koa-router");

class ZuoDeploy {
  start() {
    const app = new Koa();
    const router = new KoaRouter();

    router.post("/deploy", async (ctx) => {
      // 执行部署脚本
      // koa 注意异步 404 的问题
      let execFunc = () => {
        return new Promise((resolve, reject) => {
          try {
            this.runCmd("sh", ["./deploy-master.sh"], function (text) {
              resolve(text);
            });
          } catch (e) {
            console.log(e);
            reject(e);
          }
        });
      };
      try {
        let res = await execFunc();
        ctx.body = {
          code: 0,
          msg: res,
        };
      } catch (e) {
        ctx.body = {
          code: -1,
          msg: e.message,
        };
      }
    });

    app.use(new KoaStatic(__dirname + "/frontend"));
    app.use(router.routes()).use(router.allowedMethods());
    app.listen("7777", () => console.log("服务监听 7777 端口"));
  }

  // 使用子进程执行命令
  runCmd(cmd, args, callback) {
    const spawn = require("child_process").spawn;
    const child = spawn(cmd, args);
    let resp = "当前执行路径：" + process.cwd() + "\n";
    console.log(resp);
    child.stdout.on("data", function (buffer) {
      let info = buffer.toString();
      resp += info;
      console.log(info);
      // log 较多时，怎么实时将消息通过接口返给前端，只能是 socket ？
      // 除了 socket 怎么将 log 数据一点点通过接口传给前端
    });
    child.stdout.on("end", function () {
      callback(resp);
    });

    // shell 脚本执行错误信息也返回
    // let errorMsg = ""; // 错误信息 end、正常信息 end 可能有先后，统一成一个信息
    child.stderr.on("data", function (buffer) {
      let info = buffer.toString();
      resp += info;
      console.log(info);
    });
    child.stderr.on("end", function () {
      callback(resp);
    });
  }
}

module.exports = ZuoDeploy;
