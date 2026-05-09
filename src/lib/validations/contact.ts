import { z } from "zod";

const CONTACT_STATUSES = [
  "cold",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

export const contactCreateSchema = z.object({
  name: z.string().min(1, "Name erforderlich").max(200),
  company: z.string().max(200).optional().nullable(),
  email: z
    .string()
    .email("Ungültige E-Mail")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: z.string().max(50).optional().nullable(),
  status: z.enum(CONTACT_STATUSES),
  tags: z.array(z.string().min(1)),
  source: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  demo_url: z
    .string()
    .url("Ungültige URL")
    .max(500)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
});

export const contactUpdateSchema = contactCreateSchema.partial().extend({
  last_contacted_at: z.string().optional().nullable(),
});

export type ContactCreateData = z.infer<typeof contactCreateSchema>;
export type ContactUpdateData = z.infer<typeof contactUpdateSchema>;
