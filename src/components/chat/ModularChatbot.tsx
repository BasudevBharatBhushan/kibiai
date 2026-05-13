"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUp,
  Bot,
  HelpCircle,
  Plus,
  RotateCw,
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
  setupPrompt?: string;
  configPrompt?: string;
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
  headerActions?: React.ReactNode;
  /** Whether to automatically send an initialization message if the conversation is empty */
  autoInitialize?: boolean;
  /** Whether to parse and display AI-generated suggestions (e.g. report_suggestions) in the internal rail */
  showAiSuggestions?: boolean;
  /** Whether to show context checkboxes near the prompt input */
  showSetupCheckbox?: boolean;
}

export function ModularChatbot({
  instructionSet,
  conversationMetadata,
  predefinedPrompt = "",
  setupPrompt = "",
  configPrompt = "",
  formatPrompt,
  botName = "Assistant",
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
  headerActions,
  autoInitialize = false,
  showAiSuggestions = false,
  showSetupCheckbox = false,
}: ModularChatbotProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [includeLatestSetup, setIncludeLatestSetup] = useState(false);
  const [includeLatestConfig, setIncludeLatestConfig] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null); 
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, loading]);
  // Always holds the latest predefinedPrompt so async sends never use stale closures
  const predefinedPromptRef = useRef(predefinedPrompt);
  const setupPromptRef = useRef(setupPrompt);
  const configPromptRef = useRef(configPrompt);
  useEffect(() => { predefinedPromptRef.current = predefinedPrompt; }, [predefinedPrompt]);
  useEffect(() => { setupPromptRef.current = setupPrompt; }, [setupPrompt]);
  useEffect(() => { configPromptRef.current = configPrompt; }, [configPrompt]);
  useEffect(() => {
    if (onLoadingChange) onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  const hasSplitContext = Boolean(setupPrompt || configPrompt);
  const hasAnyContext = Boolean(predefinedPrompt || setupPrompt || configPrompt);

  const buildPredefinedPrompt = useCallback(
    ({
      includeDefault = false,
      includeSetup = false,
      includeConfig = false,
    }: {
      includeDefault?: boolean;
      includeSetup?: boolean;
      includeConfig?: boolean;
    }) => {
      if (!hasSplitContext) {
        return includeDefault ? predefinedPromptRef.current : "";
      }

      const parts: string[] = [];
      if (includeSetup && setupPromptRef.current) parts.push(setupPromptRef.current);
      if (includeConfig && configPromptRef.current) parts.push(configPromptRef.current);
      return parts.join("\n");
    },
    [hasSplitContext]
  );

  /**
   * Returns true when the API error means the stored conversation_id is no
   * longer valid and we should retry with a fresh null id.
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

  // ── Automatic Initialization ──────────────────────────────────────────────
  // Trigger when:
  //  - autoInitialize is enabled
  //  - there is no existing conversation (conversationId is null)
  //  - there are no messages loaded yet
  //  - a predefinedPrompt is available (schema context)
  //  - no pendingInput is queued (avoid collision)
  //  - not currently loading
  // This naturally re-triggers on "New Chat" since conversationId resets to null.
  const initFiredRef = useRef(false);

  useEffect(() => {
    // Reset the guard when conversationId becomes null (new chat or first load)
    if (conversationId === null) {
      initFiredRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    if (
      !autoInitialize ||
      loading ||
      conversationId ||
      messages.length > 0 ||
      !hasAnyContext ||
      pendingInput ||
      initFiredRef.current
    ) return;

    initFiredRef.current = true;

    const timer = setTimeout(() => {
      setLoading(true);
      const finalPrompt = formatPrompt
        ? formatPrompt("(Initializing schema)")
        : formatUserPrompt("(Initializing schema)");

      // Always send the current setup/config context once for a new thread.
      // so that a new thread correctly receives full context.
      apiSendMessage({
        conversation_id: null,
        instruction_set: instructionSet,
        predefined_prompt: buildPredefinedPrompt({
          includeDefault: true,
          includeSetup: true,
          includeConfig: true,
        }),
        conversation_metadata: conversationMetadata || {},
        user_prompt: finalPrompt,
      }).then(res => {
        if (res.conversation_id) {
          setConversationId(res.conversation_id);
          if (onConversationIdChange) onConversationIdChange(res.conversation_id);
        }

        const rawResponseText = res.response ?? "";
        const displayedText = extractAssistantDisplayText(rawResponseText);
        if (displayedText) {
          setMessages([{ role: "assistant", text: displayedText }]);

          if (showAiSuggestions) {
            try {
              const cleanText = rawResponseText.replace(/```json\s*|\s*```/g, "").trim();
              const parsed = JSON.parse(cleanText);
              const suggestions = parsed.report_suggestions || parsed.chart_suggestions || [];
              if (Array.isArray(suggestions) && suggestions.length > 0) {
                setAiSuggestions(suggestions);
                setShowPrompts(true);
              }
            } catch (e) {}
          }

          if (onAssistantResponse) onAssistantResponse(displayedText, rawResponseText);
        }
      }).catch(err => {
        console.error("Auto-init failed", err);
        initFiredRef.current = false; // allow retry on next mount
      }).finally(() => {
        setLoading(false);
      });
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length, hasAnyContext, loading, pendingInput, buildPredefinedPrompt]);

  const refreshSuggestions = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    // Hide suggestions while loading if you want, or keep them
    const finalPrompt = formatPrompt ? formatPrompt("(Refreshing suggestions)") : formatUserPrompt("(Refreshing suggestions)");
    
    try {
      const res = await apiSendMessage({
        conversation_id: conversationId, // Refresh within same conversation if exists
        instruction_set: instructionSet,
        predefined_prompt: !conversationId
          ? buildPredefinedPrompt({ includeDefault: true, includeSetup: true, includeConfig: true })
          : "",
        conversation_metadata: conversationMetadata || {},
        user_prompt: finalPrompt,
      });

      if (res.conversation_id && res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id);
        if (onConversationIdChange) onConversationIdChange(res.conversation_id);
      }
      
      const rawResponseText = res.response ?? "";
      const displayedText = extractAssistantDisplayText(rawResponseText);
      
      if (displayedText) {
        // We add it to messages so context remains
        setMessages(prev => [...prev, { role: "assistant", text: displayedText }]);
        
        if (showAiSuggestions) {
          try {
            const cleanText = rawResponseText.replace(/```json\s*|\s*```/g, "").trim();
            const parsed = JSON.parse(cleanText);
            const suggestions = parsed.report_suggestions || parsed.chart_suggestions || [];
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              setAiSuggestions(suggestions);
              setShowPrompts(true);
            }
          } catch (e) {}
        }
        if (onAssistantResponse) onAssistantResponse(displayedText, rawResponseText);
      }
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, instructionSet, conversationMetadata, formatPrompt, showAiSuggestions, loading, onAssistantResponse, onConversationIdChange, buildPredefinedPrompt]);

  const sendMessageToAI = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    setShowPrompts(false);

    const finalPrompt = formatPrompt ? formatPrompt(userText) : formatUserPrompt(userText);

    try {
      const isNewConversation = !conversationId;
      const payload = {
        conversation_id: conversationId,
        instruction_set: instructionSet,
        // New threads get context once. Existing threads only get explicit latest setup/config requests.
        predefined_prompt: buildPredefinedPrompt({
          includeDefault: isNewConversation || (!hasSplitContext && (includeLatestSetup || includeLatestConfig)),
          includeSetup: isNewConversation || includeLatestSetup,
          includeConfig: isNewConversation || includeLatestConfig,
        }),
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
        
        // Extract AI suggestions if opt-in enabled
        if (showAiSuggestions) {
          try {
            const cleanText = rawResponseText.replace(/```json\s*|\s*```/g, "").trim();
            const parsed = JSON.parse(cleanText);
            const suggestions = parsed.report_suggestions || parsed.chart_suggestions || [];
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              setAiSuggestions(suggestions);
              setShowPrompts(true); // Auto-show suggestions when AI provides them
            }
          } catch (e) {
            // No suggestions in this response
          }
        }

        if (onAssistantResponse) {
          onAssistantResponse(displayedText, rawResponseText);
        }

        if (includeLatestSetup) setIncludeLatestSetup(false);
        if (includeLatestConfig) setIncludeLatestConfig(false);
      }
    } catch (error: any) {
      console.error("Failed to send message", error);

      if (isStaleConvError(error)) {
        console.warn("[Chatbot] Stale conversation ID detected. Retrying...");
        setConversationId(null);
        if (onConversationIdChange) onConversationIdChange(null);

        try {
          const retryPayload = {
            conversation_id: null,
            instruction_set: instructionSet,
            predefined_prompt: buildPredefinedPrompt({
              includeDefault: true,
              includeSetup: true,
              includeConfig: true,
            }),
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
          return;
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
  }, [
    conversationId,
    conversationMetadata,
    formatPrompt,
    includeLatestSetup,
    includeLatestConfig,
    instructionSet,
    onAssistantResponse,
    onConversationIdChange,
    buildPredefinedPrompt,
    hasSplitContext,
  ]);

  // Auto-send when a suggestion chip is clicked from parent
  useEffect(() => {
    if (!pendingInput || loading) return;
    sendMessageToAI(pendingInput);
    if (onPendingInputConsumed) onPendingInputConsumed();
  }, [pendingInput, loading, sendMessageToAI, onPendingInputConsumed]);

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
              const isInsightPredefined = text.includes('"module":') && text.includes('"fields":');
              const hasPredefined =
                text.includes("Today's date") ||
                text.includes("Here is my DB Schema") ||
                text.includes("Here is my Previous Report Config") ||
                text.includes("FieldName:") ||
                text.includes("Report Insight:") ||
                isInsightPredefined;

              if (hasPredefined) {
                if (isInsightPredefined) {
                  const splitIdx = text.lastIndexOf("}\n");
                  if (splitIdx !== -1) {
                    text = text.substring(splitIdx + 2).trim();
                  } else {
                    const userPromptStart = text.indexOf('"user_prompt": "');
                    if (userPromptStart !== -1) {
                      const endQuote = text.lastIndexOf('"');
                      text = text.substring(userPromptStart + 16, endQuote).trim();
                    } else {
                      const lastNewline = text.lastIndexOf("\n");
                      if (lastNewline !== -1) text = text.substring(lastNewline + 1).trim();
                      else text = "";
                    }
                  }
                } else {
                  const lastNewline = text.lastIndexOf("\n");
                  if (lastNewline !== -1) {
                    text = text.substring(lastNewline + 1).trim();
                  } else {
                    text = "";
                  }
                }
              }

              if (text.endsWith(".json")) {
                text = text.slice(0, -5).trim();
              }
            }

            return {
              role: item.role as "user" | "assistant",
              text: text
            };
          })
          .filter((m: any) => m.text.length > 0);
      });
      setMessages(restored.reverse());
    });
  }, [conversationId]);

  const handleNewChat = useCallback(() => {
    setConversationId(null); 
    setMessages([]);         
    setInput("");            
    setShowPrompts(false);   
    setAiSuggestions([]);
    if (onConversationIdChange) onConversationIdChange(null);
  }, [onConversationIdChange]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessageToAI(input);
  };

  const selectPrompt = (text: string) => {
    setInput(text);
    setShowPrompts(false);
    // Focus the input area after setting the text
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
              <h2 className="truncate text-sm font-bold tracking-tight text-slate-900">
                {botName}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            
            {(suggestedPrompts.length > 0 || aiSuggestions.length > 0) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPrompts((prev) => !prev);
                }}
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

        <CardContent className="flex-1 p-0 overflow-hidden relative bg-slate-50 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-5 pb-40 pt-6">
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
          
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3 relative">
            {/* Floating Suggestion List */}
            {showPrompts && (suggestedPrompts.length > 0 || aiSuggestions.length > 0) && (
              <div className="absolute bottom-[calc(100%+8px)] left-4 right-4 z-[100] flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.2)] max-h-[300px] overflow-y-auto scrollbar-minimal">
                  <div className="flex items-center justify-between px-2 mb-1.5 sticky top-0 bg-white pb-1 z-10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Suggestions</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        refreshSuggestions();
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`size-2.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {/* AI Dynamic Suggestions */}
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={`ai-${index}`}
                      onClick={() => selectPrompt(suggestion)}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-slate-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 transition-all hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm transition-colors group-hover:bg-indigo-50">
                        <Bot className="size-3 text-indigo-500" />
                      </div>
                      <span className="truncate">{suggestion}</span>
                    </button>
                  ))}
                  
                  {/* Static Suggested Prompts (if no AI suggestions yet) */}
                  {aiSuggestions.length === 0 && suggestedPrompts.map((prompt, index) => (
                    <button
                      key={`static-${index}`}
                      onClick={() => selectPrompt(prompt.description)}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-slate-50/50 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 transition-all hover:border-indigo-100 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm transition-colors group-hover:bg-indigo-50">
                        <HelpCircle className="size-3 text-indigo-500" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{prompt.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showSetupCheckbox && (
              <div className="mx-auto mb-2 flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-1">
                {hasSplitContext ? (
                  <>
                    <label
                      htmlFor="send-latest-setup"
                      className="flex cursor-pointer select-none items-center gap-2 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700"
                    >
                      <input
                        type="checkbox"
                        id="send-latest-setup"
                        checked={includeLatestSetup}
                        onChange={(e) => setIncludeLatestSetup(e.target.checked)}
                        disabled={!setupPrompt}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Send latest setup
                    </label>

                    <label
                      htmlFor="send-latest-config"
                      className="flex cursor-pointer select-none items-center gap-2 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700"
                    >
                      <input
                        type="checkbox"
                        id="send-latest-config"
                        checked={includeLatestConfig}
                        onChange={(e) => setIncludeLatestConfig(e.target.checked)}
                        disabled={!configPrompt}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Send latest config
                    </label>
                  </>
                ) : (
                  <label
                    htmlFor="send-latest-context"
                    className="flex cursor-pointer select-none items-center gap-2 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700"
                  >
                    <input
                      type="checkbox"
                      id="send-latest-context"
                      checked={includeLatestSetup}
                      onChange={(e) => setIncludeLatestSetup(e.target.checked)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Send latest context with prompt
                  </label>
                )}
              </div>
            )}

            <form onSubmit={handleSend} className="mx-auto flex w-full max-w-4xl items-end gap-3">
              <div className="flex min-h-[44px] flex-1 items-end gap-3 rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-shadow">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPrompts((prev) => !prev);
                  }}
                  className={`mb-0.5 size-9 shrink-0 rounded-xl p-0 transition-all ${
                    showPrompts
                      ? "bg-indigo-50 text-indigo-600 shadow-inner"
                      : "bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 shadow-sm"
                  }`}
                >
                  <HelpCircle className="size-5" />
                </Button>

                <div className="flex-1 min-w-0">
                  <TextareaAutosize
                    ref={inputRef}
                    rows={1}
                    minRows={1}
                    maxRows={8}
                    placeholder="Describe the report you want to build..."
                    className="chat-textarea text-slate-700 scrollbar-minimal"
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
