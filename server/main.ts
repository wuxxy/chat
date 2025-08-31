import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { Readable } from "stream";
import { randomUUID } from "node:crypto";
import { time, timeEnd } from "node:console";
dotenv.config();

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

const FRONTEND =
  "https://reimagined-space-parakeet-7rv4xq9wg55fr6x7-5173.app.github.dev";
const JWT_SECRET = process.env.JWT || "secret";
const PORT = Number(process.env.PORT ?? "8080");

// ---------- CORS (register FIRST, same scope as routes) ----------
await fastify.register(cors, {
  hook: "preHandler",
  origin: (origin, cb) => {
    // For fetch/XHR Origin is present; top-level navigations (e.g. /redirect) may not send Origin.
    if (!origin) return cb(null, false);
    cb(null, origin === FRONTEND);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // Let plugin echo Access-Control-Request-Headers so you don't fight preflight
  allowedHeaders: ["Authorization", "Content-Type"],
  exposedHeaders: ["Content-Length"],
  credentials: false,
  maxAge: 600,
});

// Debug hooks
fastify.addHook("onRequest", async (req, _reply) => {
  fastify.log.info(
    {
      method: req.method,
      url: req.url,
      origin: req.headers.origin,
      acrh: req.headers["access-control-request-headers"],
      acrm: req.headers["access-control-request-method"],
    },
    "incoming"
  );
});

const Sockets = new Set<WebSocket>

fastify.addHook("onSend", async (_req, reply, payload) => {
  fastify.log.info({ headers: reply.getHeaders() }, "outgoing");
  return payload;
});

// ---------- WS ----------
await fastify.register(websocket);
fastify.get("/ws", { websocket: true }, (conn: websocket.WebSocket, req) => {
  const o = req.headers.origin;
  if (o !== FRONTEND) return conn.socket.close(1008, "Forbidden");
  
  Sockets.add(conn);
  conn.onclose = () => {
    Sockets.delete(conn)
  }
});

// ---------- Routes ----------
fastify.get("/login", async (_req, reply) => {
  const redirect = encodeURIComponent(
    process.env.REDIRECT_URI ??
      "https://reimagined-space-parakeet-7rv4xq9wg55fr6x7-8080.app.github.dev/redirect"
  );
  const url =
    `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(process.env.CLIENT_ID || "")}` +
    `&response_type=code&redirect_uri=${redirect}&scope=identify`;
  reply.redirect(url);
});

fastify.get("/me", async (req, reply) => {
  // Expect "Authorization: Bearer <jwt>"
  const token = req.headers.authorization;
  if (!token) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { i: string };
    const user = await prisma.user.findUnique({where:{id:payload.i}})

    return reply.send({ user });
  } catch {
    return reply.code(401).send({ error: "invalid token" });
  }
});

fastify.get("/messages", async (req, reply) => {
  // Expect "Authorization: Bearer <jwt>"
  const token = req.headers.authorization;
  if (!token || !jwt.verify(token, JWT_SECRET)) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { i: string };
    const messages = await prisma.message.findMany({select:{authorId: true, author: {select:{id:true,username:true}}}})

    return reply.send({ messages });
  } catch {
    return reply.code(401).send({ error: "invalid token" });
  }
});

fastify.post("/message", async (req, reply) => {
    const token = req.headers.authorization;
    const {content} = req.body as {content: string};
    if (!token) {
        return reply.code(401).send({ error: "unauthorized" });
    }
    const payload = jwt.verify(token, JWT_SECRET) as { i: string };
    const author = await prisma.user.findUnique({where:{id:payload.i}})
    if (!author){
        return reply.code(401).send({ error: "unauthorized" });
    }
    const id = randomUUID()
    // const newMessage = await prisma.message.create({
    //     data: {
    //         content,
    //         id,
    //         author: {
    //             connect:{
    //                 id: author.id
    //             }
    //         },
    //         createdAt: new Date(Date.now())
    //     }
    // })
    for( const socket of Sockets) {
        socket.send(content)
    }
    console.log(Sockets.size)
})

fastify.get("/cdn/*", async (req, reply) => {
  const star = (req.params as any)["*"] as string;
  const qs = req.raw.url?.split("?")[1];
  const targetUrl = new URL(
    `https://cdn.discordapp.com/${star}${qs ? `?${qs}` : ""}`
  );
  if (targetUrl.host !== "cdn.discordapp.com") {
    return reply.code(400).send({ error: "Invalid host" });
  }
  const fwdHeaders: Record<string, string> = {};
  for (const h of ["if-none-match", "if-modified-since", "range"]) {
    const v = req.headers[h];
    if (typeof v === "string") fwdHeaders[h] = v;
  }
  const upstream = await fetch(targetUrl, { headers: fwdHeaders });
  reply.code(upstream.status);
  for (const [k, v] of upstream.headers.entries()) {
    if (
      [
        "content-type",
        "content-length",
        "cache-control",
        "etag",
        "last-modified",
        "accept-ranges",
      ].includes(k)
    ) {
      reply.header(k, v);
    }
  }
  if (upstream.body) {
    // @ts-ignore Node typings…
    return reply.send(Readable.fromWeb(upstream.body));
  }
  return reply.send();
});

fastify.get("/redirect", async (request, reply) => {
  try {
    const { code } = request.query as { code?: string };
    if (!code) return reply.code(400).send({ error: "missing code" });

    const tokens = await getDiscordToken(code); // fixed
    const userData = await axios.get("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = userData.data as {
      id: string;
      username: string;
      avatar: string | null;
    };

    const existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (existing) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: user.avatar || "", username: user.username },
      });
    } else {
      await prisma.user.create({
        data: {
          id: user.id,
          username: user.username,
          avatar: user.avatar || "",
          password: "",
        },
      });
    }

    const token = jwt.sign({ i: user.id }, JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ token });
  } catch (err: any) {
    fastify.log.error(
      { status: err.response?.status, data: err.response?.data, msg: err.message },
      "redirect error"
    );
    return reply.code(500).send({ error: "oauth_failed" });
  }
});

// ---------- Discord OAuth: use unversioned endpoint + Basic auth ----------
async function getDiscordToken(code: string) {
  const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Missing env CLIENT_ID/CLIENT_SECRET/REDIRECT_URI");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await axios.post(
    "https://discord.com/api/oauth2/token",
    body.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      timeout: 10000,
    }
  );
  return res.data as { access_token: string; token_type: string; expires_in: number };
}

// ---------- Startup ----------
async function start() {
  await prisma.$connect();
  await fastify.listen({ host: "0.0.0.0", port: PORT });
  fastify.log.info({ port: PORT }, "Server ready");
}

start().catch((err) => {
  fastify.log.error(err, "Fatal startup error");
  process.exit(1);
});
