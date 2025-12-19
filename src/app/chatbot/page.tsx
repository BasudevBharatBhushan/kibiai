"use client";

import { useEffect, useState, useRef } from "react";
import { HelpCircle, FileText, Download, BarChart3, Users, PieChart, Plus } from "lucide-react"; 
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/chatcard"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; 
import {
  sendMessage,
  getConversation,
} from "@/lib/bot/conversationAPI";
import { formatUserPrompt } from "@/lib/bot/promptFormatter";
import { parseAssistantResponse } from "@/lib/bot/responseParser";
import TextareaAutosize from 'react-textarea-autosize';

//MOCK SUGGESTED PROMPTS
const SUGGESTED_PROMPTS = [
  {
    title: "Sales Analysis",
    description: "Analyze the sales trends for Q3 compared to the previous year.",
    icon: <BarChart3 className="w-5 h-5 text-indigo-500" />
  },
  {
    title: "Lead Engagement",
    description: "Summarize the top leads engaged this week and their status.",
    icon: <Users className="w-5 h-5 text-indigo-500" />
  },
  {
    title: "Revenue Report",
    description: "Generate a breakdown of revenue by region for last month.",
    icon: <PieChart className="w-5 h-5 text-indigo-500" />
  }
];

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const [showPrompts, setShowPrompts] = useState(false);

  // Load conversation
  useEffect(() => {
    if (!conversationId) return;
    if (messages.length > 0) return; 

    getConversation(conversationId).then((items) => {
      const restored = items.flatMap((item) =>
        item.content
          .filter((c) => c.type === "output_text")
          .map((c) => ({
            role: item.role,
            text:
              item.role === "assistant"
                ? parseAssistantResponse(c.text || "")
                : c.text || "",
          }))
      );
      setMessages(restored);
    });
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handlePromptClick = (text: string) => {
    setInput(text);
    setShowPrompts(false); 
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleNewChat = () => {
    setConversationId(null); 
    setMessages([]);         
    setInput("");            
    setShowPrompts(false);   
  };

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setLoading(true);
    setShowPrompts(false);

    // Optimistic update
    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    try {
      const res = await sendMessage({
        instruction_set: "You are a helpful assistant.",
        conversation_id: conversationId,
        conversation_metadata: conversationId ? undefined : { source: "demo-ui" },
        predefined_prompt: "Answer in plain English.",
        user_prompt: formatUserPrompt(userText),
      });

      setConversationId(res.conversation_id);
      const assistantText = parseAssistantResponse(res.response ?? "");

      if (assistantText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: assistantText },
        ]);
      }
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-white p-4">
      <Card className="w-full max-w-120 h-[90vh] flex flex-col shadow-2 border-0 bg-white">
        
        {/* Header  */}
        <CardHeader className="px-6 py-4 border-b-0">
          <div className="flex items-center justify-between w-full">
            {/* Left Side: Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full p-2 shrink-0">
                <img src="/bot-avatar.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-lg text-gray-700">KiBi-AI</span>
                {conversationId && (
                  <span className="text-xs text-gray-400 font-mono">ID: {conversationId.slice(0, 12)}...</span>
                )}
              </div>
            </div>

            {/* Right Side: New Chat Button */}
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
                            Welcome to KiBi-AI! Please select an available prompt from the suggestion button or enter a new prompt to generate a report.
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
                    
                    {/* Bot Avatar */}
                    {m.role === "assistant" && (
                      <Avatar className="w-10 h-10 border bg-white shadow-sm mt-1">
                        <AvatarImage src="/bot-avatar.png" className="object-contain p-1" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-5 py-4 text-sm shadow-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-indigo-500 text-white rounded-tr-none" 
                          : "bg-gray-100 text-gray-800 rounded-tl-none" 
                      }`}
                    >
                      {m.text}

                      {/* Mock Report Attachment - 
                         If the text contains "Report", render a mock attachment
                      */}
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
                        onClick={() => handlePromptClick(prompt.description)}
                        className="flex-shrink-0 w-64 text-left bg-white border border-gray-200 p-4 rounded-2xl shadow-lg hover:border-indigo-500 hover:shadow-md transition-all group"
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
          {/* Floating Input Area */}
          <div className="absolute bottom-4 left-0 right-0 px-4 w-full pt-4 bg-white ">
            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 w-full max-w-2xl mx-auto">
                {/* Help Icon Button */}
                <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setShowPrompts(!showPrompts)}
                    className="h-14 w-14 rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100">
                    <HelpCircle className="!w-8 !h-8" />
                </Button>

                {/* Input Pill */}
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

                {/* Send Button */}
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