const Koa = require("koa");
const KoaStatic = require("koa-static");
const KoaRouter = require("koa-router");

class ZuoDeploy {
  start() {
    const app = new Koa();
    const router = new KoaRouter();

    router.post("/user", (ctx) => {
      ctx.body = {
        a: 1,
      };
    });

    app.use(new KoaStatic(__dirname + "/frontend"));
    app.use(router.routes()).use(router.allowedMethods());
    app.listen("7777", () => console.log("服务监听 7777 端口"));
  }
}

module.exports = ZuoDeploy;
