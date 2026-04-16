"use client";

import { ModularChatbot } from "@/components/chat/ModularChatbot";

export default function ChatPage() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-white p-4">
      <ModularChatbot 
        instructionSet="You are a helpful assistant. Always respond clearly and concisely."
        predefinedPrompt="Answer in plain English."
        botName="Kibiai AI Assistant"
        welcomeMessage="Hello! I am your AI assistant. How can I help you today?"
        conversationMetadata={{
          user_id: "test_user_001",
          source: "web_test"
        }}
      />
    </main>
  );
}