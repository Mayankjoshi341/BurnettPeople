import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "./api/client";
import AuthLayout from "./components/AuthLayout";
import PasswordField from "./components/PasswordField";
import PasswordRequirements from "./components/PasswordRequirements";
import { passwordIsStrong } from "./components/passwordRules";
import { ArrowLeftIcon, LockIcon } from "./components/icons";
import { PasswordSuccessCard } from "./pages/PasswordSuccessPage";

function readInvitationToken() {
  try {
    return new URL(window.location.href).searchParams.get("token") || "";
  } catch {
    return "";
  }
}

function removeInvitationTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // If URL cleanup fails, never log or persist the token.
  }
}

function messagesFrom(error) {
  const fieldErrors = error?.fieldErrors || {};
  const values = Object.values(fieldErrors).flat();

  return values.length
    ? values.join(" ")
    : error?.message ||
        "Account activation failed. Please request a new invitation from HR.";
}

const MISSING_TOKEN_MESSAGE =
  "This activation link is missing its invitation token. Please ask HR to resend the invitation.";

function EmployeeActivation() {
  const navigate = useNavigate();

  // Capture the bearer-like invitation token once, then remove it from the URL.
  const [invitationToken] = useState(readInvitationToken);

  useEffect(() => {
    removeInvitationTokenFromUrl();
  }, []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(
    invitationToken ? "" : MISSING_TOKEN_MESSAGE
  );
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  function handlePasswordChange(value) {
    setPassword(value);
    setError((previous) => (previous === MISSING_TOKEN_MESSAGE ? previous : ""));
  }

  function handleConfirmChange(value) {
    setConfirmPassword(value);
    setError((previous) => (previous === MISSING_TOKEN_MESSAGE ? previous : ""));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!invitationToken) {
      setError(MISSING_TOKEN_MESSAGE);
      return;
    }

    if (!passwordIsStrong(password)) {
      setError("Your password does not meet all the requirements below.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await apiClient.post(
        "/auth/activate/",
        {
          token: invitationToken,
          password,
          password_confirm: confirmPassword,
        },
        { auth: false, skipRefresh: true }
      );

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (requestError) {
      setError(messagesFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  const headline = (
    <>
      Welcome to
      <br />
      BurnettPeople
    </>
  );

  if (success) {
    return (
      <AuthLayout
        headline={headline}
        text="Your account is now ready. You can log in and start exploring all the features."
      >
        <PasswordSuccessCard />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      headline={headline}
      text="Your journey with us starts here. Set up your password to access your account and be part of a better workplace."
    >
      <div className="bp-card">
        <div className="bp-card-badge">
          <LockIcon width={38} height={38} />
        </div>

        <h2 className="bp-card-title">Set Up Your Password</h2>
        <p className="bp-card-subtitle">
          Create a secure password to access your BurnettPeople account.
        </p>

        {error && (
          <div role="alert" className="bp-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <PasswordField
            id="activation-password"
            label="Enter New Password"
            placeholder="Enter your new password"
            value={password}
            onChange={handlePasswordChange}
          />

          <PasswordField
            id="activation-confirm-password"
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={handleConfirmChange}
          />

          <PasswordRequirements password={password} />

          <button
            type="submit"
            className="bp-button"
            disabled={busy || !invitationToken}
          >
            {busy ? "Setting password…" : "Set Your Password"}
          </button>
        </form>

        <button
          type="button"
          className="bp-link bp-back-link"
          onClick={() => navigate("/", { replace: true })}
        >
          <ArrowLeftIcon width={16} height={16} />
          Back to Login
        </button>
      </div>
    </AuthLayout>
  );
}

export default EmployeeActivation;
