import { formatMoney, STAFF_ROLES } from '@pdl/shared';
import { Overlay } from '../components/Overlay';
import { RecipeRow } from '../components/RecipeRow';
import { useGame } from '../store/game';

export function NightScreen() {
  const s = useGame((st) => st.summary);
  const player = useGame((st) => st.player);
  const shop = useGame((st) => st.shop);
  const catalog = useGame((st) => st.catalog);
  const ingredients = useGame((st) => st.ingredients);
  const learn = useGame((st) => st.learn);
  const upgrade = useGame((st) => st.upgrade);
  const goMorning = useGame((st) => st.goMorning);
  const hireStaff = useGame((st) => st.hireStaff);
  const fireStaff = useGame((st) => st.fireStaff);

  if (!s || !player || !shop || !catalog) return null;
  const { rules } = catalog;
  const best = Object.entries(s.dishes).sort((a, b) => b[1] - a[1])[0];
  const bestRecipe = best && shop.recipes.find((r) => r.id === best[0]);
  const toLearn = shop.recipes.filter((r) => !player.learned.includes(r.id));
  const shopMaxed = player.shopLevel >= rules.maxShopLevel;
  const decorMaxed = player.decor >= rules.maxDecor;
  const shopCost = rules.shopUpgradeCosts[player.shopLevel - 1] ?? 0;
  const decorCost = rules.decorCosts[player.decor] ?? 0;

  return (
    <Overlay wide>
      <h2>🌙 Đóng cửa ngày {s.day}</h2>
      <div className="summary">
        <div>
          <b>{s.served}</b>
          <span>Khách phục vụ</span>
        </div>
        <div>
          <b>{s.perfect}</b>
          <span>Món hoàn hảo</span>
        </div>
        <div>
          <b>{s.missed}</b>
          <span>Khách bỏ về</span>
        </div>
        <div>
          <b className={s.profit >= 0 ? 'up' : 'bad'}>
            {s.profit >= 0 ? '+' : ''}
            {formatMoney(s.profit)}
          </b>
          <span>
            Lãi (thu {formatMoney(s.revenue)} − chi {formatMoney(s.spent)})
          </span>
        </div>
      </div>
      {bestRecipe && best && (
        <p className="muted">
          Món bán chạy nhất: {bestRecipe.icon} <b>{bestRecipe.name}</b> ({best[1]} phần)
        </p>
      )}
      {s.spoiled.length > 0 && (
        <div className="note">
          🗑️ Hàng tươi bị hư: {s.spoiled.map((x) => `${ingredients.get(x.id)?.icon} ${x.qty}`).join(', ')}
        </div>
      )}
      {s.autoStocked.length > 0 && (
        <div className="note">
          📦 Hàng còn gánh / đang giao đã được cất vào kho:{' '}
          {s.autoStocked.map((x) => `${ingredients.get(x.id)?.icon} ${x.qty}`).join(', ')}
        </div>
      )}
      {s.wagesPaid > 0 && <div className="note">👥 Đã trả lương nhân viên: {formatMoney(s.wagesPaid)}</div>}
      {s.staffQuit.length > 0 && (
        <div className="note">
          😢 Không đủ tiền trả lương, {s.staffQuit.map((x) => x.name).join(', ')} đã nghỉ việc.
        </div>
      )}
      {s.rescued > 0 && (
        <div className="note good">💌 Bà nội gửi thêm {formatMoney(s.rescued)} vốn: “Cố lên cháu!”</div>
      )}

      <div className="section-title">📖 Học công thức mới</div>
      {toLearn.length === 0 && <p className="muted">Bạn đã thuộc hết công thức của quán! 👨‍🍳</p>}
      {toLearn.map((r) => {
        const okRep = player.rep >= r.learnRep;
        const ok = okRep && player.money >= r.learnCost;
        return (
          <div className="up-row" key={r.id}>
            <RecipeRow recipe={r} />
            <button
              className={`btn small ${ok ? 'primary' : ''}`}
              disabled={!ok}
              onClick={() => void learn(r.id)}
            >
              Học {formatMoney(r.learnCost)}
              {!okRep && ` · cần ⭐${r.learnRep}`}
            </button>
          </div>
        );
      })}

      <div className="section-title">👥 Nhân viên</div>
      <p className="muted">
        Tiền nhận việc là một ngày lương trả trước, sau đó lương trừ cuối mỗi ngày. Lương mỗi ngày hiện tại:{' '}
        <b>{formatMoney(player.staff.reduce((a, st) => a + STAFF_ROLES[st.role].wage, 0))}</b>
      </p>
      {player.staff.map((st) => (
        <div className="up-row simple" key={st.id}>
          <span className="r-icon">{STAFF_ROLES[st.role].icon}</span>
          <div className="r-body">
            <b>
              {st.name} · {STAFF_ROLES[st.role].title}
            </b>
            <small className="muted">
              Làm từ ngày {st.hiredDay} · lương {formatMoney(STAFF_ROLES[st.role].wage)}/ngày
            </small>
          </div>
          <button className="btn small" onClick={() => void fireStaff(st.id)}>
            Cho nghỉ
          </button>
        </div>
      ))}
      {(['waiter', 'cook'] as const).map((role) => {
        const def = STAFF_ROLES[role];
        const have = player.staff.filter((x) => x.role === role).length;
        const full = have >= def.max;
        const ok = !full && player.money >= def.wage;
        return (
          <div className="up-row simple" key={role}>
            <span className="r-icon">{def.icon}</span>
            <div className="r-body">
              <b>
                Thuê {def.title.toLowerCase()} ({have}/{def.max})
              </b>
              <small className="muted">{def.desc}</small>
            </div>
            <button
              className={`btn small ${ok ? 'primary' : ''}`}
              disabled={!ok}
              onClick={() => void hireStaff(role)}
            >
              {full ? 'Đã đủ' : `Thuê ${formatMoney(def.wage)}/ngày`}
            </button>
          </div>
        );
      })}

      <div className="section-title">🔨 Nâng cấp</div>
      <UpgradeRow
        icon="🏪"
        title={`Sửa sang quán (cấp ${player.shopLevel}/${rules.maxShopLevel})`}
        desc={`Giá bán +${Math.round(rules.levelPriceBonus * 100)}%, thao tác dễ hơn, khách chờ lâu hơn`}
        cost={shopCost}
        maxed={shopMaxed}
        canAfford={player.money >= shopCost}
        onClick={() => void upgrade('shop')}
      />
      <UpgradeRow
        icon="🏮"
        title={`Treo dây đèn lồng (${player.decor}/${rules.maxDecor})`}
        desc="Phố sáng hơn, nhiều khách ghé hơn"
        cost={decorCost}
        maxed={decorMaxed}
        canAfford={player.money >= decorCost}
        onClick={() => void upgrade('decor')}
      />

      <div className="foot">
        <span>
          Ví: <b>{formatMoney(player.money)}</b> · ⭐ {player.rep}
        </span>
        <button className="btn primary" onClick={() => void goMorning()}>
          ☀️ Sang ngày {player.day}
        </button>
      </div>
    </Overlay>
  );
}

interface UpgradeRowProps {
  icon: string;
  title: string;
  desc: string;
  cost: number;
  maxed: boolean;
  canAfford: boolean;
  onClick: () => void;
}

function UpgradeRow({ icon, title, desc, cost, maxed, canAfford, onClick }: UpgradeRowProps) {
  const enabled = !maxed && canAfford;
  return (
    <div className="up-row simple">
      <span className="r-icon">{icon}</span>
      <div className="r-body">
        <b>{title}</b>
        <small className="muted">{desc}</small>
      </div>
      <button className={`btn small ${enabled ? 'primary' : ''}`} disabled={!enabled} onClick={onClick}>
        {maxed ? 'Tối đa' : formatMoney(cost)}
      </button>
    </div>
  );
}
