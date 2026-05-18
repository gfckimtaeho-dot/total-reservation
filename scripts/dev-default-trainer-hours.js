// DEV — 기존 Staff 중 출근시간 미설정(null)인 트레이너를 기본 10:00~22:00
// (600~1320분)으로 backfill. 스키마 @default 는 신규 row에만 적용되므로
// 이미 만들어진 트레이너(Kevin/Nari 등)는 이 스크립트로 채운다.
// 사용자 직접 실행: > node scripts/dev-default-trainer-hours.js
require("dotenv").config();
const { Client } = require("pg");

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    `update "Staff"
       set "workStartMin" = coalesce("workStartMin", 600),
           "workEndMin"   = coalesce("workEndMin", 1320)
     where "workStartMin" is null or "workEndMin" is null
     returning id`,
  );
  console.log(`backfilled ${r.rowCount} staff -> 10:00~22:00`);
  await c.end();
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
