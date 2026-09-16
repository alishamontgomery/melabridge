import { z } from "zod";

export const NEW_PASSWORD_MINIMUM = 12;

export const emailSchema = z.string().trim().email("Enter a valid email").max(255);
export const newPasswordSchema = z
  .string()
  .min(NEW_PASSWORD_MINIMUM, `Use at least ${NEW_PASSWORD_MINIMUM} characters`)
  .max(128);

export type SignupField = "name" | "email" | "password";
export type SignupFieldErrors = Partial<Record<SignupField, string>>;

export function validateSignupFields(values: {
  name: string;
  email: string;
  password: string;
}): SignupFieldErrors {
  const errors: SignupFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = "Enter your name.";
  }

  const emailResult = emailSchema.safeParse(values.email);
  if (!emailResult.success) {
    errors.email = "Enter a valid email address.";
  }

  const passwordResult = newPasswordSchema.safeParse(values.password);
  if (!passwordResult.success) {
    errors.password =
      values.password.length < NEW_PASSWORD_MINIMUM
        ? `Use at least ${NEW_PASSWORD_MINIMUM} characters.`
        : "Use a password no longer than 128 characters.";
  }

  return errors;
}