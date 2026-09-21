import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import Icon from '../components/Icon';
import { api, getApiError, isUnauthenticated } from '../services/api';
import { logout } from '../services/auth.api';
import { ROLE_DETAILS, type AuthUser } from '../types/auth';

const modules = {
  STORE_OWNER: ['Đề xuất nhập hàng AI', 'Hàng hóa và tồn kho', 'Tìm nguồn sỉ'],
  SUPPLIER: [
    'Danh mục hàng sỉ',
    'Đơn hàng từ cửa hàng',
    'Doanh thu và đối soát',
  ],
  ADMIN: ['Quản lý người dùng', 'Xác minh chủ vựa', 'Thống kê nền tảng'],
};

export default function WorkspacePage({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const details = ROLE_DETAILS[user.role];

  useEffect(() => {
    let active = true;
    api
      .get(`/workspaces/${details.workspace}`)
      .then(() => {
        if (active) {
          setVerified(true);
          setError('');
        }
      })
      .catch((issue: unknown) => {
        if (!active) return;
        if (isUnauthenticated(issue)) onLogout();
        else setError(getApiError(issue));
      });
    return () => {
      active = false;
    };
  }, [details.workspace, onLogout, retry]);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      onLogout();
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <Brand />
        <div>
          <span className="workspace-role">{details.label}</span>
          <button
            className="secondary-button"
            onClick={handleLogout}
            disabled={busy}
          >
            <Icon name="logout" />
            {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </header>
      <section className="workspace-body">
        <p className="form-eyebrow">KHÔNG GIAN CỦA BẠN</p>
        <h1>Xin chào, {user.name}.</h1>
        <p className="form-description">{details.description}</p>
        {error ? (
          <div className="error-notice" role="alert">
            {error}{' '}
            <button className="text-button" onClick={() => setRetry(retry + 1)}>
              Thử lại
            </button>
          </div>
        ) : (
          <div className="session-notice" role="status">
            <Icon name="shield" />
            <div>
              <strong>
                {verified
                  ? 'Đăng nhập thành công'
                  : 'Đang kiểm tra quyền truy cập…'}
              </strong>
              <p>
                Tài khoản <b>{user.username}</b> · {details.label}
              </p>
            </div>
          </div>
        )}
        {verified && !error && (
          <>
            <div className="workspace-section-title">
              <h2>Khu vực làm việc</h2>
              <span>Đang phát triển</span>
            </div>
            <div className="module-grid">
              {modules[user.role].map((module, index) => (
                <article className="module-card" key={module}>
                  <span className="module-index">0{index + 1}</span>
                  <h3>{module}</h3>
                  <p>Chức năng sẽ được bổ sung ở giai đoạn tiếp theo.</p>
                  <span className="coming-soon">Sắp có</span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
