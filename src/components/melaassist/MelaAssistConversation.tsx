import { useEffect, useRef } from "react";
import { Sparkles, User as UserIcon, AlertCircle } from "lucide-react";
import type { MelaAssistMessage } from "./types";

export function MelaAssistConversation({ messages }: { messages: MelaAssistMessage[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="space-y-4 px-4 py-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: MelaAssistMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
        }`}
        aria-hidden
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : message.error
              ? "border border-destructive/30 bg-destructive/5 text-destructive"
              : "border border-border bg-card text-foreground"
        }`}
      >
        {message.error && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <AlertCircle className="h-3 w-3" /> Something went wrong
          </div>
        )}
        <p className="whitespace-pre-wrap">
          {message.content}
          {message.pending && <TypingCursor />}
        </p>
      </div>
    </div>
  );
}

function TypingCursor() {
  return (
    <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-current align-middle" />
  );
}
