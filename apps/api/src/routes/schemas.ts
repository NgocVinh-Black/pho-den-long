import { z } from 'zod';
import { AVATAR_OPTIONS, RULES } from '@pdl/shared';

export const PlayerParams = z.object({ id: z.string().uuid('Mã người chơi không hợp lệ') });

export const AvatarSchema = z.object({
  skin: z.enum(AVATAR_OPTIONS.skin),
  shirt: z.enum(AVATAR_OPTIONS.shirt),
  hat: z.enum(AVATAR_OPTIONS.hat),
});

export const CreatePlayerBody = z.object({
  name: z.string().trim().min(1, 'Hãy nhập tên chủ quán').max(RULES.maxNameLength),
  shopId: z.string().min(1),
  avatar: AvatarSchema.optional(),
});

export const BuyBody = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), qty: z.number().int().min(1).max(999) }))
    .min(1, 'Giỏ hàng trống')
    .max(100),
  mode: z.enum(['carry', 'delivery']).default('carry'),
});

export const ReceiveBody = z
  .object({
    shipmentId: z.string().uuid().optional(),
    mode: z.enum(['carry', 'delivery']).optional(),
  })
  .refine((b) => b.shipmentId || b.mode, 'Cần shipmentId hoặc mode');

export const ServeBody = z.object({
  recipeId: z.string().min(1),
  quality: z.number().min(0).max(1),
  customerType: z.enum(['local', 'student', 'tourist', 'critic', 'reviewer']).default('local'),
  cookedBy: z.enum(['player', 'staff']).default('player'),
});

export const LearnBody = z.object({ recipeId: z.string().min(1) });

export const UpgradeBody = z.object({ type: z.enum(['shop', 'decor']) });

export const LeaderboardQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export const GoogleLoginBody = z.object({ credential: z.string().min(20).max(4096) });

export const FurnitureBody = z.object({ itemId: z.string().min(1) });

export const AdBody = z.object({ planId: z.string().min(1).max(20) });

export const NoteParams = z.object({ id: z.string().uuid(), noteId: z.string().uuid() });

const NoteItemSchema = z.object({
  text: z.string().trim().max(80),
  ingredientId: z.string().max(40).optional(),
  qty: z.number().int().min(1).max(999).optional(),
  done: z.boolean().default(false),
});

export const CreateNoteBody = z.object({
  title: z.string().trim().min(1, 'Ghi chú cần tiêu đề').max(60),
  items: z.array(NoteItemSchema).max(60).default([]),
  pinned: z.boolean().optional(),
});

export const UpdateNoteBody = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  items: z.array(NoteItemSchema).max(60).optional(),
  pinned: z.boolean().optional(),
});

export const HireBody = z.object({ role: z.enum(['waiter', 'cook']) });
export const StaffParams = z.object({ id: z.string().uuid(), staffId: z.string().uuid() });
