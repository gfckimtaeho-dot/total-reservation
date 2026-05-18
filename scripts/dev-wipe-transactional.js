// DEV ONLY — stronghealth gym의 "거래 데이터"만 삭제. 비가역.
// 사용자 승인 범위(2026-05-18): Reservation(+ReservationLog cascade) /
// ScheduledClass / AccessLog. 보존: 사장·트레이너·회원 계정, 카탈로그
// (회원권~이벤트), 영업시간, Membership/Package 인스턴스.
// 사용자가 직접 실행: > node scripts/dev-wipe-transactional.js
require("dotenv").config();
const { Client } = require("pg");

const SLUG = "stronghealth";

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const b = await c.query('select id, name from "Business" where slug = $1', [
    SLUG,
  ]);
  if (!b.rows[0]) {
    console.log("NO BUSINESS for slug", SLUG);
    process.exit(1);
  }
  const gymId = b.rows[0].id;
  console.log("gym:", b.rows[0].name);

  const q = async (sql) => (await c.query(sql, [gymId])).rows[0].n;
  const before = {
    reservationLog: await q(
      'select count(*)::int n from "ReservationLog" where "gymId" = $1',
    ),
    reservation: await q(
      'select count(*)::int n from "Reservation" where "gymId" = $1',
    ),
    scheduledClass: await q(
      'select count(*)::int n from "ScheduledClass" where "gymId" = $1',
    ),
    accessLog: await q(
      'select count(*)::int n from "AccessLog" where "gymId" = $1',
    ),
  };
  console.log("--- before counts ---", JSON.stringify(before));

  await c.query("BEGIN");
  try {
    // ReservationLog 는 Reservation onDelete:Cascade 지만 명시적으로 먼저 삭제
    const d1 = await c.query(
      'delete from "ReservationLog" where "gymId" = $1',
      [gymId],
    );
    const d2 = await c.query('delete from "Reservation" where "gymId" = $1', [
      gymId,
    ]);
    const d3 = await c.query(
      'delete from "ScheduledClass" where "gymId" = $1',
      [gymId],
    );
    const d4 = await c.query('delete from "AccessLog" where "gymId" = $1', [
      gymId,
    ]);
    await c.query("COMMIT");
    console.log(
      "--- deleted ---",
      JSON.stringify({
        reservationLog: d1.rowCount,
        reservation: d2.rowCount,
        scheduledClass: d3.rowCount,
        accessLog: d4.rowCount,
      }),
    );
  } catch (e) {
    await c.query("ROLLBACK");
    console.log("ROLLED BACK:", e.message);
    process.exit(1);
  }

  await c.end();
  console.log("done — 회원/트레이너/카탈로그/영업시간 보존됨");
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
