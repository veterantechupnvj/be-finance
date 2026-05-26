import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import {
  divisions,
  finCategories,
  memberRoles,
  members,
  roles,
  staffMembers,
  staffPeriods,
  users,
} from "../db/schema";
import { hashPassword } from "../lib/auth";

async function getOrCreateRole(name: string, permissions: Record<string, string[]>) {
  const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(roles).values({ name, permissions }).returning();
  return created;
}

async function getOrCreateMember(input: {
  nim: string;
  name: string;
  cohortYear: number;
  memberType: "member" | "staff" | "alumni";
}) {
  const [existing] = await db.select().from(members).where(eq(members.nim, input.nim)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(members).values(input).returning();
  return created;
}

async function getOrCreateUser(
  memberId: string,
  nim: string,
  password: string,
  mustChangePassword: boolean,
) {
  const [existing] = await db.select().from(users).where(eq(users.memberId, memberId)).limit(1);
  const passwordHash = await hashPassword(password);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        username: nim,
        passwordHash,
        mustChangePassword,
        isActive: true,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      memberId,
      username: nim,
      passwordHash,
      mustChangePassword,
      isActive: true,
    })
    .returning();

  return created;
}

async function ensureMemberRole(memberId: string, roleId: string) {
  const [existing] = await db
    .select()
    .from(memberRoles)
    .where(eq(memberRoles.memberId, memberId))
    .limit(1);

  if (!existing) {
    await db.insert(memberRoles).values({ memberId, roleId });
  }
}

async function getOrCreateDivision(name: string) {
  const [existing] = await db.select().from(divisions).where(eq(divisions.name, name)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(divisions).values({ name, isActive: true }).returning();
  return created;
}

async function getOrCreateActiveStaffPeriod() {
  const [existing] = await db
    .select()
    .from(staffPeriods)
    .where(eq(staffPeriods.isActive, true))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(staffPeriods)
    .values({
      name: "Staff 2026/2027",
      startDate: "2026-01-01",
      endDate: null,
      isActive: true,
    })
    .returning();
  return created;
}

async function ensureStaffAssignment(memberId: string, staffId: string, divisionId: string) {
  const [existing] = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.memberId, memberId))
    .limit(1);
  if (!existing) {
    await db.insert(staffMembers).values({
      memberId,
      staffId,
      divisionId,
      position: "staff",
    });
  }
}

async function ensureCategory(name: string, type: "income" | "expense") {
  const [existing] = await db
    .select()
    .from(finCategories)
    .where(eq(finCategories.name, name))
    .limit(1);
  if (!existing) {
    await db.insert(finCategories).values({ name, type, isActive: true });
  }
}

async function main() {
  const financeRole = await getOrCreateRole("finance", {
    finance: ["read", "write"],
    members: ["read"],
  });
  const memberRole = await getOrCreateRole("member", {
    finance: ["read"],
  });

  const financeMember = await getOrCreateMember({
    nim: "2310512999",
    name: "Finance Tester",
    cohortYear: 2023,
    memberType: "staff",
  });
  const regularMember = await getOrCreateMember({
    nim: "2310512888",
    name: "Member Tester",
    cohortYear: 2023,
    memberType: "member",
  });

  await getOrCreateUser(financeMember.id, financeMember.nim, "finance123", false);
  await getOrCreateUser(regularMember.id, regularMember.nim, "member123", false);

  await ensureMemberRole(financeMember.id, financeRole.id);
  await ensureMemberRole(regularMember.id, memberRole.id);

  const financeDivision = await getOrCreateDivision("Finance");
  const activeStaffPeriod = await getOrCreateActiveStaffPeriod();
  await ensureStaffAssignment(financeMember.id, activeStaffPeriod.id, financeDivision.id);

  await ensureCategory("MemberDues", "income");
  await ensureCategory("Merchandise", "income");
  await ensureCategory("Consumables", "expense");

  console.log("Dev seed ready.");
  console.log("finance login:", { nim: financeMember.nim, password: "finance123" });
  console.log("member login:", { nim: regularMember.nim, password: "member123" });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
