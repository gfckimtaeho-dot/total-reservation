import { PrismaClient } from "@/generated/prisma-hotel/client";
import { PrismaPg } from "@prisma/adapter-pg";

// 호텔 DB 전용 lazy singleton. 헬스장 admin 의 createInvite / emailInvite /
// revokeInvite / cleanupExpiredInvites 가 호텔 InviteToken row 를 직접 read/write.
// 호텔 schema 의 audit 컬럼 (createdById/updatedById) 은 nullable - 헬스장 admin
// User id 는 호텔 DB 의 User 테이블에 존재 안 하므로 stamping extension 안 붙임 (NULL 유지).

const globalForHotelDb = globalThis as unknown as {
  hotelDbBase: PrismaClient | undefined;
};

function makeClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.HOTEL_DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const base = globalForHotelDb.hotelDbBase ?? makeClient();
if (process.env.NODE_ENV !== "production") {
  globalForHotelDb.hotelDbBase = base;
}

export const hotelDb = base;
