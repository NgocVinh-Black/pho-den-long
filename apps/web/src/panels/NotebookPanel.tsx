import { useState } from 'react';
import type { Note, NoteItem } from '@pdl/shared';
import { Overlay } from '../components/Overlay';
import { learnedRecipes, useGame } from '../store/game';

/** Sổ tay đi chợ: nhiều trang ghi chú, tạo danh sách từ công thức, ghim lên màn hình. */
export function NotebookPanel() {
  const notes = useGame((s) => s.notes);
  const closePanel = useGame((s) => s.closePanel);
  const createNote = useGame((s) => s.createNote);
  const [selected, setSelected] = useState<string | null>(
    () => notes.find((n) => n.pinned)?.id ?? notes[0]?.id ?? null,
  );
  const [mode, setMode] = useState<'edit' | 'generate'>(notes.length ? 'edit' : 'generate');
  const note = notes.find((n) => n.id === selected) ?? null;

  const newPage = async () => {
    const n = await createNote(`Trang ${notes.length + 1}`, []);
    if (n) {
      setSelected(n.id);
      setMode('edit');
    }
  };

  return (
    <Overlay wide>
      <div className="choose-head">
        <h2>📒 Sổ tay đi chợ</h2>
        <button className="btn small" onClick={closePanel}>
          ✕ Gấp sổ
        </button>
      </div>
      <div className="notebook">
        <aside className="nb-pages">
          <button
            className={`btn small ${mode === 'generate' ? 'primary' : ''}`}
            onClick={() => setMode('generate')}
          >
            ✨ Lập danh sách từ công thức
          </button>
          <button className="btn small" onClick={() => void newPage()}>
            ＋ Trang trắng
          </button>
          {notes.map((n) => {
            const done = n.items.filter((i) => i.done).length;
            return (
              <button
                key={n.id}
                className={`nb-page ${n.id === selected && mode === 'edit' ? 'on' : ''}`}
                onClick={() => {
                  setSelected(n.id);
                  setMode('edit');
                }}
              >
                <b>
                  {n.pinned ? '📌 ' : ''}
                  {n.title}
                </b>
                <small>
                  {done}/{n.items.length} đã mua
                </small>
              </button>
            );
          })}
          {notes.length === 0 && <small className="muted">Sổ còn trống.</small>}
        </aside>
        <section className="nb-paper">
          {mode === 'generate' ? (
            <Generator
              onCreated={(id) => {
                setSelected(id);
                setMode('edit');
              }}
            />
          ) : note ? (
            <NoteEditor key={note.id} note={note} />
          ) : (
            <p className="muted">Chọn một trang hoặc tạo trang mới.</p>
          )}
        </section>
      </div>
    </Overlay>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const catalog = useGame((s) => s.catalog);
  const ingredients = useGame((s) => s.ingredients);
  const updateNote = useGame((s) => s.updateNote);
  const deleteNote = useGame((s) => s.deleteNote);
  const toggle = useGame((s) => s.toggleNoteItem);
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState('');
  const [qty, setQty] = useState(1);

  const secOf = (ingId?: string) => {
    const ing = ingId ? ingredients.get(ingId) : undefined;
    return ing ? catalog?.marketSections.find((s) => s.id === ing.section) : undefined;
  };

  const addItem = () => {
    const t = text.trim();
    if (!t) return;
    const match = catalog?.ingredients.find((i) => i.name.toLowerCase() === t.toLowerCase());
    const item: NoteItem = match
      ? { text: match.name, ingredientId: match.id, qty, done: false }
      : { text: t, qty: qty > 1 ? qty : undefined, done: false };
    void updateNote(note.id, { items: [...note.items, item] });
    setText('');
    setQty(1);
  };

  const setItems = (items: NoteItem[]) => void updateNote(note.id, { items });

  return (
    <>
      <div className="nb-title">
        <input
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() =>
            title.trim() && title !== note.title && void updateNote(note.id, { title: title.trim() })
          }
          aria-label="Tiêu đề trang"
        />
        <button
          className={`btn small ${note.pinned ? 'primary' : ''}`}
          onClick={() => void updateNote(note.id, { pinned: !note.pinned })}
        >
          📌 {note.pinned ? 'Đang ghim' : 'Ghim lên màn hình'}
        </button>
        <button
          className="btn small"
          onClick={() => {
            if (confirm(`Xóa trang "${note.title}"?`)) void deleteNote(note.id);
          }}
        >
          🗑️
        </button>
      </div>
      <ul className="nb-items">
        {note.items.map((it, i) => {
          const sec = secOf(it.ingredientId);
          return (
            <li key={i} className={it.done ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={it.done} onChange={() => toggle(note.id, i)} />
                {it.ingredientId && ingredients.get(it.ingredientId)?.icon} {it.text}
                {it.qty ? <b> ×{it.qty}</b> : null}
              </label>
              {sec && (
                <small className="nb-sec" style={{ borderColor: sec.color }}>
                  {sec.icon} {sec.name}
                </small>
              )}
              <button
                className="nb-x"
                onClick={() => setItems(note.items.filter((_, k) => k !== i))}
                aria-label="Xóa dòng"
              >
                ✕
              </button>
            </li>
          );
        })}
        {note.items.length === 0 && <li className="muted">Trang trống. Thêm món cần mua ở dưới.</li>}
      </ul>
      <div className="nb-add">
        <input
          list="pdl-ingredients"
          placeholder="Thêm món: gõ tên nguyên liệu (vd: Thịt bò) hoặc ghi chú bất kỳ"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <input
          type="number"
          min={1}
          max={999}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          aria-label="Số lượng"
        />
        <button className="btn small primary" onClick={addItem}>
          Thêm
        </button>
        <datalist id="pdl-ingredients">
          {catalog?.ingredients.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
      </div>
      {note.items.some((i) => i.done) && (
        <button className="btn small" onClick={() => setItems(note.items.filter((i) => !i.done))}>
          🧹 Xóa các dòng đã mua
        </button>
      )}
    </>
  );
}

/** Tạo danh sách đi chợ: chọn món + số phần → tự tính nguyên liệu còn thiếu so với kệ. */
function Generator({ onCreated }: { onCreated: (id: string) => void }) {
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  const ingredients = useGame((s) => s.ingredients);
  const createNote = useGame((s) => s.createNote);
  const [portions, setPortions] = useState<Record<string, number>>({});
  if (!player || !shop) return null;
  const recipes = learnedRecipes(player, shop);

  const need = new Map<string, number>();
  for (const r of recipes) {
    const n = portions[r.id] ?? 0;
    for (const i of r.ingredients) need.set(i.id, (need.get(i.id) ?? 0) + i.qty * n);
  }
  const items: NoteItem[] = [...need]
    .map(([id, q]) => ({ id, q: q - (player.pantry[id] ?? 0) }))
    .filter((x) => x.q > 0)
    .map((x) => ({ text: ingredients.get(x.id)?.name ?? x.id, ingredientId: x.id, qty: x.q, done: false }));

  const create = async () => {
    const title = `Đi chợ ngày ${player.day}: ${recipes
      .filter((r) => portions[r.id])
      .map((r) => `${portions[r.id]} ${r.name}`)
      .join(', ')}`.slice(0, 60);
    const note = await createNote(title, items, true);
    if (note) onCreated(note.id);
  };

  return (
    <>
      <p className="muted">
        Chọn số phần muốn bán tối nay. Sổ tự trừ hàng đã có trên kệ và ghi ra những thứ còn thiếu, kèm khu bán
        trong chợ.
      </p>
      {recipes.map((r) => (
        <div className="mk-recipe" key={r.id}>
          <span className="r-icon sm">{r.icon}</span>
          <div className="r-body">
            <b>{r.name}</b>
          </div>
          <div className="stepper">
            <button
              className="btn small"
              onClick={() => setPortions({ ...portions, [r.id]: Math.max(0, (portions[r.id] ?? 0) - 1) })}
            >
              −
            </button>
            <span>{portions[r.id] ?? 0}</span>
            <button
              className="btn small"
              onClick={() => setPortions({ ...portions, [r.id]: (portions[r.id] ?? 0) + 1 })}
            >
              +
            </button>
            <button
              className="btn small"
              onClick={() => setPortions({ ...portions, [r.id]: (portions[r.id] ?? 0) + 5 })}
            >
              +5
            </button>
          </div>
        </div>
      ))}
      <div className="section-title">Cần mua thêm</div>
      {items.length === 0 ? (
        <p className="muted">Chưa cần mua gì (chọn số phần ở trên).</p>
      ) : (
        <div className="neighbor-menu">
          {items.map((it) => (
            <span className="chip big" key={it.ingredientId}>
              {ingredients.get(it.ingredientId!)?.icon} {it.text} ×{it.qty}
            </span>
          ))}
        </div>
      )}
      <div className="foot">
        <span />
        <button className="btn primary" disabled={items.length === 0} onClick={() => void create()}>
          📌 Ghi vào sổ & ghim lên màn hình
        </button>
      </div>
    </>
  );
}
