import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { currentActorId } from "@/lib/audit/actor";

// Prisma 7 requires explicit driver adapter. PrismaPg wraps node-postgres (pg).
// Connection string comes from DATABASE_URL via prisma.config.ts (loaded by dotenv).

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

function makeClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const base = globalForPrisma.prismaBase ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = base;
}

// 감사 자동 스탬프: 모든 모델의 쓰기에서 createdById/updatedById 를
// "현재 로그인 계정"으로 채운다. createdAt 은 @default(now()), updatedAt 은
// @updatedAt 가 처리하므로 여기서 건드리지 않는다. 호출 코드는 무수정.
// 명시적으로 넘긴 값이 있으면 보존한다. 인터랙티브 $transaction 콜백 안의
// 쓰기에도 동일 적용된다(확장은 트랜잭션 내부에서도 동작). args 객체를
// 그 자리에서 변형 → Prisma 입력 타입과의 캐스팅 충돌을 피한다.
type Data = Record<string, unknown>;

function stampCreate(data: unknown, actor: string): void {
  const d = data as Data | undefined;
  if (!d) return;
  if (d.createdById == null) d.createdById = actor;
  if (d.updatedById == null) d.updatedById = actor;
}

function stampUpdate(data: unknown, actor: string): void {
  const d = data as Data | undefined;
  if (!d) return;
  d.updatedById = actor;
}

export const prisma = base.$extends({
  query: {
    $allModels: {
      async create({ args, query }) {
        const actor = await currentActorId();
        if (actor) stampCreate(args.data, actor);
        return query(args);
      },
      async update({ args, query }) {
        const actor = await currentActorId();
        if (actor) stampUpdate(args.data, actor);
        return query(args);
      },
      async upsert({ args, query }) {
        const actor = await currentActorId();
        if (actor) {
          stampCreate(args.create, actor);
          stampUpdate(args.update, actor);
        }
        return query(args);
      },
      async createMany({ args, query }) {
        const actor = await currentActorId();
        if (actor && args.data) {
          if (Array.isArray(args.data)) {
            for (const row of args.data) stampCreate(row, actor);
          } else {
            stampCreate(args.data, actor);
          }
        }
        return query(args);
      },
      async updateMany({ args, query }) {
        const actor = await currentActorId();
        if (actor) stampUpdate(args.data, actor);
        return query(args);
      },
    },
  },
});
