const Koa = require("koa");
const KoaStatic = require("koa-static");
const KoaRouter = require("koa-router");
const session = require("koa-session");
const bodyParser = require("koa-bodyparser");

class ZuoDeploy {
  constructor() {
    this.io = "";
    this.socketList = [];
  }

  start(args) {
    console.log(args);
    const app = new Koa();
    const router = new KoaRouter();

    app.use(bodyParser()); // 处理 post 请求参数

    // 集成 session
    app.keys = [`${args.password}`]; // 'some secret hurr'
    const CONFIG = {
      key: "koa:sess" /** (string) cookie key (default is koa:sess) */,
      /** (number || 'session') maxAge in ms (default is 1 days) */
      /** 'session' will result in a cookie that expires when session/browser is closed */
      /** Warning: If a session cookie is stolen, this cookie will never expire */
      maxAge: 0.5 * 3600 * 1000, // 0.5h
      overwrite: true /** (boolean) can overwrite or not (default true) */,
      httpOnly: true /** (boolean) httpOnly or not (default true) */,
      signed: true /** (boolean) signed or not (default true) */,
      rolling: false /** (boolean) Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) */,
      renew: false /** (boolean) renew session when session is nearly expired, so we can always keep user logged in. (default is false)*/,
    };
    app.use(session(CONFIG, app));

    // 开启 socket 服务
    const server = require("http").Server(app.callback());
    const io = require("socket.io")(server);
    io.on("connection", (socket) => {
      this.io = io;
      this.socketList.push(socket);
      console.log("a user connected");
    });

    router.get("/isLogin", async (ctx) => {
      ctx.body = {
        code: 0,
        data: !!ctx.session.isLogin,
        msg: "false 未登录，true 登录",
      };
    });

    router.post("/login", async (ctx) => {
      let code = 0;
      let msg = "登录成功";
      let { password } = ctx.request.body;
      if (password === `${args.password}`) {
        ctx.session.isLogin = true;
      } else {
        code = -1;
        msg = "密码错误";
      }
      ctx.body = {
        code,
        msg,
      };
    });

    router.post("/deploy", async (ctx) => {
      if (!ctx.session.isLogin) {
        ctx.body = {
          code: -2,
          msg: "未登录",
        };
        return;
      }

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
    server.listen(args.port, () => console.log(`服务监听 ${args.port} 端口`));
  }

  // 使用子进程执行命令
  runCmd(cmd, args, callback) {
    const spawn = require("child_process").spawn;
    const child = spawn(cmd, args);
    let resp = "当前执行路径：" + process.cwd() + "\n";
    console.log(resp);
    child.stdout.on("data", (buffer) => {
      let info = buffer.toString();
      info = `${new Date().toLocaleString()}: ${info}`;
      resp += info;
      console.log(info);
      // console.log(new Date().toLocaleString);
      this.io.emit("deploy-log", info);
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
      console.log(info);
      this.io.emit("deploy-log", info);
    });
    child.stderr.on("end", function () {
      callback(resp);
    });
  }
}

module.exports = ZuoDeploy;
