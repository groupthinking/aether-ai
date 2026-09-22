
import { z } from 'zod';

export const SceneSchema = z.object({
  index: z.number(),
  timecode: z.string(),
  seconds: z.number(),
  title: z.string(),
  summary: z.string(),
  thumbnailUrl: z.string().optional(),
});

export const AnalyzeResponseSchema = z.object({
  sourceType: z.enum(['video', 'image', 'url']),
  title: z.string(),
  durationSeconds: z.number().optional(),
  scenes: z.array(SceneSchema),
});

export type Scene = z.infer<typeof SceneSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
