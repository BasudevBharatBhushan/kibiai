"use client";

import { useEffect, useRef } from "react";
import { HelpCircle, FileText, Download, Plus } from "lucide-react"; 
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/chatcard"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import TextareaAutosize from 'react-textarea-autosize';
import '@/styles/chatbot.css';
import { ChatProvider, useChat } from "@/context/ChatbotContext";
import { CHAT_CONFIG } from "@/lib/constants/analytics";
import { SUGGESTED_PROMPTS } from "@/lib/utils/mockPrompts";

// 1. Wrapper Component
export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatView />
    </ChatProvider>
  );
}

// 2. Inner Component (Consumes Context)
function ChatView() {
  const {
    conversationId,
    messages,
    loading,
    input,
    showPrompts,
    setInput,
    setShowPrompts,
    handleNewChat,
    handleSend,
    selectPrompt
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null); 

  // Auto-scroll effect 
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Focus logic for prompt clicking
  const onPromptClick = (text: string) => {
    selectPrompt(text);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-white p-4">
      <Card className="w-full max-w-120 h-[90vh] flex flex-col shadow-2 border-0 bg-white">
        
        {/* Header  */}
        <CardHeader className="chat-header">
          <div className="chat-header-container flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="chat-logo w-8 h-8">
                <img src="/bot-avatar.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="chat-title">{CHAT_CONFIG.BOT_NAME}</span>
                {conversationId && (
                  <span className="chat-id">ID: {conversationId.slice(0, 12)}...</span>
                )}
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNewChat}
              className="rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Start New Conversation"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden relative">
          <ScrollArea className="h-full p-6">
            <div className="space-y-6 pb-15">
              
              {/* Welcome Message */}
               <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-start gap-3 max-w-[85%]">
                      <Avatar className="w-10 h-10 border bg-white shadow-sm mt-1">
                          <AvatarImage src="/bot-avatar.png" className="object-contain p-1" />
                          <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-none px-5 py-4 text-sm text-gray-700 leading-relaxed">
                          {CHAT_CONFIG.WELCOME_MESSAGE}
                      </div>
                  </div>
               </div>

              {/* Dynamic Messages */}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex w-full ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    
                    {m.role === "assistant" && (
                      <Avatar className="w-10 h-10 border bg-white shadow-sm mt-1">
                        <AvatarImage src="/bot-avatar.png" className="object-contain p-1" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`rounded-2xl px-5 py-4 text-sm shadow-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-indigo-500 text-white rounded-tr-none" 
                          : "bg-gray-100 text-gray-800 rounded-tl-none" 
                      }`}
                    >
                      {m.text}

                      {/* Mock Report Attachment */}
                      {m.role === "assistant" && m.text.toLowerCase().includes("report") && (
                         <div className="mt-3 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 w-full max-w-sm">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <FileText className="text-indigo-600 w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs truncate">Engagement Report.pdf</p>
                                <p className="text-[10px] text-gray-400">2.4 MB • Generated just now</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-indigo-600">
                                <Download size={16} />
                            </Button>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex w-full justify-start">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border bg-white shadow-sm">
                      <AvatarImage src="/bot-avatar.png" className="object-contain p-1" />
                        <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-2 text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          {showPrompts && (
             <div className="absolute bottom-20 left-4 right-4 animate-in slide-in-from-bottom-5 fade-in duration-300 z-10">
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                   {SUGGESTED_PROMPTS.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => onPromptClick(prompt.description)}
                        className="shrink-0 w-64 text-left bg-white border border-gray-200 p-4 rounded-2xl shadow-lg hover:border-indigo-500 hover:shadow-md transition-all group"
                      >
                         <div className="bg-indigo-50 w-8 h-8 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                            {prompt.icon}
                         </div>
                         <h3 className="font-semibold text-gray-800 text-sm mb-1">{prompt.title}</h3>
                         <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                            {prompt.description}
                         </p>
                      </button>
                   ))}
                </div>
             </div>
          )}
          
          <div className="absolute bottom-4 left-0 right-0 px-4 w-full pt-4 bg-white ">
            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 w-full max-w-2xl mx-auto">
                
                <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setShowPrompts(!showPrompts)}
                    className="h-14 w-14 rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100">
                    <HelpCircle className="w-8! h-8!" />
                </Button>

            <div className="flex-1 relative">
            <TextareaAutosize
                ref={inputRef} 
                minRows={1}
                maxRows={4} 
                placeholder="Type here the message..."
                className="w-full resize-none bg-white rounded-3xl border border-gray-200 pl-6 pr-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm leading-relaxed scrollbar-hide"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                disabled={loading}
                autoFocus
            />
            </div>

                <Button 
                    type="submit" 
                    disabled={loading || !input.trim()}
                    className="h-12 px-6 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-md transition-all">
                    Send
                </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}