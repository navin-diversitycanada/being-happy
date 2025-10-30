import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * Full Landing page (public) — paste entire component.
 * When logged in, this page immediately redirects to /index.
 */
export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Authenticated users should not see landing — send to app index
      navigate("/index", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (user) return null;

  return (
    <div className="landing">
      {/* HERO */}
      <header className="landing-hero" role="banner" aria-label="Landing hero">
        <div className="landing-hero-bg" style={{ backgroundImage: "url('/images/landing.jpg')" }}></div>
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <h1>Be happier. Change your life.</h1>
          <p className="landing-sub">
            Being Happy brings simple, science-backed tools for mindfulness, sleep and stress —
            personalized content to help you feel more present, rested, and resilient.
          </p>
          <div className="landing-cta-row">
            <a className="landing-cta" href="/login">Try Being Happy for Free</a>
          </div>
        </div>
      </header>

      <main className="landing-main" id="app">
        {/* FEATURES */}
        <section id="features" className="landing-features">
          <h2 className="section-title">We're here to help you feel better.</h2>
          <div className="landing-features-grid">
            <article className="landing-feature">
              <div className="feature-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4"/>
                  <path d="M7 10l5 5 5-5"/>
                </svg>
              </div>
              <h3>Stress less.</h3>
              <p className="muted">Tools for in-the-moment relief from stress and anxiety so you can get back to living.</p>
            </article>

            <article className="landing-feature">
              <div className="feature-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6"/>
                  <path d="M20.4 6.6a9 9 0 1 1-16.8 0"/>
                </svg>
              </div>
              <h3>Sleep more.</h3>
              <p className="muted">Guided sessions and bedtime content to help you fall and stay asleep naturally.</p>
            </article>

            <article className="landing-feature">
              <div className="feature-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h3>Live mindfully.</h3>
              <p className="muted">Short practices and programs to build resilience, focus, and emotional wellbeing.</p>
            </article>
          </div>
        </section>

        {/* BLOG */}
        <section id="blog" className="landing-blog">
          <h2 className="section-title">Explore articles and tools for wellbeing.</h2>
          <div className="landing-blog-grid">
            <article className="card landing-blog-card" aria-labelledby="blog-1">
              <img className="card-img" src="/images/1.jpg" alt="Blog image 1" />
              <div className="card-content">
                <div className="card-meta">Relationships</div>
                <div id="blog-1" className="card-title">10 mindful Thanksgiving gift ideas that express your gratitude</div>
              </div>
            </article>

            <article className="card landing-blog-card" aria-labelledby="blog-2">
              <img className="card-img" src="/images/2.jpg" alt="Blog image 2" />
              <div className="card-content">
                <div className="card-meta">Parenting</div>
                <div id="blog-2" className="card-title">Is middle child syndrome real? What the science actually says</div>
              </div>
            </article>

            <article className="card landing-blog-card" aria-labelledby="blog-3">
              <img className="card-img" src="/images/3.jpg" alt="Blog image 3" />
              <div className="card-content">
                <div className="card-meta">Wellbeing</div>
                <div id="blog-3" className="card-title">4 ways to bring soothing routines into your day</div>
              </div>
            </article>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="landing-testimonials">
          <h2 className="section-title">Over 2 million 5-star reviews.</h2>
          <div className="testimonials-row">
            <blockquote className="testimonial-card" aria-labelledby="t1">
              <p id="t1" className="quote">When I cannot fall asleep, I turn on Being Happy and am out within 5 minutes.</p>
              <footer className="muted">Brandy from Houston • ★★★★★</footer>
            </blockquote>

            <blockquote className="testimonial-card" aria-labelledby="t2">
              <p id="t2" className="quote">I have a very busy brain and can find it hard to unwind. A daily practice with Being Happy is healing for me.</p>
              <footer className="muted">John from Chicago • ★★★★★</footer>
            </blockquote>

            <blockquote className="testimonial-card" aria-labelledby="t3">
              <p id="t3" className="quote">Being Happy has changed my life in immeasurable ways. I am more resilient and connected to myself.</p>
              <footer className="muted">Allison from San Jose • ★★★★★</footer>
            </blockquote>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="landing-faq">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            <details>
              <summary>What is Being Happy?</summary>
              <div className="faq-body muted">Being Happy is an app that helps with sleep, meditation and relaxation using guided sessions and practical tools to build mindfulness and reduce stress.</div>
            </details>

            <details>
              <summary>What’s included in a Being Happy subscription?</summary>
              <div className="faq-body muted">Guided meditations, sleep stories, soothing audio, masterclasses, and short programs for sleep, anxiety and focus.</div>
            </details>

            <details>
              <summary>How do I cancel?</summary>
              <div className="faq-body muted">You can cancel via the App Store / Google Play or from your account settings in the app or website.</div>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
}