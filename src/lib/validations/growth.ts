import { z } from "zod";

const GROWTH_STATUSES = [
  "ideen",
  "todo",
  "in_progress",
  "done",
  "archiv",
] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

export const subtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  done: z.boolean(),
});

export const growthCreateSchema = z.object({
  title: z.string().min(1, "Titel erforderlich").max(300),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(GROWTH_STATUSES),
  priority: z.enum(PRIORITIES),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().min(1)),
  subtasks: z.array(subtaskSchema).optional(),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

export const growthUpdateSchema = growthCreateSchema.partial();

export type GrowthCreateData = z.infer<typeof growthCreateSchema>;
export type GrowthUpdateData = z.infer<typeof growthUpdateSchema>;
