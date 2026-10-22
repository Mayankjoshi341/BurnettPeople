import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { ArrowRightIcon, UserIcon } from "../components/icons";

/* The "Password Set Successfully!" card. Used by account activation and by password reset. */
export function PasswordSuccessCard({
  title = "Password Set Successfully!",
  message = "Your password has been created successfully. You can now log in to your BurnettPeople account using your new password.",
  noteTitle = "Your Account is Ready",
  noteText = "You now have full access to your BurnettPeople account. Please keep your password secure.",
}) {
  const navigate = useNavigate();

  return (
    <div className="bp-card bp-card-wide bp-success" role="status">
      <div className="bp-success-art" aria-hidden="true">
        <span className="bp-dot d1" />
        <span className="bp-dot d2" />
        <span className="bp-dot d3" />
        <span className="bp-dot d4" />
        <span className="bp-dot d5" />
        <span className="bp-success-badge">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </div>

      <h2 className="bp-card-title">{title}</h2>
      <p className="bp-card-subtitle">{message}</p>

      <div className="bp-note">
        <span className="bp-note-icon"><UserIcon width={26} height={26} /></span>
        <div>
          <strong>{noteTitle}</strong>
          <p>{noteText}</p>
        </div>
      </div>

      <button type="button" className="bp-button" onClick={() => navigate("/", { replace: true })}>
        Go to Login Page <ArrowRightIcon width={20} height={20} />
      </button>
    </div>
  );
}

/* Stand-alone full page version (optional route). */
export default function PasswordSuccessPage() {
  return (
    <AuthLayout
      headline={<>Welcome to<br />BurnettPeople</>}
      text="Your account is now ready. You can log in and start exploring all the features."
    >
      <PasswordSuccessCard />
    </AuthLayout>
  );
}