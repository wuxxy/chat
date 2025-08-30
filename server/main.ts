import { Application, Router } from "@oak/oak";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const router = new Router();

router.get("/", (ctx) => {
  ctx.response.body = "Hello world";
});
router.get("/redirect", (ctx )=>{
  const url = ctx.request.url;
  const params = url.searchParams;

  const code = params.get("code")
  if (!code){
    return ctx.throw(400)
  }

})
router.get("/ws", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }
  const ws = ctx.upgrade();

  ws.onopen = () => console.log("socket opened");
  ws.onmessage = (e) => {
    console.log("recv:", e.data);
    ws.send("echo: " + e.data);
  };
  ws.onclose = () => console.log("socket closed");
  ws.onerror = (err) => console.error("socket error:", err);
});
const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.listen();