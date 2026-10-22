import burnettLogo from "../assets/burnettpeople-logo.png";
// Left panel picture (the office / plant artwork): src/assets/login-office.png
import panelImage from "../assets/login-dark-teal.png";
import softMint from "../assets/login-soft-mint.png";

/* Two-column shell used by Set Up Password, Reset Password, Success and the error pages.
   headline / text are shown on the dark left panel; children go on the right. */
export default function AuthLayout({ headline, text, children }) {
  return (
    <main className="bp-auth">
      <section
        className="bp-auth-brand"
        style={{ backgroundImage: `url(${panelImage})` }}
        aria-label="BurnettPeople"
      >
        <div>
          <img className="bp-auth-logo" src={burnettLogo} alt="BurnettPeople" />
          <p className="bp-auth-tagline">YOUR PEOPLE. YOUR FUTURE.</p>
        </div>

        <div className="bp-auth-copy">
          <h1>{headline}</h1>
          <p>{text}</p>
        </div>

        <p className="bp-auth-foot">PEOPLE &nbsp;|&nbsp; GROWTH &nbsp;|&nbsp; TOGETHER</p>
      </section>

      <section className="bp-auth-main" style={{ backgroundImage: `url(${softMint})` }}>
        <img className="bp-auth-mobile-logo" src={burnettLogo} alt="BurnettPeople" />
        {children}
      </section>
    </main>
  );
}