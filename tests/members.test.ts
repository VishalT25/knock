import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { claimAdmin, setRole } from "@/lib/members";
import { freshWorld } from "./helpers";

let ids: Record<string, string>;
beforeEach(async () => {
  await freshWorld();
  const q = await db();
  ids = Object.fromEntries((await q("SELECT id, name FROM users")).map((u) => [u.name, u.id]));
});
const roleOf = async (name: string) => (await (await db())("SELECT role FROM users WHERE id = $1", [ids[name]]))[0].role;

describe("promoting and demoting members", () => {
  it("lets an admin make someone else an admin", async () => {
    const r = await setRole({ id: ids.Ana }, ids.Ben, "admin");
    expect(r).toMatchObject({ name: "Ben", role: "admin" });
    expect(await roleOf("Ben")).toBe("admin");
  });
  it("lets an admin take admin away from someone else", async () => {
    await setRole({ id: ids.Ana }, ids.Ben, "admin");
    await setRole({ id: ids.Ben }, ids.Ana, "member"); // the new admin can demote the original one
    expect(await roleOf("Ana")).toBe("member");
    expect(await roleOf("Ben")).toBe("admin");
  });
  it("never lets you change your own role, so someone is always an admin", async () => {
    await expect(setRole({ id: ids.Ana }, ids.Ana, "member")).rejects.toMatchObject({ status: 400 });
    expect(await roleOf("Ana")).toBe("admin");
  });
  it("rejects unknown roles and unknown people", async () => {
    await expect(setRole({ id: ids.Ana }, ids.Ben, "owner")).rejects.toMatchObject({ status: 400 });
    await expect(setRole({ id: ids.Ana }, "00000000-0000-0000-0000-000000000000", "admin")).rejects.toMatchObject({ status: 404 });
    expect(await roleOf("Ben")).toBe("member");
  });
});

describe("claiming admin with the setup password", () => {
  it("makes the caller an admin when the password matches", async () => {
    await claimAdmin({ id: ids.Cy }, "long-secret", "long-secret");
    expect(await roleOf("Cy")).toBe("admin");
  });
  it("refuses a wrong or missing password and changes nothing", async () => {
    await expect(claimAdmin({ id: ids.Cy }, "nope", "long-secret")).rejects.toMatchObject({ status: 403 });
    await expect(claimAdmin({ id: ids.Cy }, undefined, "long-secret")).rejects.toMatchObject({ status: 403 });
    expect(await roleOf("Cy")).toBe("member");
  });
  it("refuses everything when the server has no setup password", async () => {
    await expect(claimAdmin({ id: ids.Cy }, "", undefined)).rejects.toMatchObject({ status: 400 });
    expect(await roleOf("Cy")).toBe("member");
  });
});
