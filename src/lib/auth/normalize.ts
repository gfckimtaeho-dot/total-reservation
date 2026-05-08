// Email/password input normalization for autofill robustness.
//
// Mobile keyboards and password managers (notably iOS Safari + various Android
// IMEs) sometimes inject invisible characters into autofilled fields:
//   - NBSP (U+00A0) — caught by \s in JS per ECMAScript spec
//   - zero-width chars (U+200B–U+200D) — ZWSP, ZWNJ, ZWJ
//   - word joiner (U+2060)
//   - BOM (U+FEFF)
//
// `.trim()` only removes ASCII whitespace, so a value typed manually and a
// value pasted by autofill can differ even when they look identical to the user.

// Invisible characters not caught by \s.
const INVISIBLE_RE = /[​-‍⁠﻿]/g;

export function normalizeEmail(input: string): string {
  return input
    .replace(INVISIBLE_RE, "")
    .replace(/\s/g, "")
    .toLowerCase();
}

export function normalizeSlug(input: string): string {
  return input.replace(INVISIBLE_RE, "").replace(/\s/g, "");
}

// Passwords keep internal whitespace (some users intentionally use spaces),
// but we strip leading/trailing whitespace and any invisible chars anywhere —
// no legitimate password contains a zero-width character.
export function normalizePassword(input: string): string {
  return input.replace(INVISIBLE_RE, "").replace(/^\s+|\s+$/g, "");
}
