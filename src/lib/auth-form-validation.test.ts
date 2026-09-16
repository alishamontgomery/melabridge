import { describe, expect, it } from "vitest";
import {
  NEW_PASSWORD_MINIMUM,
  validateSignupFields,
} from "./auth-form-validation";

describe("signup form validation", () => {
  const valid = {
    name: "Planner Example",
    email: "planner@example.com",
    password: "a-secure-password",
  };

  it("accepts manually entered valid signup values", () => {
    expect(validateSignupFields(valid)).toEqual({});
  });

  it("reports each missing or invalid field independently", () => {
    const errors = validateSignupFields({
      name: " ",
      email: "not-an-email",
      password: "too-short",
    });

    expect(errors).toEqual({
      name: "Enter your name.",
      email: "Enter a valid email address.",
      password: `Use at least ${NEW_PASSWORD_MINIMUM} characters.`,
    });
  });

  it("keeps the 12-character password boundary", () => {
    expect(
      validateSignupFields({ ...valid, password: "12345678901" }).password,
    ).toBe(`Use at least ${NEW_PASSWORD_MINIMUM} characters.`);
    expect(
      validateSignupFields({ ...valid, password: "123456789012" }),
    ).toEqual({});
  });
});