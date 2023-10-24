import { z } from "zod";

export const createPostInputSchema = z.object({
  title: z.string().min(1),
});
