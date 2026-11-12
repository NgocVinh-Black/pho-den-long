import { useState } from 'react';
import { AVATAR_OPTIONS, HAT_LABELS, RULES, type Avatar } from '@pdl/shared';
import { AvatarPreview } from '../components/AvatarPreview';
import { Overlay } from '../components/Overlay';
import { RecipeRow } from '../components/RecipeRow';
import { useGame } from '../store/game';
import { KEYS, storage } from '../utils/storage';

const DEFAULT_AVATAR: Avatar = { skin: '#f1c27d', shirt: '#c0392b', hat: 'nonla' };

export function ChooseShopScreen() {
  const catalog = useGame((s) => s.catalog);
  const goTitle = useGame((s) => s.goTitle);
  const createPlayer = useGame((s) => s.createPlayer);
  const toast = useGame((s) => s.toast);
  const [chosen, setChosen] = useState<string | null>(null);
  const [name, setName] = useState(() => storage.get(KEYS.name) ?? '');
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [submitting, setSubmitting] = useState(false);

  if (!catalog) return null;
  const shop = catalog.shops.find((s) => s.id === chosen);
  const region = shop && catalog.regions.find((r) => r.id === shop.region);

  const submit = async () => {
    if (!shop || submitting) return;
    if (!name.trim()) return toast('Hãy nhập tên chủ quán', 'bad');
    setSubmitting(true);
    await createPlayer(name.trim(), shop.id, avatar);
    setSubmitting(false);
  };

  return (
    <Overlay wide>
      <div className="choose-head">
        <h2>Mở quán mới</h2>
        <button className="btn small" onClick={() => void goTitle()}>
          ← Quay lại
        </button>
      </div>

      <div className="section-title">1. Chủ quán là bạn</div>
      <div className="avatar-maker">
        <AvatarPreview avatar={avatar} name={name.trim() || 'Chủ quán'} />
        <div className="avatar-options">
          <input
            value={name}
            maxLength={RULES.maxNameLength}
            placeholder="Tên chủ quán (vd: Cô Ba)"
            onChange={(e) => setName(e.target.value)}
            aria-label="Tên chủ quán"
          />
          <div className="opt-row">
            <span>Da</span>
            {AVATAR_OPTIONS.skin.map((c) => (
              <button
                key={c}
                className={`swatch ${avatar.skin === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setAvatar({ ...avatar, skin: c })}
                aria-label={`Màu da ${c}`}
              />
            ))}
          </div>
          <div className="opt-row">
            <span>Áo</span>
            {AVATAR_OPTIONS.shirt.map((c) => (
              <button
                key={c}
                className={`swatch ${avatar.shirt === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setAvatar({ ...avatar, shirt: c })}
                aria-label={`Màu áo ${c}`}
              />
            ))}
          </div>
          <div className="opt-row">
            <span>Đội</span>
            {AVATAR_OPTIONS.hat.map((h) => (
              <button
                key={h}
                className={`btn small ${avatar.hat === h ? 'primary' : ''}`}
                onClick={() => setAvatar({ ...avatar, hat: h })}
              >
                {HAT_LABELS[h]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">2. Chọn quán bạn muốn kinh doanh</div>
      {shop && region ? (
        <div className="shop-detail">
          <div className="sd-head">
            <span className="sd-icon">{shop.icon}</span>
            <div>
              <h3>{shop.name}</h3>
              <p className="muted">
                {region.area} · {shop.desc}
              </p>
            </div>
          </div>
          <div className="recipe-list">
            {shop.recipes.map((r) => (
              <RecipeRow key={r.id} recipe={r} showLearn />
            ))}
          </div>
          <div className="foot">
            <span className="muted">
              Chủ quán <b>{name.trim() || '…'}</b> sẽ mở <b>{shop.name}</b>
            </span>
            <button className="btn primary" disabled={submitting} onClick={() => void submit()}>
              🏮 Khai trương
            </button>
          </div>
        </div>
      ) : (
        <p className="muted center">👇 Chọn một trong {catalog.shops.length} quán để xem công thức</p>
      )}

      {catalog.regions.map((r) => (
        <div className="region" key={r.id}>
          <div className="region-title" style={{ '--rc': r.color } as React.CSSProperties}>
            {r.name} <small>{r.area}</small>
          </div>
          <div className="shop-grid">
            {catalog.shops
              .filter((s) => s.region === r.id)
              .map((s) => (
                <button
                  key={s.id}
                  className={`shop-card ${s.id === chosen ? 'active' : ''}`}
                  onClick={() => setChosen(s.id)}
                >
                  <span className="sc-icon">{s.icon}</span>
                  <b>{s.name}</b>
                  <small>
                    {s.recipes.map((x) => x.icon).join(' ')} · {s.recipes.length} món
                  </small>
                </button>
              ))}
          </div>
        </div>
      ))}
    </Overlay>
  );
}
