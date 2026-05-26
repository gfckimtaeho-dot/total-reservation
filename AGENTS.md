<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rules

- Audit columns are mandatory on every table — current and future. Every model must have `createdAt`, `updatedAt`, `createdById`, `updatedById`; writes auto-stamp the logged-in account. Never strip these or bypass the Prisma stamping extension. Details: `docs/audit.md`.

# Commands

- `npm run dev` — dev server (port 3000)
- `npm run build` — `prisma migrate deploy && next build` (prod only)
- `npm run test` — vitest
- `npm run lint` — eslint

# Docs index

Domain specs live in `docs/`:
- `auth.md`, `access.md` — 인증, 권한
- `database.md`, `audit.md` — 스키마, audit columns 규칙
- `booking.md`, `business.md`, `customer.md` — 예약, 매장, 고객 영역
- `trainers.md`, `handover.md` — 트레이너 운영, PT 양도
- `chat.md`, `notification.md`, `admin.md` — 채팅, 알림, 관리자
- `REQUIREMENTS.md` — 최상위 요구사항
