"use client";

import { useActionState } from "react";
import { postMessage, type ActionState } from "@/app/listings/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/misc";

export interface DealMessage {
  id: string;
  body: string;
  authorName: string;
  isMe: boolean;
  createdAt: string;
}

export function DealRoom({ listingId, messages }: { listingId: string; messages: DealMessage[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(postMessage, undefined);

  return (
    <div className="space-y-4">
      <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.isMe ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                m.isMe ? "bg-primary text-primary-foreground" : "bg-background border"
              }`}
            >
              <div className="mb-0.5 text-xs opacity-70">
                {m.authorName} · {m.createdAt}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          </div>
        ))}
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="listingId" value={listingId} />
        <Textarea name="body" placeholder="Write a message to the other party…" required />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </form>
    </div>
  );
}
