import burnettLogo from "../assets/burnettpeople-logo.png";
// Left panel: office / plant artwork on top of the dark teal gradient
import officeArt from "../assets/login-office.png";
import panelImage from "../assets/login-dark-teal.png";
// Left panel picture (the office / plant artwork): src/assets/login-office.png
import panelImage from "../assets/login-office.png";
import softMint from "../assets/login-soft-mint.png";

const FEATURES = [
  ["↗", "Everything in one place", "People, attendance, leave and more."],
  ["✳", "Made for your workday", "Less admin. More meaningful work."],
];

/* Two-column shell used by Set Up Password, Reset Password, Success and the error pages.
   headline / text are shown on the dark left panel; children go on the right. */
export default function AuthLayout({ headline, text, children }) {
  return (
    <main className="bp-auth">
      <section
        className="bp-auth-brand"
        /* first image = office artwork (on top), second = dark teal gradient (behind it) */
        style={{ backgroundImage: `url(${officeArt}), url(${panelImage})` }}
        aria-label="BurnettPeople"
      >
        <div>
          <img className="bp-auth-logo" src={burnettLogo} alt="BurnettPeople" />
          <p className="bp-auth-tagline">YOUR PEOPLE. YOUR FUTURE.</p>
        </div>

        <div className="bp-auth-copy">
          <h1>{headline}</h1>
          <p>{text}</p>

          <div className="bp-auth-features">
            {FEATURES.map(([icon, title, sub]) => (
              <div className="bp-auth-feature" key={title}>
                <span className="bp-auth-feature-icon" aria-hidden="true">{icon}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{sub}</p>
                </div>
              </div>
            ))}
          </div>
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