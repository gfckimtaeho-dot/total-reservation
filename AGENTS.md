<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rules

- Audit columns are mandatory on every table — current and future. Every model must have `createdAt`, `updatedAt`, `createdById`, `updatedById`; writes auto-stamp the logged-in account. Never strip these or bypass the Prisma stamping extension. Details: `docs/audit.md`.
