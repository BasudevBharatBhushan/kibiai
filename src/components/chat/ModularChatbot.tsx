"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUp,
  Bot,
  HelpCircle,
  MessageSquareText,
  Plus,
  Sparkles,
  User,
} from "lucide-react";
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
import {
  extractAssistantDisplayText,
  parseAssistantResponse,
} from "@/lib/bot/responseParser";
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
  /** When set, auto-populates the input with this text and submits it */
  pendingInput?: string;
  /** Called after pendingInput has been consumed (so parent can clear it) */
  onPendingInputConsumed?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
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
  className,
  pendingInput,
  onPendingInputConsumed,
  onLoadingChange,
}: ModularChatbotProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, loading]);
  // Always holds the latest predefinedPrompt so async sends never use stale closures
  const predefinedPromptRef = useRef(predefinedPrompt);
  useEffect(() => { predefinedPromptRef.current = predefinedPrompt; }, [predefinedPrompt]);
  useEffect(() => {
    if (onLoadingChange) onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  /**
   * Returns true when the API error means the stored conversation_id is no
   * longer valid and we should retry with a fresh null id.
   * Catches:
   *  - "Invalid 'conversation_id'"  (format mismatch)
   *  - "Conversation with id '...' not found."  (404 from OpenAI / API)
   *  - HTTP 404 status on the conversation endpoint
   */
  function isStaleConvError(err: any): boolean {
    const msg: string = err?.message ?? "";
    return (
      msg.includes("Invalid 'conversation_id'") ||
      msg.includes("not found") ||
      msg.includes("Conversation with id") ||
      err?.status === 404
    );
  }

  useEffect(() => {
    if (initialConversationId !== undefined && initialConversationId !== conversationId) {
      setConversationId(initialConversationId);
      setMessages([]); // Clear messages to trigger fetch
    }
  }, [initialConversationId]);

  // Auto-send when a suggestion chip is clicked from parent
  const pendingInputRef = useRef<string>("");
  useEffect(() => {
    if (!pendingInput || loading) return;
    pendingInputRef.current = pendingInput;
    setInput(pendingInput);
    if (onPendingInputConsumed) onPendingInputConsumed();
    // Defer so React flushes the input state before the send fires
    setTimeout(() => {
      const textToSend = pendingInputRef.current;
      if (!textToSend.trim()) return;
      setMessages((prev) => [...prev, { role: "user", text: textToSend }]);
      setInput("");
      setLoading(true);
      setShowPrompts(false);
      pendingInputRef.current = "";

      (async () => {
        try {
          const finalPrompt = formatPrompt ? formatPrompt(textToSend) : formatUserPrompt(textToSend);
          const payload = {
            conversation_id: conversationId,
            instruction_set: instructionSet,
            predefined_prompt: predefinedPromptRef.current,
            conversation_metadata: conversationMetadata || {},
            user_prompt: finalPrompt,
          };
          const res = await apiSendMessage(payload);
          if (res.conversation_id !== conversationId) {
            setConversationId(res.conversation_id);
            if (onConversationIdChange) onConversationIdChange(res.conversation_id);
          }
          const rawResponseText = res.response ?? "";
          const displayedText = extractAssistantDisplayText(rawResponseText);
          if (displayedText) {
            setMessages((prev) => [...prev, { role: "assistant", text: displayedText }]);
            if (onAssistantResponse) onAssistantResponse(displayedText, rawResponseText);
          }
        } catch (error: any) {
          console.error("Failed to send pending message", error);
          
          // Stale / invalid conversation ID → clear and retry fresh
          if (isStaleConvError(error)) {
            console.warn("[Chatbot] Stale conversation ID detected. Clearing and retrying...");
            setConversationId(null);
            if (onConversationIdChange) onConversationIdChange(null);
            
            // Re-trigger after state update (the pendingInput effect will run again because pendingInput is still set)
            // But we need to make sure we don't loop forever.
            // Actually, we can just call handleSend() with null conversation ID here.
            try {
               const retryPayload = {
                conversation_id: null,
                instruction_set: instructionSet,
                predefined_prompt: predefinedPromptRef.current,
                conversation_metadata: conversationMetadata || {},
                user_prompt: formatPrompt ? formatPrompt(textToSend) : formatUserPrompt(textToSend),
              };
              const res = await apiSendMessage(retryPayload);
              setConversationId(res.conversation_id);
              if (onConversationIdChange) onConversationIdChange(res.conversation_id);
              
              const rawResponseText = res.response ?? "";
              const displayedText = extractAssistantDisplayText(rawResponseText);
              if (displayedText) {
                setMessages((prev) => [...prev, { role: "assistant", text: displayedText }]);
                if (onAssistantResponse) onAssistantResponse(displayedText, rawResponseText);
              }
              return; // Success on retry
            } catch (retryError) {
              console.error("Retry failed:", retryError);
            }
          }
          
          setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
          setLoading(false);
        }
      })();
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput]);

  useEffect(() => {
    if (!conversationId) return;
    if (messages.length > 0) return;

    getConversation(conversationId).then((items) => {
      const restored = items.flatMap((item: any) => {
        return item.content
          .filter((c: any) => c.type === "output_text" || c.type === "input_text")
          .map((c: any) => {
            let text = c.text || "";

            if (item.role === "assistant") {
              text = parseAssistantResponse(text);
            } else if (item.role === "user") {
              /**
               * OpenAI stores the full composed message:
               *   "{predefined_context}\n{user_text}.json"
               *
               * predefined_context = "Today's date ... Here is my DB Schema - {...}. Here is my Previous Report Config - {...}."
               * user_text           = whatever the user actually typed
               *
               * Strategy: if the message contains the predefined context markers,
               * split on the last "\n" — the user text is the segment after it.
               * Then strip the trailing ".json" added by formatUserPrompt.
               */
              const hasPredefined =
                text.includes("Today's date") ||
                text.includes("Here is my DB Schema") ||
                text.includes("Here is my Previous Report Config") ||
                text.includes("FieldName:") ||
                text.includes("Report Insight:");

              if (hasPredefined) {
                // The predefined block ends with ".\n" — user input follows
                const lastNewline = text.lastIndexOf("\n");
                if (lastNewline !== -1) {
                  text = text.substring(lastNewline + 1).trim();
                } else {
                  // Fallback: no newline found — take the segment after the last ". "
                  // that isn't part of the schema JSON
                  text = "";
                }
              }

              // Strip trailing ".json" suffix added by formatUserPrompt
              if (text.endsWith(".json")) {
                text = text.slice(0, -5).trim();
              }
            }

            return {
              role: item.role,
              text: text
            };
          })
          .filter((m: any) => m.text.length > 0); // drop empty user messages (pure-context turns)
      });
      setMessages(restored.reverse());
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

    const finalPrompt = formatPrompt ? formatPrompt(userText) : formatUserPrompt(userText);

    try {
      const payload = {
        conversation_id: conversationId,
        instruction_set: instructionSet,
        predefined_prompt: predefinedPromptRef.current,
        conversation_metadata: conversationMetadata || {},
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
      const displayedText = extractAssistantDisplayText(rawResponseText);

      if (displayedText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: displayedText },
        ]);
        if (onAssistantResponse) {
          onAssistantResponse(displayedText, rawResponseText);
        }
      }
    } catch (error: any) {
      console.error("Failed to send message", error);

      // Stale / invalid conversation ID → clear and retry fresh
      if (isStaleConvError(error)) {
        console.warn("[Chatbot] Stale conversation ID detected. Retrying with new thread...");
        setConversationId(null);
        if (onConversationIdChange) onConversationIdChange(null);

        try {
          const retryPayload = {
            conversation_id: null,
            instruction_set: instructionSet,
            predefined_prompt: predefinedPromptRef.current,
            conversation_metadata: conversationMetadata || {},
            user_prompt: finalPrompt,
          };
          const res = await apiSendMessage(retryPayload);
          setConversationId(res.conversation_id);
          if (onConversationIdChange) onConversationIdChange(res.conversation_id);

          const rawResponseText = res.response ?? "";
          const displayedText = extractAssistantDisplayText(rawResponseText);

          if (displayedText) {
            setMessages((prev) => [...prev, { role: "assistant", text: displayedText }]);
            if (onAssistantResponse) onAssistantResponse(displayedText, rawResponseText);
          }
          return; // Success on retry
        } catch (retryError) {
          console.error("Retry failed:", retryError);
        }
      }

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

  const hasMessages = messages.length > 0;
  const showPromptRail = suggestedPrompts.length > 0 && showPrompts && hasMessages;
  const containerClasses =
    className ||
    "w-full max-w-[34rem] h-[90vh] flex flex-col overflow-hidden border-r border-slate-200 bg-slate-50 font-sans";

  return (
    <div className={containerClasses}>
      <Card className="flex h-full w-full flex-col overflow-hidden border-0 bg-white shadow-none">
        <CardHeader className="border-b border-slate-200/80 bg-slate-50/50 px-4 py-3 shrink-0 flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-white text-indigo-600 shadow-sm">
              <Bot className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold tracking-tight text-slate-900">
                  {botName}
                </h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                  loading
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  <span className={`h-1 w-1 rounded-full ${
                    loading ? "animate-pulse bg-indigo-500" : "bg-emerald-500"
                  }`} />
                  {loading ? "Thinking" : "Ready"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {suggestedPrompts.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPrompts((prev) => !prev)}
                className={`size-8 rounded-lg border transition-all ${
                  showPrompts
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600 shadow-inner"
                    : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600 shadow-sm"
                }`}
                title={showPrompts ? "Hide prompts" : "Show prompts"}
              >
                <HelpCircle className="size-3.5" />
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="h-8 rounded-lg border-slate-200 bg-white px-2.5 text-xs font-semibold tracking-wide text-slate-600 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all font-sans"
              title="Start New Chat"
            >
              <Plus className="size-3.5 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden relative bg-slate-50">
          <ScrollArea className="h-full">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-5 pb-40 pt-6">
              {/* Welcome Message (Only visible if no messages) */}
              {!hasMessages && (
                <div className="flex w-full justify-start">
                  <div className="flex w-full max-w-[88%] items-start gap-3">
                    <Avatar className="mt-1 h-10 w-10 border border-slate-200 bg-white shadow-sm shrink-0">
                      <AvatarImage src={botAvatar} className="object-contain p-1" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>

                    <div className="space-y-4">
                      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm px-5 py-4 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                        {welcomeMessage}
                      </div>
                      
                      {suggestedPrompts.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {suggestedPrompts.map((prompt, index) => (
                              <button
                                key={index}
                                onClick={() => selectPrompt(prompt.description)}
                                className="group flex flex-col rounded-xl border border-slate-200 bg-white/70 hover:bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                              >
                                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100 pb-0.5">
                                  {prompt.icon}
                                </div>
                                <h3 className="text-xs font-semibold text-slate-800">
                                  {prompt.title}
                                </h3>
                                <p className="mt-1 text-[10.5px] leading-5 text-slate-500 line-clamp-2">
                                  {prompt.description}
                                </p>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Messages */}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex w-full ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[88%] items-start gap-3 ${
                      m.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    
                    {m.role === "assistant" ? (
                      <Avatar className="mt-1 h-10 w-10 border border-slate-200 bg-white shadow-sm shrink-0">
                        <AvatarImage src={botAvatar} className="object-contain p-1" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="mt-1 h-10 w-10 border border-slate-200 bg-white shadow-sm shrink-0">
                        <div className="flex h-full w-full items-center justify-center bg-indigo-100 text-indigo-700">
                          <User className="size-5" />
                        </div>
                      </Avatar>
                    )}

                    <div className={`space-y-2 ${m.role === "user" ? "text-right" : ""}`}>
                      <div
                        className={`rounded-2xl px-5 py-4 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${
                          m.role === "user"
                            ? "rounded-tr-sm bg-indigo-600 text-white"
                            : "rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex w-full justify-start">
                  <div className="flex max-w-[88%] items-start gap-3">
                    <Avatar className="mt-1 h-10 w-10 border border-slate-200 bg-white shadow-sm shrink-0">
                      <AvatarImage src={botAvatar} className="object-contain p-1" />
                        <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <div className="w-48 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-5 py-4 shadow-sm">
                        <div className="flex flex-col gap-2">
                          <div className="h-2 w-full animate-pulse rounded bg-slate-200"></div>
                          <div className="h-2 w-5/6 animate-pulse rounded bg-slate-200"></div>
                          <div className="h-2 w-4/6 animate-pulse rounded bg-slate-200"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          {showPromptRail && (
            <div className="absolute inset-x-0 bottom-28 z-10 px-4">
              <div className="mx-auto flex max-w-4xl gap-3 overflow-x-auto pb-2 no-scrollbar">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => selectPrompt(prompt.description)}
                    className="group w-64 shrink-0 rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-indigo-200"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                      {prompt.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {prompt.title}
                    </h3>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      {prompt.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
            <form onSubmit={handleSend} className="mx-auto flex w-full max-w-4xl items-end gap-3">
              <div className="flex min-h-[44px] flex-1 items-end gap-3 rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-shadow">
                {suggestedPrompts.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowPrompts((prev) => !prev)}
                    className={`mb-0.5 size-9 shrink-0 rounded-xl p-0 transition-all ${
                      showPrompts
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                    }`}
                  >
                    <HelpCircle className="size-5" />
                  </Button>
                )}

                <div className="flex-1 min-w-0">
                  <TextareaAutosize
                    ref={inputRef}
                    rows={1}
                    minRows={1}
                    maxRows={8}
                    placeholder="Describe the report you want to build..."
                    className="chat-textarea text-slate-700"
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
                  className="mb-0.5 size-9 rounded-xl bg-indigo-600 p-0 text-white transition-all hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 shrink-0"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </form>

            <p className="mt-2 text-center text-[11px] text-slate-400">
              Ask for fields, groupings, filters, date ranges, or summary logic.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
