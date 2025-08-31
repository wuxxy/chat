import { useEffect, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import format from "date-format"
import { prettyTime } from './formatter'
import axios from 'axios'
import client from './axiosClient'
type Message = {
  id: string,
  sentAt: number,
  content: string,
  author: string
}
type User = {
  username: string;
  avatar: string;
  id: string;
  messages: Message[]
}
function App() {
  let [socket, setSocket] = useState<WebSocket | null>(null);
  let [token, setToken] = useState(localStorage.getItem("token"))
  
  let [messages, setMessages] = useState<Message[]>();
  const [user,setUser] = useState<User>()
  const [typed, setTyped] = useState("") 
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;   // skip second run in dev
    ranRef.current = true;

    if (!token) {
      window.location.href =
        "https://reimagined-space-parakeet-7rv4xq9wg55fr6x7-8080.app.github.dev/login";
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [me, msgs] = await Promise.all([
          client.get("/me"),
          client.get("/messages"),
        ]);

        if (cancelled) return;
        setUser(me.data.user);
        setMessages(msgs.data.messages);
      } catch (err) {
        console.error("Couldn't connect", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const newSocket = new WebSocket("https://reimagined-space-parakeet-7rv4xq9wg55fr6x7-8080.app.github.dev/ws");

    newSocket.addEventListener("open", () => {
      console.log("Connected to WS");
    });

    newSocket.addEventListener("message", (m) => {
      console.log(m.data);
    });

    setSocket(newSocket);

    return () => {
      console.log("Closing WS");
      newSocket.close();
    };
  }, []);
  function sendMessage(){
    client.post("/message", {
      content: typed
    }).then((res) => {
      console.log(res.data)
    })
  }
  const messageBoxRef = useRef(null)
  return (
    <div className='max-h-screen flex flex-col h-full w-full text-left'>
      {(user && messages) ? (
        <>
        <div className='flex flex-row bg-gray-900 text-xs items-center p-2 text-gray-400'>
        <div className='my-2'>
          <img className='rounded-full w-8' src={`https://reimagined-space-parakeet-7rv4xq9wg55fr6x7-8080.app.github.dev/cdn/avatars/${user.id}/${user.avatar}.png`} />
        </div>
        <div className='p-2 gap-1 flex flex-row'>
          <span>
            Logged in as
          </span>
          <span className='font-bold'>
            {user.username}
          </span>
        </div>
      </div>
      <div className='flex flex-col justify-end flex-1 bg-gray-700/20 p-2'>
      
        {messages.map((message => (
          <div className='my-2'>
            <div className="flex flex-row gap-2 items-center">
              <div className='font-bold'>{message.author}</div>
              <div className='text-gray-500 text-xs'>{prettyTime(message.sentAt)}</div>
            </div>
            <div>{message.content}</div>
          </div>
        )))}
      </div>
      <div className="flex w-full bg-gray-800 p-2">
  <div className="relative flex-1">
    <div
      ref={messageBoxRef}
      contentEditable
      role="textbox"
      aria-multiline="true"
      suppressContentEditableWarning
      className="w-full min-h-10 p-2 outline-none"
      onInput={(e) => setTyped(e.currentTarget.textContent?.trim() || "")}
    />
    {!typed && (
      <div className="absolute left-2 top-2 text-gray-500 pointer-events-none select-none">
        Send a message...
      </div>
    )}
  </div>

  <button onClick={sendMessage} className="ml-2">Send</button>
</div>  
      </>
      ) : "Loading.."}
    </div>
  )
}

export default App
