import { Overlay } from '../components/Overlay';
import { useGame } from '../store/game';

export function LoadingScreen() {
  return (
    <Overlay>
      <div className="title">
        <div className="logo spin">🏮</div>
        <p>Đang thắp đèn…</p>
      </div>
    </Overlay>
  );
}

export function OfflineScreen() {
  const boot = useGame((s) => s.boot);
  return (
    <Overlay>
      <div className="title">
        <div className="logo">🔌</div>
        <h2>Không kết nối được máy chủ</h2>
        <p className="muted">Giao diện cần API backend đang chạy. Ở thư mục dự án, chạy:</p>
        <pre className="code">npm run dev</pre>
        <div className="btns">
          <button className="btn primary" onClick={() => void boot()}>
            Thử lại
          </button>
        </div>
      </div>
    </Overlay>
  );
}
