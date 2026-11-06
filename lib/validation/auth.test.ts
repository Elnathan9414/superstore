import { describe, expect, it } from "vitest";
import { createUserSchema, setActiveSchema, signInSchema, updateRoleSchema } from "./auth";
import { fieldErrors, formValues } from "./form";

const UUID = "3f2b8c1e-7a4d-4e8b-9c1a-2b3c4d5e6f70";

describe("signInSchema", () => {
  it("normalizes the email", () => {
    const result = signInSchema.parse({ email: "  Vendeur@Boutique.CM ", password: "x" });
    expect(result.email).toBe("vendeur@boutique.cm");
  });

  it("reports French messages per field", () => {
    const result = signInSchema.safeParse({ email: "pas-un-email", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        email: "Adresse email invalide.",
        password: "Le mot de passe est obligatoire.",
      });
    }
  });

  it("rejects missing fields", () => {
    expect(signInSchema.safeParse({}).success).toBe(false);
  });
});

describe("createUserSchema", () => {
  const valid = {
    fullName: "  Awa Diallo ",
    email: "awa@boutique.cm",
    password: "motdepasse1",
    role: "seller",
  };

  it("accepts a valid user and trims the name", () => {
    expect(createUserSchema.parse(valid).fullName).toBe("Awa Diallo");
  });

  it("rejects short passwords", () => {
    expect(createUserSchema.safeParse({ ...valid, password: "court" }).success).toBe(false);
  });

  it("rejects unknown roles", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });
});

describe("updateRoleSchema / setActiveSchema", () => {
  it("requires a uuid", () => {
    expect(updateRoleSchema.safeParse({ userId: "1", role: "manager" }).success).toBe(false);
    expect(updateRoleSchema.safeParse({ userId: UUID, role: "manager" }).success).toBe(true);
  });

  it("requires a real boolean", () => {
    expect(setActiveSchema.safeParse({ userId: UUID, active: "false" }).success).toBe(false);
    expect(setActiveSchema.parse({ userId: UUID, active: false }).active).toBe(false);
  });
});

describe("formValues", () => {
  it("keeps strings and ignores files or missing keys", () => {
    const fd = new FormData();
    fd.set("email", "a@b.cm");
    fd.set("file", new Blob(["x"]));
    expect(formValues(fd, ["email", "file", "missing"])).toEqual({
      email: "a@b.cm",
      file: undefined,
      missing: undefined,
    });
  });
});
