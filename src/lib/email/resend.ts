// Mail transport. Despite the legacy filename, this now uses Gmail SMTP via
// nodemailer — Gmail handles SPF/DKIM/reputation for us, and the only setup is
// a Google "App Password" (2-Step Verification → App Passwords → 16-char token).
//
// Env vars:
//   GMAIL_USER          (e.g. you@gmail.com — also becomes the From address)
//   GMAIL_APP_PASSWORD  (16-char Google App Password, NOT your account password)
//
// Behaviour:
//   - both vars set → real send via Gmail SMTP
//   - either var missing → console-log fallback (admin UI exposes URL directly)
//   - SMTP error → returned as { ok:false, fallback:false, error: msg }

import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.trim();
const FROM_NAME = process.env.MAIL_FROM_NAME ?? "예약가즈아";

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; fallback: true }
  | { ok: false; fallback: false; error: string };

function makeTransport() {
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  storeName: string;
  ownerName: string;
  publicUrl: string;
  loginUrl: string;
  dashboardUrl: string;
}): Promise<SendResult> {
  const subject = `예약가즈아 — ${opts.storeName} 매장 등록이 완료됐습니다`;
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:16px">${opts.ownerName} 사장님, 환영합니다.</p>
    <p style="font-size:16px"><strong>${opts.storeName}</strong> 매장 등록이 완료됐습니다. 무료 체험 90일이 시작됐어요.</p>
    <p style="margin:24px 0">
      <a href="${opts.dashboardUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">대시보드 열기 →</a>
    </p>
    <h3 style="font-size:14px;color:#333;margin-top:32px">다음에 다시 들어오시려면 — 이 메일을 보관해 주세요</h3>
    <table style="font-size:14px;border-collapse:collapse;width:100%">
      <tr>
        <td style="padding:8px 0;color:#666;width:140px">매장 공개 페이지</td>
        <td style="padding:8px 0"><a href="${opts.publicUrl}">${opts.publicUrl}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">사장 로그인</td>
        <td style="padding:8px 0"><a href="${opts.loginUrl}">${opts.loginUrl}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">대시보드</td>
        <td style="padding:8px 0"><a href="${opts.dashboardUrl}">${opts.dashboardUrl}</a></td>
      </tr>
    </table>
    <p style="font-size:12px;color:#666;margin-top:24px">📌 위 URL을 휴대폰·노트북 북마크에 저장하거나, 폰 브라우저 메뉴의 "홈 화면에 추가"로 PWA 설치하시면 다음 접속이 한 번 클릭으로 끝납니다.</p>
  </div>`;
  const text = `${opts.ownerName} 사장님,\n\n${opts.storeName} 매장 등록이 완료됐습니다.\n\n대시보드: ${opts.dashboardUrl}\n로그인: ${opts.loginUrl}\n매장 공개 페이지: ${opts.publicUrl}\n\n위 URL을 북마크에 저장하시거나 PWA로 설치해 주세요.`;

  const transport = makeTransport();
  if (!transport) {
    console.log(
      `[email/fallback] welcome email skipped (GMAIL creds missing) to ${opts.to}`,
    );
    console.log(`[email/fallback] login: ${opts.loginUrl}`);
    return { ok: false, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: `${FROM_NAME} <${user}>`,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP error (welcome):", message);
    return { ok: false, fallback: false, error: message };
  }
}

export async function sendCustomerActivationEmail(opts: {
  to: string;
  memberName: string;
  storeName: string;
  activateUrl: string;
}): Promise<SendResult> {
  const subject = `${opts.storeName} — 예약가즈아 회원 등록 안내`;
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:16px">${opts.memberName} 님, 안녕하세요.</p>
    <p style="font-size:16px"><strong>${opts.storeName}</strong>의 회원으로 등록되셨습니다. 아래 버튼을 눌러 비밀번호를 설정하시면 회원증·예약 화면에 접속할 수 있습니다.</p>
    <p style="margin:24px 0">
      <a href="${opts.activateUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">설치 / 비밀번호 설정 →</a>
    </p>
    <p style="font-size:12px;color:#666">버튼이 작동하지 않으면 이 URL을 복사해 주세요:<br/><a href="${opts.activateUrl}">${opts.activateUrl}</a></p>
    <p style="font-size:12px;color:#666;margin-top:24px">📌 폰 브라우저에서 열고 메뉴의 "홈 화면에 추가"를 누르면 앱처럼 사용할 수 있습니다. 링크는 7일간 유효합니다.</p>
  </div>`;
  const text = `${opts.memberName} 님,\n\n${opts.storeName}의 회원으로 등록되셨습니다.\n비밀번호 설정: ${opts.activateUrl}\n(7일 유효)`;

  const transport = makeTransport();
  if (!transport) {
    console.log(
      `[email/fallback] activation email skipped (GMAIL creds missing) to ${opts.to}`,
    );
    console.log(`[email/fallback] activate: ${opts.activateUrl}`);
    return { ok: false, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: `${FROM_NAME} <${user}>`,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP error (activation):", message);
    return { ok: false, fallback: false, error: message };
  }
}

export async function sendStaffActivationEmail(opts: {
  to: string;
  staffName: string;
  storeName: string;
  roleLabel: string;
  activateUrl: string;
}): Promise<SendResult> {
  const subject = `${opts.storeName} — ${opts.roleLabel} 등록 안내`;
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:16px">${opts.staffName} 님, 안녕하세요.</p>
    <p style="font-size:16px"><strong>${opts.storeName}</strong>에 ${opts.roleLabel}로 등록되셨습니다. 아래 버튼을 눌러 비밀번호를 설정하시면 운영 화면에 접속할 수 있습니다.</p>
    <p style="margin:24px 0">
      <a href="${opts.activateUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">설치 / 비밀번호 설정 →</a>
    </p>
    <p style="font-size:12px;color:#666">버튼이 작동하지 않으면 이 URL을 복사해 주세요:<br/><a href="${opts.activateUrl}">${opts.activateUrl}</a></p>
    <p style="font-size:12px;color:#666;margin-top:24px">📌 태블릿/폰 브라우저에서 열고 메뉴의 "홈 화면에 추가"를 누르면 앱처럼 사용할 수 있습니다. 링크는 7일간 유효합니다.</p>
  </div>`;
  const text = `${opts.staffName} 님,\n\n${opts.storeName}에 ${opts.roleLabel}로 등록되셨습니다.\n비밀번호 설정: ${opts.activateUrl}\n(7일 유효)`;

  const transport = makeTransport();
  if (!transport) {
    console.log(
      `[email/fallback] staff activation skipped (GMAIL creds missing) to ${opts.to}`,
    );
    console.log(`[email/fallback] activate: ${opts.activateUrl}`);
    return { ok: false, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: `${FROM_NAME} <${user}>`,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP error (staff activation):", message);
    return { ok: false, fallback: false, error: message };
  }
}

// 회원/트레이너 공용 비번 재설정 메일. 사장이 발급 화면에서 "메일 발송" 클릭
// 시 호출. 링크는 PASSWORD_RESET magic link 토큰 (7일). 활성화와 다른 본문 —
// 이미 ACTIVE 계정의 비번만 바뀌는 흐름임을 명시.
export async function sendPasswordResetEmail(opts: {
  to: string;
  recipientName: string;
  storeName: string;
  resetUrl: string;
}): Promise<SendResult> {
  const subject = `${opts.storeName} — 비밀번호 재설정 안내`;
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:16px">${opts.recipientName} 님, 안녕하세요.</p>
    <p style="font-size:16px"><strong>${opts.storeName}</strong>에서 비밀번호 재설정 링크가 발급됐습니다. 아래 버튼을 눌러 새 비밀번호를 설정하시면 즉시 로그인됩니다.</p>
    <p style="margin:24px 0">
      <a href="${opts.resetUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">비밀번호 재설정 →</a>
    </p>
    <p style="font-size:12px;color:#666">버튼이 작동하지 않으면 이 URL을 복사해 주세요:<br/><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>
    <p style="font-size:12px;color:#666;margin-top:24px">📌 본인이 요청하지 않았다면 이 메일을 무시해 주세요. 링크는 7일간 유효합니다.</p>
  </div>`;
  const text = `${opts.recipientName} 님,\n\n${opts.storeName}에서 비밀번호 재설정 링크가 발급됐습니다.\n재설정: ${opts.resetUrl}\n(7일 유효)`;

  const transport = makeTransport();
  if (!transport) {
    console.log(
      `[email/fallback] password reset email skipped (GMAIL creds missing) to ${opts.to}`,
    );
    console.log(`[email/fallback] reset: ${opts.resetUrl}`);
    return { ok: false, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: `${FROM_NAME} <${user}>`,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP error (password reset):", message);
    return { ok: false, fallback: false, error: message };
  }
}

export async function sendInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  expectedBusinessName?: string | null;
}): Promise<SendResult> {
  const subject = "예약가즈아 매장 등록 초대";
  const greeting = opts.expectedBusinessName
    ? `안녕하세요, ${opts.expectedBusinessName} 사장님.`
    : "안녕하세요.";
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:16px">${greeting}</p>
    <p style="font-size:16px">예약가즈아의 매장 등록 초대 링크입니다. 7일 안에 아래 버튼을 눌러 매장 정보를 입력해 주세요.</p>
    <p style="margin:24px 0">
      <a href="${opts.inviteUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">매장 등록 시작 →</a>
    </p>
    <p style="font-size:12px;color:#666">버튼이 작동하지 않으면 이 URL을 복사해 주세요:<br/><a href="${opts.inviteUrl}">${opts.inviteUrl}</a></p>
  </div>`;
  const text = `${greeting}\n\n예약가즈아의 매장 등록 초대 링크입니다. 7일 안에 아래 URL로 진입해 주세요.\n\n${opts.inviteUrl}`;

  const transport = makeTransport();
  if (!transport) {
    console.log(
      `[email/fallback] GMAIL_USER / GMAIL_APP_PASSWORD missing — would send invite to ${opts.to}`,
    );
    console.log(`[email/fallback] URL: ${opts.inviteUrl}`);
    return { ok: false, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: `${FROM_NAME} <${user}>`,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP error:", message);
    return { ok: false, fallback: false, error: message };
  }
}

// 호텔 커피매니저(카페 사장) 초대 메일. 헬스장 admin 이 가맹점(호텔) 상세에서
// "커피매니저 발급" 클릭 시 호출. 링크는 호텔 reset-credentials 의 STAFF_INVITE
// 토큰 — 카페 사장이 아이디/비번을 직접 설정하면 호텔 커피 화면으로 진입한다.
// 발송 인프라(Gmail SMTP)는 가맹점 등록 메일과 동일, 문구만 커피 초대용.
export async function sendCoffeeManagerInviteEmail(opts: {
  to: string;
  recipientName: string;
  hotelName: string;
  setupUrl: string;
}): Promise<SendResult> {
  const subject = `${opts.hotelName} — 커피매니저 등록 안내`;
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <p style="font-size:16px">${opts.recipientName} 님, 안녕하세요.</p>
    <p style="font-size:16px"><strong>${opts.hotelName}</strong>의 커피매니저로 초대되셨습니다. 아래 버튼을 눌러 아이디와 비밀번호를 설정하시면 바로 커피 운영 화면으로 입장하실 수 있습니다.</p>
    <p style="margin:24px 0">
      <a href="${opts.setupUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">아이디 / 비밀번호 설정</a>
    </p>
    <p style="font-size:12px;color:#666">버튼이 작동하지 않으면 이 URL을 복사해 주세요:<br/><a href="${opts.setupUrl}">${opts.setupUrl}</a></p>
    <p style="font-size:12px;color:#666;margin-top:24px">📌 태블릿/폰 브라우저에서 열고 메뉴의 "홈 화면에 추가"를 누르면 앱처럼 사용할 수 있습니다. 링크는 7일간 유효합니다.</p>
  </div>`;
  const text = `${opts.recipientName} 님,\n\n${opts.hotelName}의 커피매니저로 초대되셨습니다.\n아이디/비밀번호 설정: ${opts.setupUrl}\n(7일 유효)`;

  const transport = makeTransport();
  if (!transport) {
    console.log(
      `[email/fallback] coffee manager invite skipped (GMAIL creds missing) to ${opts.to}`,
    );
    console.log(`[email/fallback] setup: ${opts.setupUrl}`);
    return { ok: false, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: `${FROM_NAME} <${user}>`,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP error (coffee manager invite):", message);
    return { ok: false, fallback: false, error: message };
  }
}
