import burnettLogo from "../assets/burnettpeople-logo.png";
import loginDarkTeal from "../assets/login-dark-teal.png";
import loginSoftMint from "../assets/login-soft-mint.png";

/**
 * Two-panel layout used by every public/auth page.
 *
 * headline : text or JSX shown big on the left panel
 * text     : small paragraph under the headline
 * children : content of the right panel
 */
export default function AuthLayout({ headline, text, children }) {
  return (
    <main className="bp-auth">
      <aside
        className="bp-brand"
        style={{ backgroundImage: `url(${loginDarkTeal})` }}
      >
        <div className="bp-brand-top">
          <img src={burnettLogo} alt="BurnettPeople" className="bp-logo" />
          <span className="bp-tagline">Your People. Your Future.</span>
        </div>

        <div className="bp-brand-middle">
          <h1>{headline}</h1>
          {text && <p>{text}</p>}
        </div>

        <div className="bp-brand-bottom">
          <span>People</span>
          <i aria-hidden="true">|</i>
          <span>Growth</span>
          <i aria-hidden="true">|</i>
          <span>Together</span>
        </div>
      </aside>

      <section
        className="bp-stage"
        style={{ backgroundImage: `url(${loginSoftMint})` }}
      >
        <img
          src={burnettLogo}
          alt="BurnettPeople"
          className="bp-logo bp-logo-mobile"
        />

        {children}
      </section>
    </main>
  );
}
