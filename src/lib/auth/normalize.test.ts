import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePassword,
  normalizeSlug,
} from "./normalize";

describe("normalizeEmail", () => {
  it("lowercases and strips ASCII whitespace", () => {
    expect(normalizeEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com");
  });

  it("strips NBSP (U+00A0) — autofill on iOS Safari", () => {
    expect(normalizeEmail("foo@bar.com ")).toBe("foo@bar.com");
    expect(normalizeEmail(" foo@bar.com")).toBe("foo@bar.com");
    expect(normalizeEmail("foo @bar.com")).toBe("foo@bar.com");
  });

  it("strips zero-width chars (ZWSP/ZWNJ/ZWJ/BOM/word joiner)", () => {
    expect(normalizeEmail("foo​@bar.com")).toBe("foo@bar.com");
    expect(normalizeEmail("foo@‌bar.com")).toBe("foo@bar.com");
    expect(normalizeEmail("foo@bar.com‍")).toBe("foo@bar.com");
    expect(normalizeEmail("﻿foo@bar.com")).toBe("foo@bar.com");
    expect(normalizeEmail("foo⁠@bar.com")).toBe("foo@bar.com");
  });

  it("strips combinations from a single string", () => {
    expect(normalizeEmail(" FOO​@‌Bar.com﻿")).toBe(
      "foo@bar.com",
    );
  });
});

describe("normalizeSlug", () => {
  it("strips invisible chars but preserves case", () => {
    expect(normalizeSlug(" StringHealth​ ")).toBe("StringHealth");
  });
});

describe("normalizePassword", () => {
  it("strips leading/trailing whitespace + invisible anywhere", () => {
    expect(normalizePassword("  hunter2  ")).toBe("hunter2");
    expect(normalizePassword("hunter2 ")).toBe("hunter2");
    expect(normalizePassword("hun​ter2")).toBe("hunter2");
  });

  it("preserves internal regular spaces (intentional in passphrases)", () => {
    expect(normalizePassword("correct horse battery staple")).toBe(
      "correct horse battery staple",
    );
  });
});
