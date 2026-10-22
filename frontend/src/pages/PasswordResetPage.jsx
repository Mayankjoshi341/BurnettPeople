import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../api/client";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import PasswordRequirements from "../components/PasswordRequirements";
import { passwordIsStrong } from "../components/passwordRules";
import { ArrowLeftIcon, LockIcon, MailIcon } from "../components/icons";
import { PasswordSuccessCard } from "./PasswordSuccessPage";

const RESEND_SECONDS = 30;
const headline = <>Welcome to<br />BurnettPeople</>;

function messagesFrom(error, fallback) {
  const values = Object.values(error?.fieldErrors || {}).flat();
  return values.length ? values.join(" ") : error?.message || fallback;
}

export default function PasswordResetPage() {
  const navigate = useNavigate();

  const [stage, setStage] = useState("request"); // request -> confirm -> success
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Tick the "Resend Code" cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode({ resend = false } = {}) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiClient.post(
        "/auth/password-reset/request/",
        { email: email.trim() },
        { auth: false, skipRefresh: true }
      );
      setNotice(
        result?.detail ||
          (resend
            ? "A new code has been sent if an active account exists."
            : "If an active account exists, a reset code will be sent.")
      );
      setCooldown(RESEND_SECONDS);
      setStage("confirm");
    } catch (requestError) {
      setError(messagesFrom(requestError, "Could not request a password reset."));
    } finally {
      setBusy(false);
    }
  }

  function handleRequest(event) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Please enter your work email.");
      return;
    }
    sendCode();
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    if (!passwordIsStrong(password)) {
      setError("Your password does not meet all the requirements below.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await apiClient.post(
        "/auth/password-reset/confirm/",
        {
          email: email.trim(),
          code: code.trim(),
          password,
          password_confirm: confirmPassword,
        },
        { auth: false, skipRefresh: true }
      );
      setPassword("");
      setConfirmPassword("");
      setCode("");
      setStage("success");
    } catch (requestError) {
      setError(messagesFrom(requestError, "Could not reset the password."));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "success") {
    return (
      <AuthLayout
        headline={headline}
        text="Your account is now ready. You can log in and start exploring all the features."
      >
        <PasswordSuccessCard
          title="Password Reset Successfully!"
          message="Your password has been updated. You can now log in to your BurnettPeople account using your new password."
        />
      </AuthLayout>
    );
  }

  const backToLogin = (
    <button type="button" className="bp-link bp-back-link" onClick={() => navigate("/", { replace: true })}>
      <ArrowLeftIcon width={16} height={16} /> Back to Login
    </button>
  );

  return (
    <AuthLayout
      headline={headline}
      text="Reset your password to regain access to your account and continue your journey with us."
    >
      <div className="bp-card">
        <div className="bp-card-badge"><LockIcon width={38} height={38} /></div>

        {stage === "request" ? (
          <>
            <h2 className="bp-card-title">Forgot Your Password?</h2>
            <p className="bp-card-subtitle">
              Enter your work email and we&rsquo;ll send a 6-digit code if an active account matches it.
            </p>

            {error && <div role="alert" className="bp-alert">{error}</div>}

            <form onSubmit={handleRequest} noValidate>
              <div className="bp-field">
                <label className="bp-label" htmlFor="reset-email">Work Email</label>
                <div className="bp-input-wrap">
                  <MailIcon className="bp-input-icon" width={20} height={20} />
                  <input
                    id="reset-email"
                    className="bp-input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>
              <button type="submit" className="bp-button" disabled={busy}>
                {busy ? "Sending…" : "Send Reset Code"}
              </button>
            </form>
            {backToLogin}
          </>
        ) : (
          <>
            <h2 className="bp-card-title">Reset Your Password</h2>
            <p className="bp-card-subtitle">
              Enter the 6-digit code sent to your email and set a new password for your BurnettPeople account.
            </p>

            {notice && <div role="status" className="bp-notice">{notice}</div>}
            {error && <div role="alert" className="bp-alert">{error}</div>}

            <form onSubmit={handleConfirm} noValidate>
              <div className="bp-field">
                <label className="bp-label" htmlFor="reset-code">6-Digit Code</label>
                <div className="bp-input-wrap">
                  <MailIcon className="bp-input-icon" width={20} height={20} />
                  <input
                    id="reset-code"
                    className="bp-input"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="Enter the 6-digit code"
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    className="bp-link bp-resend"
                    onClick={() => sendCode({ resend: true })}
                    disabled={busy || cooldown > 0}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                  </button>
                </div>
              </div>

              <PasswordField
                id="reset-password"
                label="New Password"
                placeholder="Enter your new password"
                value={password}
                onChange={setPassword}
              />
              <PasswordField
                id="reset-password-confirm"
                label="Confirm New Password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />

              <PasswordRequirements password={password} />

              <button type="submit" className="bp-button" disabled={busy}>
                {busy ? "Resetting…" : "Reset Password"}
              </button>
            </form>

            <button
              type="button"
              className="bp-link bp-back-link"
              onClick={() => { setStage("request"); setError(""); setNotice(""); }}
            >
              <ArrowLeftIcon width={16} height={16} /> Use a different email
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}