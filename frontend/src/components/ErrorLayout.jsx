import { useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { ArrowLeftIcon, ExternalLinkIcon, HelpCircleIcon, HomeIcon } from "./icons";
import { homeForUser } from "../config/roles";

/* One layout for the 403 / 404 / 500 pages (same two-column shell as the auth pages).
   - image + imageAlt : the illustration
   - code             : big number shown under the picture (404's number is inside its picture)
   - tips             : the "What you can do" list (omit for 404)
   - stacked          : true = buttons stacked in a narrower column (404 design) */
export default function ErrorLayout({
  user,
  headline,
  text,
  image,
  imageAlt,
  code,
  title,
  description,
  tips,
  tipsIcon,
  helpLabel,
  helpHref,
  stacked = false,
  showOr = false,
  onReset,
}) {
  const navigate = useNavigate();
  const target = user ? homeForUser(user) : "/";
  const external = /^https?:/i.test(helpHref || "");

  function goDashboard() {
    onReset?.();
    navigate(target, { replace: true });
  }

  function goBack() {
    onReset?.();
    // If this tab has no history to go back to, fall back to the dashboard.
    if (window.history.length > 1) navigate(-1);
    else navigate(target, { replace: true });
  }

  return (
    <AuthLayout headline={headline} text={text}>
      <div className={`bp-error ${stacked ? "stacked" : ""}`}>
        <img className="bp-error-art" src={image} alt={imageAlt} />

        {code && <p className="bp-error-code">{code}</p>}
        <h2 className="bp-error-title">{title}</h2>
        <div className="bp-error-desc">{description}</div>

        {tips && (
          <div className="bp-tips">
            <span className="bp-tips-icon">{tipsIcon}</span>
            <div>
              <h3>What you can do:</h3>
              <ul>{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
            </div>
          </div>
        )}

        <div className="bp-error-actions">
          <button type="button" className="bp-button" onClick={goDashboard}>
            <HomeIcon width={22} height={22} /> {user ? "Go to Dashboard" : "Go to Login"}
          </button>
          <button type="button" className="bp-button outline" onClick={goBack}>
            <ArrowLeftIcon width={22} height={22} /> Go Back
          </button>
        </div>

        {showOr && <p className="bp-or"><span>or</span></p>}

        <a
          className="bp-help-link"
          href={helpHref}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <HelpCircleIcon /> {helpLabel} <ExternalLinkIcon />
        </a>
      </div>
    </AuthLayout>
  );
}