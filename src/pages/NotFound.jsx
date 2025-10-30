import React from "react";

export default function NotFound() {
  return (
    <main className="notfound" role="main">
      <div className="nf-card" role="region" aria-labelledby="nf-heading">
        <h1 id="nf-heading" className="nf-code">404</h1>
        <p className="nf-msg">We couldn't find the page you're looking for.</p>
        <div className="nf-actions">
          <a className="see-all-link" href="/">Home</a>
          <a className="see-all-link" href="/account">My Account</a>
        </div>
      </div>
    </main>
  );
}