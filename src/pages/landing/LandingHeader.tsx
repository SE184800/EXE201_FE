import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';

const NAV_LINKS = [
  { id: 'features', label: 'Tính năng' },
  { id: 'how-it-works', label: 'Cách hoạt động' },
  { id: 'roles', label: 'Vai trò' },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  // Header đặc hơn + nền mờ sau khi cuộn để tách nội dung khỏi ảnh nền.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Đánh dấu mục đang xem: section gần "đường đọc" (1/3 chiều cao viewport) nhất.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      let current = '';
      for (const link of NAV_LINKS) {
        const section = document.getElementById(link.id);
        if (!section) continue;
        const { top, bottom } = section.getBoundingClientRect();
        // Section đã đi qua đường đọc, hoặc đang phủ đường đọc.
        if (top <= line && bottom > line) {
          current = link.id;
          break;
        }
        // Section nằm ngay dưới đường đọc và sắp tới.
        if (!current && top > line && top < window.innerHeight) current = link.id;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Đóng menu khi bấm ra ngoài, bấm Escape, hoặc chuyển sang mục khác.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 900) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  function goTo(id: string) {
    setOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <header className={`landing-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="landing-header-inner">
        <Link className="landing-header-brand" to="/" aria-label="SupplyMind AI — trang chủ">
          <Brand light />
        </Link>

        <nav className="landing-header-links" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`landing-header-link ${activeSection === link.id ? 'is-active' : ''}`}
              onClick={() => goTo(link.id)}
              aria-current={activeSection === link.id ? 'true' : undefined}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="landing-header-actions">
          <Link className="landing-button landing-button-ghost" to="/login">
            Đăng nhập
          </Link>
          <Link className="landing-button landing-button-solid" to="/register">
            Đăng ký
          </Link>
        </div>

        <button
          className="landing-header-toggle"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
        >
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>

      <div
        id="landing-mobile-menu"
        className={`landing-mobile-menu ${open ? 'is-open' : ''}`}
      >
        <nav className="landing-mobile-links" aria-label="Điều hướng di động">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`landing-mobile-link ${
                activeSection === link.id ? 'is-active' : ''
              }`}
              onClick={() => goTo(link.id)}
            >
              {link.label}
              <Icon name="arrow" />
            </button>
          ))}
        </nav>
        <div className="landing-mobile-actions">
          <Link className="landing-button landing-button-ghost" to="/login" onClick={() => setOpen(false)}>
            Đăng nhập
          </Link>
          <Link
            className="landing-button landing-button-solid"
            to="/register"
            onClick={() => setOpen(false)}
          >
            Đăng ký
          </Link>
        </div>
      </div>
    </header>
  );
}
