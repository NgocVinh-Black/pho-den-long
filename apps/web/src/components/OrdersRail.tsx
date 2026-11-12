import { useEffect, useState } from 'react';
import { interiorStyle, seatName, type InteriorStyle } from '@pdl/shared';
import { worldHost } from '../game/worldHost';
import { useGame } from '../store/game';

interface Row {
  id: number;
  icon: string;
  name: string;
  table: number;
  status: string;
  cls: string;
}

const statusOf = (st: InteriorStyle): Record<string, [string, string]> => ({
  queued: [`Chờ ${st.make.toLowerCase()}`, 'wait'],
  cooking: [`Đang ${st.make.toLowerCase()}`, 'cook'],
  ready: [`Xong · chờ ${st.serve.toLowerCase()}`, 'ready'],
  carried: [`Đang ${st.serve.toLowerCase()} ra`, 'carry'],
});

/** Bảng phiếu order góc phải màn hình khi quán mở cửa. */
export function OrdersRail() {
  const screen = useGame((s) => s.screen);
  const dayPhase = useGame((s) => s.dayPhase);
  const panel = useGame((s) => s.panel);
  const cooking = useGame((s) => s.cooking);
  const [rows, setRows] = useState<Row[]>([]);
  const [waving, setWaving] = useState(0);
  const style = interiorStyle(useGame((s) => s.shop?.interior));

  useEffect(() => {
    const t = setInterval(() => {
      const sv = worldHost.get()?.service;
      if (!sv) return;
      const STATUS = statusOf(style);
      setRows(
        sv.orders.map((o) => ({
          id: o.id,
          icon: o.recipe.icon,
          name: o.recipe.name,
          table: Math.floor(o.seat / 2) + 1,
          status:
            (STATUS[o.status]?.[0] ?? o.status) +
            (o.by === 'cook' ? ' (phụ bếp)' : o.by?.startsWith('waiter') ? ' (phục vụ)' : ''),
          cls: STATUS[o.status]?.[1] ?? '',
        })),
      );
      setWaving(sv.diners.filter((d) => d.state === 'seated').length);
    }, 300);
    return () => clearInterval(t);
  }, [style]);

  if (screen !== 'play' || dayPhase !== 'open' || panel || cooking) return null;
  if (rows.length === 0 && waving === 0) return null;
  return (
    <div className="orders-rail">
      <div className="or-title">📝 Phiếu {style.order}</div>
      {waving > 0 && (
        <div className="or-row wave">
          ✋ {waving} {style.seat} đang chờ {style.takeOrder.toLowerCase()}
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className={`or-row ${r.cls}`}>
          <span>
            {r.icon} {seatName(style, r.table)}
          </span>
          <small>{r.status}</small>
        </div>
      ))}
    </div>
  );
}
