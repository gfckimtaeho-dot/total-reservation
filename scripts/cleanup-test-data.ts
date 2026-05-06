import "dotenv/config";
import { prisma } from "../src/lib/db/client";

async function main() {
  console.log("=== BEFORE CLEANUP ===");
  const beforeBusinesses = await prisma.business.findMany({
    select: {
      slug: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          users: true,
          staff: true,
          reservations: true,
          memberships: true,
        },
      },
    },
  });
  const beforeInvites = await prisma.inviteToken.count();
  const beforeAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", gymId: null },
    select: { email: true, status: true },
  });
  const beforeUsers = await prisma.user.count();
  const beforeSessions = await prisma.session.count();

  console.log("Businesses:", JSON.stringify(beforeBusinesses, null, 2));
  console.log("Invite tokens:", beforeInvites);
  console.log("Admin users (preserved):", beforeAdmins);
  console.log("Total users:", beforeUsers);
  console.log("Total sessions:", beforeSessions);

  if (beforeAdmins.length === 0) {
    console.error(
      "\n⚠ ABORT: No admin user found. Cleanup would lock you out. Aborting.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n=== EXECUTING CLEANUP ===");

  // 1. InviteToken: optional FK to Business (createdBusinessId). Wipe first
  //    so no FK conflicts when deleting businesses.
  const invitesDeleted = await prisma.inviteToken.deleteMany();
  console.log(`InviteToken deleted: ${invitesDeleted.count}`);

  // 2. Business: cascades to User(gymId set), Staff, Service, BusinessHours,
  //    BusinessImage, Membership, Package, Reservation, ReservationLog,
  //    QrToken, AccessLog, TrustScore, TrustEvent, UserDeletion,
  //    BusinessNotificationSetting, NotificationLog, Subscription, Payment,
  //    MagicLinkToken(gymId set). Cascading User deletion further cascades to
  //    Session, Account, etc.
  const businessesDeleted = await prisma.business.deleteMany();
  console.log(`Business deleted: ${businessesDeleted.count}`);

  // 3. Defensive: any orphan user with gymId not null shouldn't exist after
  //    Business cascade, but admins (gymId null) MUST remain.
  const orphanUsers = await prisma.user.deleteMany({
    where: { gymId: { not: null } },
  });
  console.log(`Orphan users cleaned (should be 0): ${orphanUsers.count}`);

  console.log("\n=== AFTER CLEANUP ===");
  const afterBusinesses = await prisma.business.count();
  const afterInvites = await prisma.inviteToken.count();
  const afterUsers = await prisma.user.findMany({
    select: { email: true, role: true, gymId: true, status: true },
  });
  const afterSessions = await prisma.session.count();
  const afterReservations = await prisma.reservation.count();
  const afterStaff = await prisma.staff.count();
  const afterMemberships = await prisma.membership.count();

  console.log("Businesses:", afterBusinesses);
  console.log("Invite tokens:", afterInvites);
  console.log("Users (should be admin only):", afterUsers);
  console.log("Sessions:", afterSessions);
  console.log("Reservations:", afterReservations);
  console.log("Staff:", afterStaff);
  console.log("Memberships:", afterMemberships);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
