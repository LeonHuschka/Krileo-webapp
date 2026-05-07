import { z } from "zod";

export const todoCreateSchema = z.object({
  order_id: z.string().uuid(),
  title: z.string().min(1, "Titel erforderlich").max(300),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

export const todoUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  done: z.boolean().optional(),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

export type TodoCreateData = z.infer<typeof todoCreateSchema>;
export type TodoUpdateData = z.infer<typeof todoUpdateSchema>;
