import { z } from "zod";

export const toolCreateSchema = z.object({
  name: z.string().min(1, "Name erforderlich").max(200),
  category: z.string().max(100).optional().nullable(),
  url: z
    .string()
    .url("Ungültige URL")
    .max(500)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  login_email: z.string().max(200).optional().nullable(),
  login_username: z.string().max(200).optional().nullable(),
  login_password: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const toolUpdateSchema = toolCreateSchema.partial();

export type ToolCreateData = z.infer<typeof toolCreateSchema>;
export type ToolUpdateData = z.infer<typeof toolUpdateSchema>;
