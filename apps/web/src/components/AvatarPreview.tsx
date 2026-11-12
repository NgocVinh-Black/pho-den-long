import { useEffect, useRef } from 'react';
import type { Avatar } from '@pdl/shared';
import { drawAvatar } from '../game/draw';

/** Xem trước nhân vật (đi tại chỗ). */
export function AvatarPreview({
  avatar,
  name,
  size = 120,
}: {
  avatar: Avatar;
  name?: string;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const loop = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const facing = Math.sin(t / 1600) > 0 ? 1 : -1;
      drawAvatar(ctx, canvas.width / 2, canvas.height - 10, avatar, {
        phase: t / 80,
        walking: true,
        facing,
        scale: canvas.height / 120,
        name: name || undefined,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [avatar, name]);

  return <canvas ref={ref} width={size * 1.4} height={size} className="avatar-preview" aria-hidden />;
}
