import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import "dotenv"
import qs from "qs";
const prisma = new PrismaClient();
const fastify = Fastify();
await fastify.register(websocket);

fastify.get("/", async () => "Hello world");

fastify.get("/redirect", async (request, reply) => {
    try{
        const { code } = request.query as { code?: string };
        if (code == "" || code == undefined){
            console.log("no code provided");
            return reply.code(400).send();
        }
        const tokens = await getToken(code);
        const userData = await axios.get("https://discord.com/api/v10/users/@me", {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });
        const user = userData.data;
        console.log(user)
        return reply.code(200).send();
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
await fastify.listen({ port, host: "0.0.0.0" }).then(() => {console.log(`Listening on http://localhost:${port}`); });
