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

// 로그인 아이디 정규화. 영문 소문자/숫자/언더스코어/하이픈만 허용. 3-30자.
// 회원이 활성화 페이지·사장이 매장 등록 form 에 입력한 ID 를 안전한 식별자로
// 변환. 입력 단계에서 invisible char 제거 + lowercase + 허용 문자 외 stripping.
export function normalizeLoginId(input: string): string {
  return input
    .replace(INVISIBLE_RE, "")
    .replace(/\s/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export const LOGIN_ID_PATTERN = /^[a-z0-9_-]{3,30}$/;
