'use client';

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode,
  useCallback
} from 'react';

import {
  sendMessage as apiSendMessage,
  getConversation,
} from "@/lib/bot/conversationAPI";
import { formatUserPrompt } from "@/lib/bot/promptFormatter";
import { parseAssistantResponse } from "@/lib/bot/responseParser";
import { CHAT_CONFIG } from "@/constants/analytics";

// --- Types ---

export type Message = {
  role: "user" | "assistant";
  text: string;
};

interface ChatContextType {
  // State
  conversationId: string | null;
  messages: Message[];
  loading: boolean;
  input: string;
  showPrompts: boolean;

  // Actions
  setInput: (text: string) => void;
  setShowPrompts: (show: boolean) => void;
  handleNewChat: () => void;
  handleSend: (e?: React.FormEvent) => Promise<void>;
  selectPrompt: (text: string) => void;
}

// --- Context ---

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  // Load conversation history when ID changes
  useEffect(() => {
    if (!conversationId) return;
    if (messages.length > 0) return; // Prevent re-fetching if messages already loaded

    getConversation(conversationId).then((items) => {
      const restored = items.flatMap((item: any) =>
        item.content
          .filter((c: any) => c.type === "output_text")
          .map((c: any) => ({
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

  // --- Actions ---

  const handleNewChat = useCallback(() => {
    setConversationId(null); 
    setMessages([]);         
    setInput("");            
    setShowPrompts(false);   
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setLoading(true);
    setShowPrompts(false);

    // Optimistic update
    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    try {
      const res = await apiSendMessage({
        instruction_set: CHAT_CONFIG.SYSTEM_INSTRUCTION,
        conversation_id: conversationId,
        conversation_metadata: conversationId ? undefined : { source: CHAT_CONFIG.SOURCE_METADATA },
        predefined_prompt: CHAT_CONFIG.DEFAULT_PREDEFINED,
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
  };

  const selectPrompt = useCallback((text: string) => {
    setInput(text);
    setShowPrompts(false);
  }, []);

  // --- Export ---

  const value = {
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
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within a ChatProvider");
  return context;
}