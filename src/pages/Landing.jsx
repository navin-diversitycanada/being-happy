import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { listFeatured } from "../api/posts";
import { listCategories } from "../api/categories";

/**
 * Landing page (public). Redirects authenticated users:
 * - admins -> /admin
 * - regular users -> /index
 *
 * Change: keep the section title "Explore articles and tools for wellbeing."
 * unchanged, but replace the three static blog cards with the 3 latest featured
 * posts (excluding directories). No carousel on the landing page.
 */

export default function Landing() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (role === "admin") navigate("/admin", { replace: true });
      else navigate("/index", { replace: true });
    }
  }, [user, loading, role, navigate]);

  const [featured, setFeatured] = useState([]);
  const [catsMap, setCatsMap] = useState({});
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingFeatured(true);
      try {
        // Load up to 3 featured items and exclude directories (per request)
        const feats = await listFeatured(3, null, "directory").catch(() => []);
        const cats = await listCategories().catch(() => []);
        if (!mounted) return;
        const map = {};
        (cats || []).forEach(c => { map[c.id] = c.name; });
        setCatsMap(map);
        setFeatured(feats || []);
      } catch (err) {
        console.error("Landing: failed to load featured", err);
        if (mounted) setFeatured([]);
      } finally {
        if (mounted) setLoadingFeatured(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (user) return null;

  function renderLandingCard(item, idx) {
    const type = (item.type || "").toLowerCase();
    const url = type === "article" ? `/article/${item.id}` : type === "audio" ? `/audio/${item.id}` : type === "video" ? `/video/${item.id}` : `/directory/${item.id}`;
    const img = item.thumbnailUrl || item.imageUrl || "/images/placeholder.png";
    const cats = (item.categories || []).map(cid => catsMap[cid] || cid).join(", ");
    return (
      <article key={item.id || `feat-${idx}`} className="card landing-blog-card" aria-labelledby={`blog-${idx + 1}`}>
        <img className="card-img" src={img} alt={item.title || "Featured item"} />
        <div className="card-content">
          <div className="card-meta">{cats || (type ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Featured")}</div>
          <Link id={`blog-${idx + 1}`} className="card-title" to={url} style={{ textDecoration: "none", color: "inherit" }}>
            {item.title || "Untitled"}
          </Link>
        </div>
      </article>
    );
  }

  return (
    <div className="landing">
      <header className="landing-hero" role="banner" aria-label="Landing hero">
        <div className="landing-hero-bg" style={{ backgroundImage: "url('/images/landing.jpg')" }} />
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <h1>Be happier. Change your life.</h1>
          <p className="landing-sub"> Free, science-backed tools for sleep, stress relief, and everyday calm — articles, guided audio, videos, and trusted local directories.</p>
          <div className="landing-cta-row"><Link className="landing-cta" to="/index">Try Being Happy — Free</Link></div>
        </div>
      </header>

      <main className="landing-main" id="app">
        {/* FEATURES (unchanged) */}
        <section id="features" className="landing-features">
          <h2 className="detail-title section-title">We're here to help you feel better.</h2>
          <div className="landing-features-grid">
            <article className="landing-feature">
              <div className="feature-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 11c.5 1.5 1.9 2.5 4 2.5s3.5-1 4-2.5" />
                  <path d="M9 9h.01M15 9h.01" />
                </svg>
              </div>
              <h3>Happiness</h3>
              <p className="muted">Practical articles and short sessions focused on what helps people feel more satisfied, connected, and resilient.</p>
               <div className="landing-cta-row"><Link className="landing-cta" to="/index">Explore Happiness</Link></div>
            </article>

            <article className="landing-feature">
              <div className="feature-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21V11" />
                  <path d="M5 11c2-4 6-7 7-7s5 3 7 7" />
                  <path d="M5 11c.5 1.5 2 2.5 3.5 3" />
                </svg>
              </div>
              <h3>Growth</h3>
              <p className="muted">Evidence-based guidance and videos that support personal growth — small, reliable steps you can use every day.</p>
               <div className="landing-cta-row"><Link className="landing-cta" to="/index">Explore Growth</Link></div>
            </article>

            <article className="landing-feature">
              <div className="feature-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20s4-4 7-6c0 0-3-4-7-4" />
                  <path d="M12 20s-4-4-7-6c0 0 3-4 7-4" />
                  <path d="M12 8s1-3 4-4c0 0-2 1-4 4zM12 8s-1-3-4-4c0 0 2 1 4 4z" />
                </svg>
              </div>
              <h3>Mindfulness</h3>
              <p className="muted">Guided audio and video practices to bring presence, reduce reactivity, and build steady attention.</p>
               <div className="landing-cta-row"><Link className="landing-cta" to="/index">Explore Mindfulness</Link></div>
            </article>
          </div>
        </section>

        {/* BLOG: show 3 latest featured posts (not directories). Keep section title unchanged. */}
        <section id="blog" className="landing-blog" style={{ marginTop: 28 }}>
          <h2 className="detail-title section-title">Explore articles and tools for wellbeing.</h2>

          <div className="landing-blog-grid" style={{ marginTop: 18 }}>
            {loadingFeatured && <div style={{ padding: 12 }}>Loading…</div>}
            {!loadingFeatured && featured.length === 0 && (
              <>
                {/* Fallback: keep three original static cards if no featured items are available */}
                <article className="card landing-blog-card" aria-labelledby="blog-1">
                  <img className="card-img" src="/images/1.jpg" alt="Blog  1" />
                  <div className="card-content">
                    <div className="card-meta">Relationships</div>
                    <div id="blog-1" className="card-title">10 mindful Thanksgiving gift ideas that express your gratitude</div>
                  </div>
                </article>

                <article className="card landing-blog-card" aria-labelledby="blog-2">
                  <img className="card-img" src="/images/2.jpg" alt="Blog  2" />
                  <div className="card-content">
                    <div className="card-meta">Parenting</div>
                    <div id="blog-2" className="card-title">Is middle child syndrome real? What the science actually says</div>
                  </div>
                </article>

                <article className="card landing-blog-card" aria-labelledby="blog-3">
                  <img className="card-img" src="/images/3.jpg" alt="Blog  3" />
                  <div className="card-content">
                    <div className="card-meta">Wellbeing</div>
                    <div id="blog-3" className="card-title">4 ways to bring soothing routines into your day</div>
                  </div>
                </article>
              </>
            )}

            {!loadingFeatured && featured.length > 0 && (
              <>
                {featured.map((it, i) => renderLandingCard(it, i))}
              </>
            )}
          </div>
        </section>

        {/* TESTIMONIALS (unchanged) */}
        <section id="testimonials" className="landing-testimonials">
          <h2 className="detail-title section-title">What people are saying</h2>
          <div className="testimonials-row">
            <div className="testimonial-card" aria-labelledby="t1">
              <p id="t1" className="quote">"When I can’t sleep, a Being Happy session helps me relax and drift off."</p>
              <footer className="muted">Allison, Elliot Lake • ★★★★★</footer>
            </div>

            <div className="testimonial-card" aria-labelledby="t2">
              <p id="t2" className="quote">"Tuning in a few minutes here each day calms my racing thoughts and helps me stay focused."</p>
              <footer className="muted">Thomas, Kitchener • ★★★★★</footer>
            </div>

            <div className="testimonial-card" aria-labelledby="t3">
              <p id="t3" className="quote">"The articles and meditations have made a real difference in how I handle stress."</p>
              <footer className="muted">Sarah, Sarnia • ★★★★★</footer>
            </div>
          </div>
        </section>

        {/* FAQ (unchanged) */}
        <section id="faq" className="landing-faq">
          <h2 className="detail-title section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            <details>
              <summary>What is Being Happy?</summary>
              <div className="faq-body muted">Being Happy is a free app with articles, guided audio meditations, a video library, and curated directories of services and organizations to support sleep, stress relief, and wellbeing.
  </div>
            </details>

            <details>
              <summary>Is the core content really free?</summary>
              <div className="faq-body muted">Yes. Articles, audio meditations, videos, and directories are available at no cost.
  </div>
            </details>

            <details>
              <summary>How do I get started?</summary>
              <div className="faq-body muted">Tap “Try Being Happy — Free,” browse a short practice or article, and see what fits your day.
  </div>
            </details>
              <details>
              <summary>What’s in the directories?</summary>
              <div className="faq-body muted">Curated listings of trusted services and organizations — such as community programs and professional supports — to help you find local and online resources.
  </div>
            </details>

            <details>
              <summary> How long are the meditations and videos? </summary>
              <div className="faq-body muted">Many practices are short (a few minutes) so you can use them anytime; video and audio lengths vary so you can choose what fits your schedule.
  </div>
            </details>

            <details>
              <summary>Who created the content? </summary>
              <div className="faq-body muted">Content is developed from evidence-based approaches to mindfulness, sleep, and stress management and compiled for practical everyday use.
  </div>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
}