// Seed script — PSGC stub (NCR 17 cities + key non-NCR cities + a few barangays
// per city) and the admin user (from ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD env).
// Idempotent: re-running updates rows by their natural key (psgcCode, email).
//
// PSGC codes here are stub-shaped (numeric, unique) — real PSA codes will land
// when V1 ships, replacing this minimal seed via the same upsert path.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type CitySeed = {
  psgcCode: string;
  name: string;
  barangays: { psgcCode: string; name: string }[];
};

const CITIES: CitySeed[] = [
  // ── NCR (Metro Manila) — 17 cities/municipality
  { psgcCode: "13806", name: "Manila", barangays: [
    { psgcCode: "13806001", name: "Binondo" },
    { psgcCode: "13806002", name: "Ermita" },
    { psgcCode: "13806003", name: "Malate" },
    { psgcCode: "13806004", name: "Tondo" },
  ]},
  { psgcCode: "13807", name: "Quezon City", barangays: [
    { psgcCode: "13807001", name: "Diliman" },
    { psgcCode: "13807002", name: "Bagong Pag-asa" },
    { psgcCode: "13807003", name: "Cubao" },
    { psgcCode: "13807004", name: "Novaliches" },
  ]},
  { psgcCode: "13804", name: "Makati", barangays: [
    { psgcCode: "13804001", name: "Bel-Air" },
    { psgcCode: "13804002", name: "Poblacion" },
    { psgcCode: "13804003", name: "Salcedo Village" },
  ]},
  { psgcCode: "13808", name: "Pasig", barangays: [
    { psgcCode: "13808001", name: "Kapitolyo" },
    { psgcCode: "13808002", name: "Ortigas Center" },
    { psgcCode: "13808003", name: "San Antonio" },
  ]},
  { psgcCode: "13809", name: "Taguig", barangays: [
    { psgcCode: "13809001", name: "Bonifacio Global City" },
    { psgcCode: "13809002", name: "McKinley Hill" },
    { psgcCode: "13809003", name: "Western Bicutan" },
  ]},
  { psgcCode: "13810", name: "Mandaluyong", barangays: [
    { psgcCode: "13810001", name: "Wack-Wack" },
    { psgcCode: "13810002", name: "Plainview" },
    { psgcCode: "13810003", name: "Highway Hills" },
  ]},
  { psgcCode: "13811", name: "Caloocan", barangays: [
    { psgcCode: "13811001", name: "Bagong Silang" },
    { psgcCode: "13811002", name: "Camarin" },
    { psgcCode: "13811003", name: "Grace Park" },
  ]},
  { psgcCode: "13812", name: "Pasay", barangays: [
    { psgcCode: "13812001", name: "Barangay 76" },
    { psgcCode: "13812002", name: "Barangay 183" },
    { psgcCode: "13812003", name: "Barangay 201" },
  ]},
  { psgcCode: "13813", name: "Parañaque", barangays: [
    { psgcCode: "13813001", name: "BF Homes" },
    { psgcCode: "13813002", name: "San Antonio" },
    { psgcCode: "13813003", name: "Tambo" },
  ]},
  { psgcCode: "13814", name: "Las Piñas", barangays: [
    { psgcCode: "13814001", name: "Almanza Uno" },
    { psgcCode: "13814002", name: "Pamplona Tres" },
    { psgcCode: "13814003", name: "Talon Uno" },
  ]},
  { psgcCode: "13815", name: "Muntinlupa", barangays: [
    { psgcCode: "13815001", name: "Alabang" },
    { psgcCode: "13815002", name: "Ayala Alabang" },
    { psgcCode: "13815003", name: "Putatan" },
  ]},
  { psgcCode: "13816", name: "Marikina", barangays: [
    { psgcCode: "13816001", name: "Concepcion Uno" },
    { psgcCode: "13816002", name: "San Roque" },
    { psgcCode: "13816003", name: "Marikina Heights" },
  ]},
  { psgcCode: "13817", name: "Valenzuela", barangays: [
    { psgcCode: "13817001", name: "Marulas" },
    { psgcCode: "13817002", name: "Karuhatan" },
    { psgcCode: "13817003", name: "Malinta" },
  ]},
  { psgcCode: "13818", name: "San Juan", barangays: [
    { psgcCode: "13818001", name: "Greenhills" },
    { psgcCode: "13818002", name: "Salapan" },
    { psgcCode: "13818003", name: "West Crame" },
  ]},
  { psgcCode: "13819", name: "Malabon", barangays: [
    { psgcCode: "13819001", name: "Acacia" },
    { psgcCode: "13819002", name: "Concepcion" },
    { psgcCode: "13819003", name: "Tinajeros" },
  ]},
  { psgcCode: "13820", name: "Navotas", barangays: [
    { psgcCode: "13820001", name: "Bagumbayan North" },
    { psgcCode: "13820002", name: "San Roque" },
    { psgcCode: "13820003", name: "Tanza" },
  ]},
  { psgcCode: "13821", name: "Pateros", barangays: [
    { psgcCode: "13821001", name: "San Pedro" },
    { psgcCode: "13821002", name: "San Roque" },
  ]},
  // ── Major cities outside NCR
  { psgcCode: "07217", name: "Cebu City", barangays: [
    { psgcCode: "07217001", name: "Lahug" },
    { psgcCode: "07217002", name: "Mabolo" },
    { psgcCode: "07217003", name: "Banilad" },
  ]},
  { psgcCode: "11231", name: "Davao City", barangays: [
    { psgcCode: "11231001", name: "Poblacion" },
    { psgcCode: "11231002", name: "Talomo" },
    { psgcCode: "11231003", name: "Buhangin" },
  ]},
  { psgcCode: "06331", name: "Iloilo City", barangays: [
    { psgcCode: "06331001", name: "Jaro" },
    { psgcCode: "06331002", name: "Mandurriao" },
    { psgcCode: "06331003", name: "Molo" },
  ]},
  { psgcCode: "14111", name: "Baguio", barangays: [
    { psgcCode: "14111001", name: "Session Road" },
    { psgcCode: "14111002", name: "Camp 7" },
    { psgcCode: "14111003", name: "Mines View" },
  ]},
  { psgcCode: "06245", name: "Bacolod", barangays: [
    { psgcCode: "06245001", name: "Mandalagan" },
    { psgcCode: "06245002", name: "Singcang" },
    { psgcCode: "06245003", name: "Villamonte" },
  ]},
  { psgcCode: "10433", name: "Cagayan de Oro", barangays: [
    { psgcCode: "10433001", name: "Carmen" },
    { psgcCode: "10433002", name: "Lapasan" },
    { psgcCode: "10433003", name: "Macasandig" },
  ]},
  { psgcCode: "09701", name: "Zamboanga", barangays: [
    { psgcCode: "09701001", name: "Tetuan" },
    { psgcCode: "09701002", name: "Tugbungan" },
    { psgcCode: "09701003", name: "Putik" },
  ]},
  { psgcCode: "12631", name: "General Santos", barangays: [
    { psgcCode: "12631001", name: "Lagao" },
    { psgcCode: "12631002", name: "Calumpang" },
    { psgcCode: "12631003", name: "Bula" },
  ]},
  { psgcCode: "03509", name: "Angeles (Clark 남부)", barangays: [
    { psgcCode: "03509001", name: "Balibago" },
    { psgcCode: "03509002", name: "Malabanias" },
    { psgcCode: "03509003", name: "Pulungbulu" },
    { psgcCode: "03509004", name: "Clark Freeport Zone (남)" },
  ]},
  { psgcCode: "03520", name: "Mabalacat (Clark 북부)", barangays: [
    { psgcCode: "03520001", name: "Dau" },
    { psgcCode: "03520002", name: "Mabiga" },
    { psgcCode: "03520003", name: "Cutcut" },
    { psgcCode: "03520004", name: "Clark Freeport Zone (북)" },
  ]},
  { psgcCode: "03714", name: "Olongapo", barangays: [
    { psgcCode: "03714001", name: "Barretto" },
    { psgcCode: "03714002", name: "East Tapinac" },
    { psgcCode: "03714003", name: "Old Cabalan" },
  ]},
];

async function seedPsgc() {
  for (const c of CITIES) {
    const city = await prisma.city.upsert({
      where: { psgcCode: c.psgcCode },
      update: { name: c.name },
      create: { psgcCode: c.psgcCode, name: c.name },
    });
    for (const b of c.barangays) {
      await prisma.barangay.upsert({
        where: { psgcCode: b.psgcCode },
        update: { name: b.name, cityId: city.id },
        create: { psgcCode: b.psgcCode, name: b.name, cityId: city.id },
      });
    }
  }
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) {
    console.log(
      "[seed] ADMIN_EMAIL or ADMIN_INITIAL_PASSWORD missing — admin user skipped.",
    );
    return;
  }
  const existing = await prisma.user.findFirst({
    where: { email, gymId: null },
  });
  const passwordHash = await bcrypt.hash(password, 10);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: "ADMIN", status: "ACTIVE" },
    });
    console.log(`[seed] Admin user refreshed: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        gymId: null,
        email,
        passwordHash,
        name: "Admin",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log(`[seed] Admin user created: ${email}`);
  }
}

async function main() {
  console.log(`[seed] PSGC stub: ${CITIES.length} cities + ${CITIES.reduce((s, c) => s + c.barangays.length, 0)} barangays...`);
  await seedPsgc();
  console.log("[seed] Admin user...");
  await seedAdmin();
  console.log("[seed] Done.");
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
