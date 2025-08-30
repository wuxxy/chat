import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import format from "date-format"
import { prettyTime } from './formatter'
type Message = {
  id: string,
  sentAt: number,
  content: string,
  author: string
}

function App() {
  let [socket, setSocket] = useState<WebSocket | null>(null);
  let [token, setToken] = useState(localStorage.getItem("token"))
  useEffect(() => {
    if (!token){
      
    }
  }, [])
  let [messages, setMessages] = useState<Message[]>([{
    id: "poopbutt",
    sentAt: Date.now(),
    content: "hey poopbutt",
    author: "wuxxy"
  },{
    id: "poopbutt2",
    sentAt: Date.now()+10,
    content: "this is some ranodm ahh message ahahahahah goof ball",
    author: "wuxxy"
  }]);
  return (
    <div className='max-h-screen flex flex-col h-full w-full text-left'>
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
      <div className='flex flex-row w-full bg-gray-800 p-2 focus:outline-none focus:border-0 focus:ring-0'>
        <div contentEditable className='flex-1 text-left'></div>
        <button>Send</button>
      </div>    
    </div>
  )
}

export default App
