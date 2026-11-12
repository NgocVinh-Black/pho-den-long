import { formatMoney } from '@pdl/shared';
import { AvatarPreview } from '../components/AvatarPreview';
import { GoogleButton } from '../components/GoogleButton';
import { Overlay } from '../components/Overlay';
import { useGame } from '../store/game';

function AccountBox() {
  const user = useGame((s) => s.user);
  const clientId = useGame((s) => s.googleClientId);
  const login = useGame((s) => s.loginWithGoogle);
  const logout = useGame((s) => s.logout);

  if (user) {
    return (
      <div className="account">
        {user.picture ? (
          <img src={user.picture} alt="" className="account-pic" referrerPolicy="no-referrer" />
        ) : (
          <span className="account-pic">👤</span>
        )}
        <div className="account-info">
          <b>{user.displayName}</b>
          <small>{user.email} · quán được lưu theo tài khoản ☁️</small>
        </div>
        <button className="btn small" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </div>
    );
  }
  if (!clientId) {
    return (
      <div className="account muted-box">
        🔒 Đăng nhập Google chưa được bật trên máy chủ. Bạn đang chơi khách, quán được lưu trên máy này.
      </div>
    );
  }
  return (
    <div className="account login">
      <div className="account-info">
        <b>Đăng nhập để lưu quán theo tài khoản</b>
        <small>Chơi tiếp trên mọi máy. Quán đang chơi khách sẽ được chuyển vào tài khoản.</small>
      </div>
      <GoogleButton clientId={clientId} onCredential={(c) => void login(c)} />
    </div>
  );
}

export function TitleScreen() {
  const user = useGame((s) => s.user);
  const saved = useGame((s) => s.savedPlayer);
  const myPlayers = useGame((s) => s.myPlayers);
  const catalog = useGame((s) => s.catalog);
  const board = useGame((s) => s.leaderboard);
  const continuePlayer = useGame((s) => s.continuePlayer);
  const goChoose = useGame((s) => s.goChoose);
  const shopOf = (id: string) => catalog?.shops.find((s) => s.id === id);
  const savedShop = saved && shopOf(saved.shopId);
  const hasSaves = user ? myPlayers.length > 0 : !!saved;

  return (
    <Overlay>
      <div className="title">
        <div className="logo">🏮</div>
        <h1>Phố Đèn Lồng</h1>
        <p className="sub">Ba Miền Tụ Hội</p>
        <AccountBox />

        {user && myPlayers.length > 0 && (
          <div className="saves">
            <div className="section-title">🏪 Quán của bạn</div>
            {myPlayers.map((p) => {
              const shop = shopOf(p.shopId);
              return (
                <button className="save-row" key={p.id} onClick={() => void continuePlayer(p.id)}>
                  <AvatarPreview avatar={p.avatar} size={46} />
                  <span className="save-info">
                    <b>
                      {shop?.icon} {shop?.name}
                    </b>
                    <small>
                      {p.name} · Ngày {p.day} · {formatMoney(p.money)} · ⭐{p.rep}
                    </small>
                  </span>
                  <span className="btn primary small">▶ Chơi tiếp</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="btns">
          {!user && saved && savedShop && (
            <button className="btn primary big" onClick={() => void continuePlayer(saved.id)}>
              ▶ Chơi tiếp: {saved.name}, {savedShop.icon} ngày {saved.day}
            </button>
          )}
          <button className={`btn big ${hasSaves ? '' : 'primary'}`} onClick={goChoose}>
            🏪 Mở quán mới
          </button>
        </div>

        <ul className="howto">
          <li>
            🕹️ <b>Điều khiển:</b> <kbd>←</kbd> <kbd>→</kbd> (hoặc <kbd>A</kbd> <kbd>D</kbd>) để đi, giữ{' '}
            <kbd>Shift</kbd> để chạy, <kbd>E</kbd> để tương tác, <kbd>N</kbd> mở sổ ghi chú.
          </li>
          <li>
            ☀️ <b>Sáng:</b> ra chợ đầu mối ở đầu phố mua nguyên liệu, bàn ghế. Tự gánh về hoặc gọi xe ba gác.
          </li>
          <li>
            🌇 <b>Tối:</b> đứng ở quầy mở cửa. Mỗi món có trò chơi riêng: chần, rót, thái, nướng, đánh nhịp…
          </li>
          <li>
            🌙 <b>Đêm:</b> học món mới, nâng cấp quán, treo thêm đèn lồng để hút khách.
          </li>
        </ul>
        {board.length > 0 && (
          <div className="board">
            <div className="section-title">🏆 Bảng vàng phố</div>
            {board.map((b, i) => (
              <div className="brow" key={`${b.name}-${i}`}>
                <span>{i + 1}.</span>
                <span>
                  {b.shopIcon} <b>{b.name}</b> <small>{b.shop}</small>
                </span>
                <span>
                  {formatMoney(b.revenue)} · ⭐{b.rep}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
