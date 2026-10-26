import { describe, expect, it } from "vitest";
import { slugFromLink } from "./create-room-form";
import { errorCode, errorMessage } from "./errors";

describe("slugFromLink", () => {
  it.each([
    ["https://sprintdeck.app/r/AbCdEf123456", "AbCdEf123456"],
    ["http://localhost:3000/r/AbCdEf123456#host=secret", "AbCdEf123456"],
    ["/r/AbCdEf123456?x=1", "AbCdEf123456"],
    ["  AbCdEf123456 ", "AbCdEf123456"],
    ["https://sprintdeck.app/r/short", null],
    ["hello world", null],
  ])("%s → %s", (input, slug) => {
    expect(slugFromLink(input)).toBe(slug);
  });
});

describe("room errors", () => {
  it("maps RPC codes to messages", () => {
    expect(errorCode({ message: "not_host" })).toBe("not_host");
    expect(errorMessage({ message: "not_host" })).toBe("Only the host can do that.");
  });

  it("recognizes a rejected human check", () => {
    expect(errorCode({ message: "captcha protection: request disallowed (invalid-input-response)" })).toBe(
      "captcha_failed",
    );
  });

  it("falls back for anything unexpected", () => {
    expect(errorCode(new Error("fetch failed"))).toBe("unknown");
    expect(errorCode({ message: "unknown" })).toBe("unknown");
    expect(errorCode(null)).toBe("unknown");
  });
});
