import type { RoomErrorCode } from "@/lib/supabase/rooms";
import { en } from "@/messages/en";

const messages: Record<string, string> = en.room.errors;

/**
 * The RPCs raise snake_case codes as the error message. Supabase Auth reports a
 * rejected Turnstile token in words. Anything else is unexpected.
 */
export function errorCode(error: unknown): RoomErrorCode | "captcha_failed" | "unknown" {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (/captcha/i.test(message)) return "captcha_failed";
  return message in messages && message !== "unknown" ? (message as RoomErrorCode) : "unknown";
}

export function errorMessage(error: unknown): string {
  return messages[errorCode(error)];
}
