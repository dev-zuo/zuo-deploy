import Koa from "koa";
import KoaStatic from "koa-static";
import KoaRouter from "koa-router";
import path from "path";

class ZuoDeploy {
  start() {
    const app = new Koa();
    const router = new KoaRouter();

    router.post("/user", (ctx) => {
      ctx.body = {
        a: 1,
      };
    });

    app.use(new KoaStatic(path.resolve() + "/frontend"));
    app.use(router.routes()).use(router.allowedMethods());

    app.listen("7777", () => console.log("服务监听 7777 端口"));
  }
}

export default ZuoDeploy;
