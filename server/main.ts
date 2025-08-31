import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import jwt from "jsonwebtoken"
import dotenv from 'dotenv';
dotenv.config();
console.log(process.env.CLIENT_ID, process.env.CLIENT_SECRET)
import qs from "qs";
const prisma: PrismaClient = new PrismaClient();
const fastify = Fastify();
type User = {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
  verified: boolean;
  email: string | null;
  flags: number;
  banner: string | null;
  accent_color: number | null;
  premium_type: number;
  public_flags: number;
  avatar_decoration_data?: {
    sku_id: string;
    asset: string;
  } | null;
  collectibles?: {
    nameplate?: {
      sku_id: string;
      asset: string;
      label: string;
      palette: string;
    };
  };
  primary_guild?: {
    identity_guild_id: string;
    identity_enabled: boolean;
    tag: string;
    badge: string;
  };
};

await fastify.register(websocket);
fastify.get("/", async () => "Hello world");
// fastify.get('/cdn/*', async (req, reply) => {
//   const star = (req.params as any)['*'] as string; // e.g. "avatars/8035/.../avatar.png"
//   const qs = req.raw.url?.split('?')[1];
//   const targetUrl = new URL(`https://cdn.discordapp.com/${star}${qs ? `?${qs}` : ''}`);

//   // Hard lock to Discord CDN (don’t make an open proxy)
//   if (targetUrl.host !== 'cdn.discordapp.com') {
//     reply.code(400).send({ error: 'Invalid host' });
//     return;
//   }

//   // Forward common conditional headers for cache efficiency
//   const fwdHeaders: Record<string, string> = {};
//   for (const h of ['if-none-match', 'if-modified-since', 'range']) {
//     const v = req.headers[h];
//     if (typeof v === 'string') fwdHeaders[h] = v;
//   }

//   const upstream = await fetch(targetUrl, { headers: fwdHeaders });

//   // Mirror status
//   reply.code(upstream.status);

//   // Pass through relevant headers
//   for (const [k, v] of upstream.headers.entries()) {
//     if (
//       ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified', 'accept-ranges'].includes(k)
//     ) {
//       reply.header(k, v);
//     }
//   }

//   // Stream body (304 will have no body)
//   if (upstream.body) {
//     // @ts-ignore - Node’s Readable.fromWeb types can be finicky
//     return reply.send(Readable.fromWeb(upstream.body));
//   } else {
//     return reply.send();
//   }
// });
fastify.get("/redirect", async (request, reply) => {
    try{
        const { code } = request.query as { code?: string };
        if (code == "" || code == undefined){
            console.log("no code provided");
            return reply.code(400).send();
        }
        const tokens = await getToken(code);
        console.log("Got token")
        const userData = await axios.get("https://discord.com/api/v10/users/@me", {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });
        const user = userData.data as User;
        let checkIfUserExists = await prisma.user.findUnique({where:{id:user.id}})
        if(checkIfUserExists ) {
            await prisma.user.update({where:{id: checkIfUserExists.id}, data:{avatar: user.avatar || "", username: user.username}})
        }else{
            await prisma.user.create({
                data:{
                    avatar: user.avatar || "",
                    username: user.username,
                    password: "",
                    id: user.id,
                }
            })
        }
        const token = jwt.sign({i: user.id},(process.env.JWT || "secret"))
        return reply.code(200).send({token})
    }catch (error) {
        console.log(error)
    }
});
async function getToken(code: string) {
    const response = await axios.post(
        "https://discord.com/api/v10/oauth2/token",
        qs.stringify({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: process.env.REDIRECT_URI, // must match what you registered
        }),
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );
    return response.data;
}
fastify.get("/ws", { websocket: true }, (connection) => {
    connection.socket.on("message", (msg) => {
        connection.socket.send("echo: " + msg.toString());
    });
});

const port = Number(process.env.PORT ?? "6969");

async function start() {
  const t0 = Date.now();

  // Prisma connect timing
  const tDb0 = Date.now();
  await prisma.$connect();
  const userCount = await prisma.user.count().catch(() => -1);
  console.log(
    { tookMs: Date.now() - tDb0, userCount },
    'Prisma connected & counted users'
  );

  await fastify.listen({ port, host: '0.0.0.0' });
  console.log({ tookMs: Date.now() - t0, port }, 'Server ready');
  
}

start().catch((err) => {
  fastify.log.error(err, 'Fatal startup error');
  process.exit(1);
});