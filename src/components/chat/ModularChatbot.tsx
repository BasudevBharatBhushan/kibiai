"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useAutoScroll } from '@/lib/hooks/useAutoScroll';

import { sendMessage as apiSendMessage, getConversation } from "@/lib/bot/conversationAPI";
import { formatUserPrompt } from "@/lib/bot/promptFormatter";
import { parseAssistantResponse } from "@/lib/bot/responseParser";
import { SUGGESTED_PROMPTS } from "@/lib/utils/mockPrompts";

export type Message = {
  role: "user" | "assistant";
  text: string;
};

export interface PromptOption {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ModularChatbotProps {
  instructionSet: string;
  conversationMetadata?: Record<string, any>;
  predefinedPrompt?: string;
  formatPrompt?: (userText: string) => string;
  botName?: string;
  welcomeMessage?: string;
  botAvatar?: string;
  suggestedPrompts?: PromptOption[];
  initialConversationId?: string | null;
  onAssistantResponse?: (parsedResponse: string, rawResponse: any) => void;
  onConversationIdChange?: (id: string | null) => void;
  className?: string;
}

export function ModularChatbot({
  instructionSet,
  conversationMetadata,
  predefinedPrompt = "",
  formatPrompt,
  botName = "AI Assistant",
  welcomeMessage = "Hello! How can I help you today?",
  botAvatar = "/bot-avatar.png",
  suggestedPrompts = SUGGESTED_PROMPTS,
  initialConversationId = null,
  onAssistantResponse,
  onConversationIdChange,
  className
}: ModularChatbotProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, loading]);

  useEffect(() => {
    if (initialConversationId !== undefined && initialConversationId !== conversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  useEffect(() => {
    if (!conversationId) return;
    if (messages.length > 0) return;

    getConversation(conversationId).then((items) => {
      const restored = items.flatMap((item: any) =>
        item.content
          .filter((c: any) => c.type === "output_text")
          .map((c: any) => ({
            role: item.role,
            text: item.role === "assistant" ? parseAssistantResponse(c.text || "") : c.text || "",
          }))
      );
      setMessages(restored);
    });
  }, [conversationId]);

  const handleNewChat = useCallback(() => {
    setConversationId(null); 
    setMessages([]);         
    setInput("");            
    setShowPrompts(false);   
    if (onConversationIdChange) onConversationIdChange(null);
  }, [onConversationIdChange]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    setShowPrompts(false);

    try {
      const finalPrompt = formatPrompt ? formatPrompt(userText) : formatUserPrompt(userText);

      const payload = {
        conversation_id: conversationId,
        instruction_set: instructionSet,
        predefined_prompt: predefinedPrompt,
        metadata: conversationMetadata || {},
        user_prompt: finalPrompt,
      };

      const res = await apiSendMessage(payload);

      if (res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id);
        if (onConversationIdChange) {
          onConversationIdChange(res.conversation_id);
        }
      }

      const rawResponseText = res.response ?? "";
      let displayedText = rawResponseText;

      try {
        let jsonStr = rawResponseText;
        const match = rawResponseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (match) jsonStr = match[1];
        else {
          const plainMatch = rawResponseText.match(/(\{[\s\S]*\})/);
          if (plainMatch) jsonStr = plainMatch[1];
        }
        const parsed = JSON.parse(jsonStr);
        if (parsed.response_to_user) {
          displayedText = parsed.response_to_user;
        }
      } catch (err) {}

      if (displayedText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: displayedText },
        ]);
        if (onAssistantResponse) {
          onAssistantResponse(displayedText, rawResponseText);
        }
      }
    } catch (error) {
      console.error("Failed to send message", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I encountered an error answering your request. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const selectPrompt = (text: string) => {
    setInput(text);
    setShowPrompts(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const containerClasses = className || "w-full max-w-120 h-[90vh] flex flex-col shadow-2 border-0 bg-white";

  return (
    <div className={containerClasses}>
      <Card className="w-full h-full flex flex-col shadow-none border-0 bg-white">
        
        <CardContent className="flex-1 p-0 overflow-hidden relative">
          <ScrollArea className="h-full p-6">
            <div className="space-y-6 pb-15">
              
              {/* Welcome Message */}
               <div className="flex w-full justify-start">
                  <div className="flex items-start gap-3 max-w-[85%]">
                      <Avatar className="w-10 h-10 border bg-white shadow-sm mt-1">
                          <AvatarImage src={botAvatar} className="object-contain p-1" />
                          <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-none px-5 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {welcomeMessage}
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
                        <AvatarImage src={botAvatar} className="object-contain p-1" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`rounded-2xl px-5 py-4 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-indigo-500 text-white rounded-tr-none" 
                          : "bg-gray-100 text-gray-800 rounded-tl-none" 
                      }`}
                    >
                      {m.text}

                      {/* Mock Report Attachment placeholder condition, based on original logic */}
                      {m.role === "assistant" && m.text.toLowerCase().includes("report") && (
                         <div className="mt-3 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 w-full max-w-sm">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <FileText className="text-indigo-600 w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs truncate">Report.pdf</p>
                                <p className="text-[10px] text-gray-400">Generated just now</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-indigo-600 border-none">
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
                      <AvatarImage src={botAvatar} className="object-contain p-1" />
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
          
          {showPrompts && suggestedPrompts.length > 0 && (
             <div className="absolute bottom-20 left-4 right-4 z-10">
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                   {suggestedPrompts.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => selectPrompt(prompt.description)}
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
                
                {suggestedPrompts.length > 0 && (
                  <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setShowPrompts(!showPrompts)}
                      className="h-14 w-14 rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100">
                      <HelpCircle className="w-8! h-8!" />
                  </Button>
                )}

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
                    className="h-12 px-6 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-md transition-all border-none">
                    Send
                </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
