import { useState } from 'react';
import { useGame } from '../store/game';

/** Tờ ghi chú ghim ở góc màn hình khi đang đi lại (đi chợ vừa xem vừa đánh dấu). */
export function PinnedNote() {
  const screen = useGame((s) => s.screen);
  const panel = useGame((s) => s.panel);
  const cooking = useGame((s) => s.cooking);
  const notes = useGame((s) => s.notes);
  const catalog = useGame((s) => s.catalog);
  const ingredients = useGame((s) => s.ingredients);
  const toggle = useGame((s) => s.toggleNoteItem);
  const openNotes = useGame((s) => s.openNotes);
  const [collapsed, setCollapsed] = useState(false);
  const note = notes.find((n) => n.pinned);
  if (screen !== 'play' || panel || cooking || !note) return null;

  const left = note.items.filter((i) => !i.done).length;
  return (
    <div className={`sticky-note ${collapsed ? 'collapsed' : ''}`}>
      <div className="sn-head">
        <b title={note.title}>📌 {note.title}</b>
        <span>
          <button onClick={openNotes} title="Mở sổ tay (N)">
            📒
          </button>
          <button onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Mở' : 'Thu gọn'}>
            {collapsed ? '▾' : '▴'}
          </button>
        </span>
      </div>
      {!collapsed && (
        <ul>
          {note.items.map((it, i) => {
            const ing = it.ingredientId ? ingredients.get(it.ingredientId) : undefined;
            const sec = ing && catalog?.marketSections.find((s) => s.id === ing.section);
            return (
              <li key={i} className={it.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={it.done} onChange={() => toggle(note.id, i)} />
                  <span>
                    {ing?.icon} {it.text}
                    {it.qty ? ` ×${it.qty}` : ''}
                  </span>
                </label>
                {sec && !it.done && <small title={sec.name}>{sec.icon}</small>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="sn-foot">{left ? `Còn ${left} món chưa mua` : '✅ Đã mua đủ!'}</div>
    </div>
  );
}
