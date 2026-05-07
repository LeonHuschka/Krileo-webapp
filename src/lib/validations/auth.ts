import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

export const signupSchema = z.object({
  fullName: z.string().min(1, "Name ist erforderlich").max(100),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

export const magicLinkSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type MagicLinkFormData = z.infer<typeof magicLinkSchema>;
