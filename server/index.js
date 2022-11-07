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
    ctx.body = {
      code: -1,
      msg: e.message,
    };
  }

  // // 执行部署脚本
  // // koa 注意异步 404 的问题
  let execFunc = () => {
    return new Promise((resolve, reject) => {
      try {
        runCmd(
          "sh",
          [shellFilePath],
          function (text, isError) {
            isError ? reject(new Error(text)) : resolve(text);
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
  let filesFilter = files.filter((item) => {
    if (["args.json", "temp.sh"].includes(item)) {
      return false;
    }
    if (item.startsWith(".")) {
      return false;
    }
    return true;
  });
  console.log(filesFilter);

  filesFilter.forEach((filePath) => {
    console.log(`'${filePath}'`);
    let info = { name: filePath, content: "", desc: "" };
    try {
      const content = fs
        .readFileSync(`${process.cwd()}/${filePath}`)
        .toString();
      info.content = content;
      result.push(info);
    } catch (e) {
      console.log("非文件", e.message);
    }
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
    data: {
      processCwd: process.cwd(),
      shellList: result,
    },
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

router.post("/saveFile", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }
  let { name, content, curPath } = ctx.request.body;
  console.log(name, content, curPath);
  !curPath && (curPath = ".");
  let prePath = curPath.startsWith("/")
    ? curPath
    : path.join(process.cwd(), curPath);

  const filePath = prePath + (prePath.endsWith("/") ? "" : "/") + name;
  console.log("filePath", filePath, prePath);
  try {
    fs.writeFileSync(filePath, content);
    ctx.body = {
      code: 0,
      msg: "成功",
    };
  } catch (e) {
    console.log(e);
    ctx.body = {
      code: -1,
      msg: `文件 '${filePath}' 创建失败，` + e.message,
    };
  }
});

router.post("/editFile", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }
  let { name, content, curPath } = ctx.request.body;
  // console.log(name, content, curPath);
  !curPath && (curPath = ".");
  let prePath = curPath.startsWith("/")
    ? curPath
    : path.join(process.cwd(), curPath);
  const filePath = prePath + (prePath.endsWith("/") ? "" : "/") + name;
  // console.log("filePath", filePath, prePath);
  try {
    fs.writeFileSync(filePath, content);
    ctx.body = {
      code: 0,
      msg: "成功",
    };
  } catch (e) {
    console.log(e);
    ctx.body = {
      code: -1,
      msg: `文件 '${filePath}' 修改失败，` + e.message,
    };
  }
});

router.post("/deleteFile", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }
  let { name, curPath } = ctx.request.body;
  console.log(name, curPath);
  !curPath && (curPath = ".");
  let prePath = curPath.startsWith("/")
    ? curPath
    : path.join(process.cwd(), curPath);
  const filePath = prePath + (prePath.endsWith("/") ? "" : "/") + name;
  // console.log("filePath", filePath, prePath);
  try {
    fs.rmSync(filePath);
    ctx.body = {
      code: 0,
      msg: "成功",
    };
  } catch (e) {
    console.log(e);
    ctx.body = {
      code: -1,
      msg: `文件 '${filePath}' 删除失败，` + e.message,
    };
  }
});

router.get("/nginx/get", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }
  let { curPath } = ctx.query;
  console.log(">>", curPath);

  try {
    const content = fs.readFileSync(curPath).toString();
    ctx.body = {
      code: 0,
      data: content,
      msg: "成功",
    };
  } catch (e) {
    ctx.body = {
      code: -3,
      msg: e.message,
    };
  }
});

router.get("/nginx/multipleGet", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }
  let { curPath } = ctx.query;
  console.log(">>", curPath);

  let files = [];
  try {
    files = fs.readdirSync(curPath);
  } catch (e) {
    ctx.body = {
      code: -3,
      msg: e.message,
    };
    return;
  }

  let result = [];
  // files [ 'args.json', 'temp.sh', 'test.sh' ]
  let filesFilter = files.filter((item) => {
    // if ([].includes(item)) {
    //   return false;
    // }
    if (item.startsWith(".")) {
      return false;
    }
    return true;
  });
  console.log(filesFilter);

  filesFilter.forEach((filePath) => {
    console.log(`'${filePath}'`);
    let info = { name: filePath, content: "", desc: "" };
    try {
      const content = fs.readFileSync(`${curPath}/${filePath}`).toString();
      info.content = content;
      result.push(info);
    } catch (e) {
      console.log("非文件", e.message);
    }
  });
  ctx.body = {
    code: 0,
    data: result,
    msg: "成功",
  };
});

router.get("/https/get", async (ctx) => {
  if (!ctx.session.isLogin) {
    ctx.body = {
      code: -2,
      msg: "未登录",
    };
    return;
  }
  let { curPath } = ctx.query;
  console.log(">>", curPath);

  let files = [];
  let finalPath = curPath + (curPath.endsWith("/") ? "" : "/") + "cert";
  let isExist = true;
  try {
    fs.statSync(finalPath);
  } catch (e) {
    // stats 失败 Error: ENOENT: no such file or directory, stat '/etc/nginx/cert'
    // 文件不存在，创建该目录
    isExist = false;
  }

  try {
    !isExist && fs.mkdirSync(finalPath);
    files = fs.readdirSync(finalPath);
  } catch (e) {
    ctx.body = {
      code: -3,
      msg: e.message,
    };
    return;
  }

  let result = [];
  // files [ 'args.json', 'temp.sh', 'test.sh' ]
  let filesFilter = files.filter((item) => {
    // if ([].includes(item)) {
    //   return false;
    // }
    if (item.startsWith(".")) {
      return false;
    }
    return true;
  });
  console.log(filesFilter);

  filesFilter.forEach((filePath) => {
    console.log(`'${filePath}'`);
    let info = { name: filePath, content: "", desc: "" };
    const content = fs.statSync(`${finalPath}/${filePath}`);
    info.content = content;
    result.push(info);
  });
  ctx.body = {
    code: 0,
    data: result,
    msg: "成功",
  };
});

const multer = require("@koa/multer");
// 文件上传处理
// 前端 append 文件时使用的是 image 字段
let singleFileConfig = multer().single("image");
let multipleFilesConfig = multer().fields([
  {
    name: "image",
    maxCount: 5,
  },
]);
let isMultiple = true;
let fileConfig = isMultiple ? multipleFilesConfig : singleFileConfig;
router.post("/upload", fileConfig, async (ctx) => {
  // 文件外的其他 FormData数据 { param1: 'abc' }
  console.log("ctx.request.body", ctx.request.body);
  console.log("ctx.files", ctx.files); // 多文件，返回 { 字段1: [file数组], 字段2: [file数组] }
  console.log("ctx.file", ctx.file); // 单文件，返回 file 对象
  let { curPath } = ctx.request.body;
  let finalPath = curPath + (curPath.endsWith("/") ? "" : "/");

  // 如果是单文件取文件内容，如果是多文件，取第一个文件，前端字段传的 image
  // 在服务端本地创建文件
  try {
    if (isMultiple) {
      let files = ctx.files["image"];
      files.forEach((item) => {
        let { originalname, buffer } = item;
        fs.writeFileSync(finalPath + originalname, buffer);
      });
    } else {
      let { originalname, buffer } = ctx.file;
      fs.writeFileSync(finalPath + originalname, buffer);
    }
    ctx.body = {
      code: 0,
      msg: "成功",
      data: ctx.request.body,
    };
  } catch (e) {
    ctx.body = {
      code: -4,
      msg: e.message,
    };
  }
  // {
  //   fieldname: 'image',
  //   originalname: '截屏2020-12-10 下午8.01.44.png',
  //   encoding: '7bit',
  //   mimetype: 'image/png',
  //   buffer: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52 00 00 03 18 00 00 01 56 08 06 00 00 00 ea b0 3b 51 00 00 0c 64 69 43 43 50 49 43 43 20 50 72 6f 66 69 ... 90135 more bytes>,
  //   size: 90185
  // }
});

app.use(new KoaStatic(path.resolve(__dirname, "../frontend")));
app.use(router.routes()).use(router.allowedMethods());
server.listen(args.port, () => logger.info(`服务监听 ${args.port} 端口`));
