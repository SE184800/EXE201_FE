import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import LandingHeader from './LandingHeader';
import './landing.css';

import landingBg from '../../assets/landingBg.jpeg';

// ─────────────────────────────────────────────────────────────
// ẢNH NỀN LANDING PAGE
// Đổi thành `null` nếu muốn tạm dùng nền gradient xanh.
// ─────────────────────────────────────────────────────────────
const LANDING_BG_IMAGE: string | null = landingBg;

const highlights = [
  {
    icon: 'sparkle' as const,
    title: 'Gợi ý nhập hàng',
    description: 'Dựa trên nhịp bán thực tế của cửa hàng, không dựa vào cảm tính.',
  },
  {
    icon: 'box' as const,
    title: 'Kết nối nguồn sỉ',
    description: 'Tìm nhà cung cấp gần bạn, so sánh giá và chốt đơn ngay trên nền tảng.',
  },
  {
    icon: 'chart' as const,
    title: 'Nắm rõ lợi nhuận',
    description: 'Theo dõi doanh thu, tồn kho và hàng sắp hết hạn trong một màn hình.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Kết nối dữ liệu bán hàng',
    description: 'Nhập lịch sử bán, tồn kho và số liệu cũ để hệ thống hiểu cửa hàng của bạn.',
  },
  {
    step: '02',
    title: 'Nhận đề xuất nhập hàng',
    description: 'AI tính nhu cầu theo mùa vụ và cửa hàng, kèm số lượng gợi ý cụ thể.',
  },
  {
    step: '03',
    title: 'Chốt đơn sỉ và theo dõi',
    description: 'Gửi yêu cầu báo giá, so sánh giá và theo dõi đơn hàng đến khi giao.',
  },
];

const roles = [
  {
    icon: 'store' as const,
    label: 'Chủ tạp hóa',
    description: 'Theo dõi kho, nhập hàng và bán hàng tại một nơi.',
  },
  {
    icon: 'box' as const,
    label: 'Chủ vựa',
    description: 'Quản lý sản phẩm, báo giá và đơn hàng bán sỉ.',
  },
  {
    icon: 'shield' as const,
    label: 'Quản trị viên',
    description: 'Quản lý tài khoản và vận hành toàn nền tảng.',
  },
];

export default function LandingPage() {
  useEffect(() => {
    document.title = 'SupplyMind AI · Nhập hàng đúng lúc, kinh doanh nhẹ đầu';
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="landing-page">
      {/* Lớp nền: ảnh (nếu có) + lớp phủ tối giúp chữ luôn đọc được */}
      <div
        className="landing-backdrop"
        aria-hidden="true"
        style={LANDING_BG_IMAGE ? { backgroundImage: `url(${LANDING_BG_IMAGE})` } : undefined}
      />
      <div className="landing-scrim" aria-hidden="true" />

      <LandingHeader />

      <div className="landing-content">
        <section className="landing-hero">
          <p className="landing-eyebrow">
            <span /> NGƯỜI BẠN CỦA NHÀ BÁN LẺ
          </p>
          <h1>
            Nhập hàng đúng lúc.
            <br />
            <span>Kinh doanh nhẹ đầu.</span>
          </h1>
          <p className="landing-description">
            SupplyMind AI giúp cửa hàng tạp hóa biết nên nhập gì, nhập bao nhiêu và nhập từ đâu —
            để vốn không nằm im trên kệ.
          </p>
          <ul className="landing-points">
            <li>
              <Icon name="check" /> Dự báo nhu cầu theo dữ liệu bán hàng
            </li>
            <li>
              <Icon name="check" /> Cảnh báo hàng sắp hết và sắp hết hạn
            </li>
            <li>
              <Icon name="check" /> Quản lý đơn sỉ, báo giá và công nợ
            </li>
          </ul>
          <div className="landing-cta">
            <Link className="landing-button landing-button-solid landing-button-lg" to="/register">
              Bắt đầu miễn phí <Icon name="arrow" />
            </Link>
            <Link className="landing-button landing-button-ghost landing-button-lg" to="/login">
              Tôi đã có tài khoản
            </Link>
          </div>
        </section>

        <section className="landing-features" id="features" aria-label="Tính năng chính">
          {highlights.map((item) => (
            <article className="landing-feature" key={item.title}>
              <span className="landing-feature-icon">
                <Icon name={item.icon} />
              </span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section className="landing-steps" id="how-it-works" aria-label="Cách hoạt động">
          <div className="landing-section-head">
            <p className="landing-eyebrow">
              <span /> CÁCH HOẠT ĐỘNG
            </p>
            <h2>Ba bước để bắt đầu</h2>
          </div>
          <ol className="landing-step-list">
            {steps.map((item) => (
              <li className="landing-step" key={item.step}>
                <span className="landing-step-number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-roles" id="roles" aria-label="Vai trò sử dụng">
          <div className="landing-section-head">
            <p className="landing-eyebrow">
              <span /> MỘT NỀN TẢNG, BA VAI TRÒ
            </p>
            <h2>Không gian riêng cho từng vai trò</h2>
          </div>
          <div className="landing-role-list">
            {roles.map((role) => (
              <article className="landing-role" key={role.label}>
                <span className="landing-role-icon">
                  <Icon name={role.icon} />
                </span>
                <h3>{role.label}</h3>
                <p>{role.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="landing-footer">
          <span>© 2026 SupplyMind AI</span>
          <span>
            <Icon name="lock" /> Kết nối an toàn, an tâm kinh doanh
          </span>
        </footer>
      </div>
    </main>
  );
}
