const Koa = require("koa");
const KoaStatic = require("koa-static");
const KoaRouter = require("koa-router");
const session = require("koa-session");
const bodyParser = require("koa-bodyparser");
const path = require("path");
const fs = require("fs");
const runCmd = require("./utils/runCmd");
const logger = require("./utils/logger");

const app = new Koa();
const router = new KoaRouter();

app.use(bodyParser()); // 处理 post 请求参数

// 参数获取
let argsInfo = fs.readFileSync("args.json").toString();
let args = {};
try {
  args = JSON.parse(argsInfo);
} catch (e) {
  logger.info(e);
}

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
let socketList = [];
const server = require("http").Server(app.callback());
const socketIo = require("socket.io")(server);
socketIo.on("connection", (socket) => {
  socketList.push(socket);
  logger.info("a user connected");
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
        runCmd(
          "sh",
          ["./deploy-master.sh"],
          function (text) {
            resolve(text);
          },
          socketIo,
          "deploy-log"
        );
      } catch (e) {
        logger.info(e);
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

router.post("/runShell", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }

  let { shellText, shellName = "temp.sh" } = ctx.request.body;
  const shellFilePath = process.cwd() + "/" + shellName;
  console.log("shellFilePath", shellFilePath);
  try {
    fs.writeFileSync(shellFilePath, shellText);
  } catch (e) {
    console.log(e);
  }

  // // 执行部署脚本
  // // koa 注意异步 404 的问题
  let execFunc = () => {
    return new Promise((resolve, reject) => {
      try {
        runCmd(
          "sh",
          [shellFilePath],
          function (text) {
            resolve(text);
          },
          socketIo,
          "runShell"
        );
      } catch (e) {
        logger.info(e);
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

router.get("/shell/get", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }

  const files = fs.readdirSync(`${process.cwd()}`);
  let result = [];
  // files [ 'args.json', 'temp.sh', 'test.sh' ]
  files
    .filter((item) => !["args.json", "temp.sh"].includes(item))
    .forEach((filePath) => {
      let info = { name: filePath, content: "", desc: "" };
      const content = fs
        .readFileSync(`${process.cwd()}/${filePath}`)
        .toString();
      info.content = content;
      result.push(info);
    });

  // [
  //   { name: "1.sh", content: "ls\npwd\n", desc: "定时任务" },
  //   {
  //     name: "2.sh",
  //     content: "git pull;\n npm i && npm run build\n",
  //     desc: "项目部署",
  //   },
  // ],
  ctx.body = {
    code: 0,
    data: result,
    msg: "成功",
  };
});

router.post("/runCurShell", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }

  let { name } = ctx.request.body;
  const shellFilePath = process.cwd() + "/" + name;
  console.log("cur shellFilePath", shellFilePath);

  // // 执行部署脚本
  // // koa 注意异步 404 的问题
  let execFunc = () => {
    return new Promise((resolve, reject) => {
      try {
        runCmd(
          "sh",
          [shellFilePath],
          function (text) {
            resolve(text);
          },
          socketIo,
          "shell-log-" + name
        );
      } catch (e) {
        logger.info(e);
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

app.use(new KoaStatic(path.resolve(__dirname, "../frontend")));
app.use(router.routes()).use(router.allowedMethods());
server.listen(args.port, () => logger.info(`服务监听 ${args.port} 端口`));
