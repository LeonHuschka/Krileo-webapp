import { z } from "zod";

const ORDER_STATUSES = [
  "angebot",
  "aktiv",
  "review",
  "geliefert",
  "archiv",
] as const;
const ORDER_TYPES = ["website", "website_plus", "automation", "other"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

export const orderCreateSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  client_name: z.string().max(200).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  order_type: z.enum(ORDER_TYPES),
  status: z.enum(ORDER_STATUSES),
  priority: z.enum(PRIORITIES),
  value_cents: z.number().int().min(0).optional().nullable(),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  work_url: z.string().url().max(2000).optional().nullable().or(z.literal("")),
});

// tech_brief / review are structured JSON managed by their own flows, not the
// generic form. Accept them as loose passthrough so updateOrder can persist them.
export const orderUpdateSchema = orderCreateSchema.partial().extend({
  tech_brief: z.any().optional().nullable(),
  review: z.any().optional().nullable(),
  preview_desktop_url: z.string().max(2000).optional().nullable(),
  preview_mobile_url: z.string().max(2000).optional().nullable(),
});

export type OrderCreateData = z.infer<typeof orderCreateSchema>;
export type OrderUpdateData = z.infer<typeof orderUpdateSchema>;
