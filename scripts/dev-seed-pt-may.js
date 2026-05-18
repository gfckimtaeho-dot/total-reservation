// DEV — stronghealth 에 PT 테스트용 샘플: 고객 3명 + Kevin PT 예약 다수(2026-05).
// 상태 다양: CONFIRMED / COMPLETED / NO_SHOW / CANCELLED / PENDING_PAYMENT.
// 멱등 — 재실행 시 기존 @sample.local 고객+그 예약을 지우고 다시 넣음.
// 시간은 UTC 그대로 = 트레이너 캘린더 표시시각(시스템 UTC-naive 기준).
// 사용자 직접 실행: > node scripts/dev-seed-pt-may.js
require("dotenv").config();
const { Client } = require("pg");
const { randomUUID } = require("crypto");

const SLUG = "stronghealth";
const CUSTOMERS = [
  { email: "sample.c1@sample.local", name: "김하늘" },
  { email: "sample.c2@sample.local", name: "이준호" },
  { email: "sample.c3@sample.local", name: "박서연" },
];
// [day, hour, min, custIdx, status]
const BOOKINGS = [
  [12, 10, 0, 0, "COMPLETED"],
  [13, 14, 0, 1, "COMPLETED"],
  [14, 11, 0, 2, "COMPLETED"],
  [15, 16, 0, 0, "COMPLETED"],
  [15, 10, 0, 1, "NO_SHOW"],
  [18, 10, 0, 0, "CONFIRMED"],
  [18, 15, 0, 2, "CONFIRMED"],
  [19, 11, 0, 0, "CONFIRMED"],
  [20, 14, 0, 1, "CONFIRMED"],
  [20, 10, 0, 0, "CANCELLED"],
  [21, 16, 0, 2, "CONFIRMED"],
  [22, 10, 0, 0, "CONFIRMED"],
  [25, 13, 0, 1, "CONFIRMED"],
  [26, 11, 0, 2, "CONFIRMED"],
  [26, 16, 0, 1, "CANCELLED"],
  [27, 17, 0, 0, "CONFIRMED"],
  [28, 10, 0, 1, "CONFIRMED"],
  [29, 15, 0, 2, "CONFIRMED"],
  [29, 11, 0, 0, "PENDING_PAYMENT"],
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const b = (
    await c.query('select id from "Business" where slug=$1', [SLUG])
  ).rows[0];
  if (!b) {
    console.log("NO BUSINESS");
    process.exit(1);
  }
  const gymId = b.id;
  const svc = (
    await c.query(
      `select id from "Service" where "gymId"=$1 and capacity=1 and name='PT' limit 1`,
      [gymId],
    )
  ).rows[0];
  const kv = (
    await c.query(
      `select s.id from "Staff" s join "User" u on u.id=s."userId"
       where s."gymId"=$1 and u.email='etcrrrtt@gmail.com'`,
      [gymId],
    )
  ).rows[0];
  if (!svc || !kv) {
    console.log("missing PT service or Kevin", { svc, kv });
    process.exit(1);
  }
  const serviceId = svc.id;
  const staffId = kv.id;

  await c.query("BEGIN");
  try {
    const emails = CUSTOMERS.map((x) => x.email);
    // 기존 샘플 정리 (멱등)
    await c.query(
      `delete from "Reservation" where "gymId"=$1 and "customerUserId" in
         (select id from "User" where "gymId"=$1 and email = any($2))`,
      [gymId, emails],
    );
    await c.query(
      `delete from "User" where "gymId"=$1 and email = any($2)`,
      [gymId, emails],
    );

    const now = new Date();
    const custIds = [];
    for (const cu of CUSTOMERS) {
      const id = randomUUID();
      custIds.push(id);
      await c.query(
        `insert into "User"(id,"gymId",email,name,role,status,locale,"createdAt","updatedAt")
         values($1,$2,$3,$4,'CUSTOMER','ACTIVE','ko',$5,$5)`,
        [id, gymId, cu.email, cu.name, now],
      );
    }

    let n = 0;
    for (const [d, h, mi, ci, status] of BOOKINGS) {
      const start = new Date(Date.UTC(2026, 4, d, h, mi, 0));
      const end = new Date(start.getTime() + 50 * 60 * 1000);
      await c.query(
        `insert into "Reservation"
           (id,"gymId","serviceId","staffId","customerUserId","startAt","endAt",
            status,"depositConfirmed","createdAt","updatedAt")
         values($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$9)`,
        [
          randomUUID(),
          gymId,
          serviceId,
          staffId,
          custIds[ci],
          start,
          end,
          status,
          now,
        ],
      );
      n++;
    }
    await c.query("COMMIT");
    console.log(
      `seeded ${CUSTOMERS.length} customers + ${n} PT reservations (2026-05, Kevin)`,
    );
  } catch (e) {
    await c.query("ROLLBACK");
    console.log("ROLLED BACK:", e.message);
    process.exit(1);
  }
  await c.end();
})().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
