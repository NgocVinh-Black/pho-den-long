import { useEffect, useRef, useState } from 'react';

interface GoogleIdApi {
  initialize: (opts: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    ux_mode?: string;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loader: Promise<void> | null = null;

/** Tải thư viện Google Identity Services đúng một lần. */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error('Không tải được Google Sign-In'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

/** Nút "Đăng nhập bằng Google" chính thức. */
export function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (c: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cb.current = onCredential;
  });

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        const gid = window.google?.accounts.id;
        if (cancelled || !gid || !ref.current) return;
        gid.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        gid.renderButton(ref.current, {
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'vi',
          width: 280,
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="google-btn">
      <div ref={ref} />
      {error && <small className="bad">{error}</small>}
    </div>
  );
}
