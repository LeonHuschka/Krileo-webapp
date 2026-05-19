import { z } from "zod";

const BILLING_CYCLES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "one_time",
] as const;

const STATUSES = ["active", "paused", "cancelled"] as const;

export const expenseCreateSchema = z.object({
  name: z.string().min(1, "Name erforderlich").max(200),
  vendor: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  amount_cents: z.number().int().min(0).max(1_000_000_00 * 1000),
  billing_cycle: z.enum(BILLING_CYCLES),
  status: z.enum(STATUSES),
  next_billing_date: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  url: z
    .string()
    .url("Ungültige URL")
    .max(500)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  notes: z.string().max(5000).optional().nullable(),
});

export const expenseUpdateSchema = expenseCreateSchema.partial();

export type ExpenseCreateData = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateData = z.infer<typeof expenseUpdateSchema>;
