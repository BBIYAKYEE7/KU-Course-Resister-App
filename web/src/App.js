import React, { useEffect, useRef } from 'react';
import './App.css';

function useRevealOnScroll(selector = '.card', rootMargin = '0px 0px -5% 0px') {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const elements = Array.from(document.querySelectorAll(selector));

    const isInView = (el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return rect.top < vh * 0.95 && rect.bottom > 0;
    };

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('appear');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin, threshold: 0.05 }
    );
    elements.forEach(el => {
      if (isInView(el)) {
        el.classList.add('appear');
      } else {
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, [selector, rootMargin]);
}

function App() {
  useRevealOnScroll();
  useRevealOnScroll('.reveal');

  return (
    <>
      {/* Hero */}
      <section className="hero section reveal">
        <div className="container">
          <h1>고려대 수강신청 도우미</h1>
          <p className="muted">빠르고 안정적으로, 필요한 기능만 담았습니다.</p>
          <div className="cta">
            <a className="btn" href="/downloads/KoreaUniversitySugang-Setup-v1.1.0.exe">Windows 다운로드</a>
            <a className="btn" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* Features */}
      <section className="section reveal">
        <div className="container">
          <h2 className="section-title">주요 기능</h2>
          <div className="grid">
            <div className="card feature-card">
              <h3>자동 새로고침</h3>
              <p>실시간 좌석 변화를 빠르게 감지합니다.</p>
            </div>
            <div className="card feature-card">
              <h3>키보드 최적화</h3>
              <p>핫키로 신청/취소를 빠르게 수행하세요.</p>
            </div>
            <div className="card feature-card">
              <h3>안정성</h3>
              <p>네트워크 오류 상황에서도 견고하게 동작합니다.</p>
            </div>
            <div className="card feature-card">
              <h3>가벼운 설치</h3>
              <p>원클릭 설치와 자동 업데이트 지원.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* Download */}
      <section className="section download reveal">
        <div className="container">
          <h2 className="section-title">다운로드</h2>
          <p className="muted">Windows 10 이상 지원</p>
          <div style={{ height: 12 }} />
          <a className="btn" href="/downloads/KoreaUniversitySugang-Setup-v1.1.0.exe">설치 파일 받기</a>
          <div style={{ height: 12 }} />
          <div className="hash">파일: KoreaUniversitySugang-Setup-v1.1.0.exe</div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div style={{ fontWeight: 700, letterSpacing: 1 }}>BBIYAKYEE7</div>
          <div className="muted" style={{ marginTop: 8 }}>2025 © Copyright by BBIYAKYEE7, All rights reserved.</div>
          <div className="muted">Made and serviced with React.js</div>
          <div className="icons">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/>
              </svg>
            </a>
            <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="telegram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 3L3.7 10.3c-.9.4-.9 1.7.1 2l4.5 1.4 1.5 4.8c.3.9 1.5 1.1 2 .3l2.6-3.6 4.7 3.4c.8.6 1.9.1 2.1-.9L23 4.6c.3-1-0.7-1.9-1.6-1.6Z" fill="currentColor"/>
              </svg>
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="github">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.9 9.6.5.1.7-.2.7-.5 0-.3 0-1.1 0-2.1-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-1.9 1-2.6-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1 .8-.2 1.6-.3 2.4-.3s1.6.1 2.4.3c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.5 1 2.6 0 3.9-2.3 4.6-4.5 4.9.3.3.6.8.6 1.7 0 1.2 0 2.2 0 2.5 0 .3.2.6.7.5 4-1.3 6.9-5.1 6.9-9.6C22 6.6 17.5 2 12 2Z"/>
              </svg>
            </a>
          </div>
    </div>
      </footer>
    </>
  );
}

export default App;
