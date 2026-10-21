import { useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import { ArrowRightIcon, CheckIcon, UserIcon } from "../components/icons";

export function PasswordSuccessCard() {
  const navigate = useNavigate();

  return (
    <div className="bp-card bp-card-success">
      <div className="bp-success-badge" aria-hidden="true">
        <span className="bp-confetti c1" />
        <span className="bp-confetti c2" />
        <span className="bp-confetti c3" />
        <span className="bp-confetti c4" />
        <span className="bp-confetti c5" />
        <div className="bp-success-circle">
          <CheckIcon width={44} height={44} />
        </div>
      </div>

      <h2 className="bp-card-title">Password Set Successfully!</h2>
      <p className="bp-card-subtitle">
        Your password has been created successfully.
        <br />
        You can now log in to your BurnettPeople account using your new
        password.
      </p>

      <div className="bp-note">
        <div className="bp-note-icon">
          <UserIcon width={22} height={22} />
        </div>
        <div>
          <strong>Your Account is Ready</strong>
          <p>
            You now have full access to your BurnettPeople account. Please
            keep your password secure.
          </p>
        </div>
      </div>

      <button
        type="button"
        className="bp-button"
        onClick={() => navigate("/", { replace: true })}
      >
        Go to Login Page
        <ArrowRightIcon width={19} height={19} />
      </button>
    </div>
  );
}

export default function PasswordSuccessPage() {
  return (
    <AuthLayout
      headline={
        <>
          Welcome to
          <br />
          BurnettPeople
        </>
      }
      text="Your account is now ready. You can log in and start exploring all the features."
    >
      <PasswordSuccessCard />
    </AuthLayout>
  );
}
