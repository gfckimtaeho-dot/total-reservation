// DEV ONLY — stronghealth gym의 사장+트레이너 계정에 비번/ACTIVE 설정.
// 시드는 계정 골격만 만들고 passwordHash·status는 비워둠. 태블릿 실기기
// 로그인 테스트용으로 빠르게 활성화. 정상 경로는 activate(매직링크).
// 사용자가 직접 실행: > node scripts/dev-activate-accounts.js
require("dotenv").config();
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const SLUG = "stronghealth";
const EMAILS = [
  "kthrtyu@naver.com", // 헬스장 사장 (OWNER)
  "etcrrrtt@gmail.com", // PT 남자 트레이너 (Kevin) — r 3개 (accounts.txt 오타 교정)
  "kimtaeho870@gmail.com", // 요가 여자 트레이너
];
const PW = "gigood12";

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const b = await c.query(
    'select id, name from "Business" where slug = $1',
    [SLUG],
  );
  if (!b.rows[0]) {
    console.log("NO BUSINESS for slug", SLUG);
    process.exit(1);
  }
  const gymId = b.rows[0].id;
  console.log("gym:", b.rows[0].name);

  const before = await c.query(
    'select email, role, status, ("passwordHash" is not null) as haspw from "User" where "gymId" = $1 and email = any($2)',
    [gymId, EMAILS],
  );
  console.log("--- before ---");
  before.rows.forEach((r) =>
    console.log(r.email, "|", r.role, "|", r.status, "| pw:", r.haspw),
  );

  const hash = bcrypt.hashSync(PW, 10);
  const upd = await c.query(
    `update "User" set "passwordHash" = $1, status = 'ACTIVE' where "gymId" = $2 and email = any($3) returning email, role, status`,
    [hash, gymId, EMAILS],
  );
  console.log(`--- after (updated ${upd.rowCount}) ---`);
  upd.rows.forEach((r) =>
    console.log(r.email, "|", r.role, "|", r.status, "| pw: set ->", PW),
  );

  await c.end();
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
