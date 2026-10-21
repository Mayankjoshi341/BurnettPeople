import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import PasswordRequirements from "../components/PasswordRequirements";
import { passwordIsStrong } from "../components/passwordRules";
import { ArrowLeftIcon, LockIcon, MailIcon } from "../components/icons";
import { PasswordSuccessCard } from "./PasswordSuccessPage";
import apiClient from "../api/client";

const REQUEST_ENDPOINT = "/auth/password-reset/request/";
const CONFIRM_ENDPOINT = "/auth/password-reset/confirm/";

export default function PasswordResetPage() {
  const navigate = useNavigate();

  const [stage, setStage] = useState("request"); // request | confirm | success
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendCode() {
    const result = await apiClient.post(
      REQUEST_ENDPOINT,
      { email: email.trim() },
      { auth: false, skipRefresh: true }
    );

    return (
      result?.detail ||
      "If an active account exists, a reset code will be sent."
    );
  }

  async function handleRequest(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      setMessage(await sendCode());
      setStage("confirm");
    } catch (requestError) {
      setError(requestError?.message || "Could not request a password reset.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      setMessage(await sendCode());
    } catch (requestError) {
      setError(requestError?.message || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!passwordIsStrong(password)) {
      setError("Your password does not meet all the requirements below.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await apiClient.post(
        CONFIRM_ENDPOINT,
        {
          email: email.trim(),
          code: code.trim(),
          password,
          password_confirm: passwordConfirm,
        },
        { auth: false, skipRefresh: true }
      );

      setPassword("");
      setPasswordConfirm("");
      setCode("");
      setStage("success");
    } catch (requestError) {
      const fieldMessages = Object.values(requestError?.fieldErrors || {}).flat();

      setError(
        fieldMessages.join(" ") ||
          requestError?.message ||
          "Could not reset the password."
      );
    } finally {
      setBusy(false);
    }
  }

  if (stage === "success") {
    return (
      <AuthLayout
        headline={
          <>
            Welcome to
            <br />
            BurnettPeople
          </>
        }
        text="Your password has been reset. You can log in and continue your journey with us."
      >
        <PasswordSuccessCard />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      headline={
        <>
          Welcome to
          <br />
          BurnettPeople
        </>
      }
      text="Reset your password to regain access to your account and continue your journey with us."
    >
      <div className="bp-card">
        <div className="bp-card-badge">
          <LockIcon width={38} height={38} />
        </div>

        <h2 className="bp-card-title">Reset Your Password</h2>
        <p className="bp-card-subtitle">
          {stage === "request"
            ? "Enter your work email and we’ll send a 6-digit code if an active account matches."
            : "Enter the 6-digit code sent to your email and set a new password for your BurnettPeople account."}
        </p>

        {message && (
          <div role="status" className="bp-alert bp-alert-success">
            {message}
          </div>
        )}

        {error && (
          <div role="alert" className="bp-alert">
            {error}
          </div>
        )}

        {stage === "request" && (
          <form onSubmit={handleRequest}>
            <div className="bp-field">
              <label htmlFor="reset-email">Work Email</label>
              <div className="bp-input">
                <MailIcon className="bp-input-icon" />
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button type="submit" className="bp-button" disabled={busy}>
              {busy ? "Sending…" : "Send Reset Code"}
            </button>
          </form>
        )}

        {stage === "confirm" && (
          <form onSubmit={handleConfirm} noValidate>
            <div className="bp-field">
              <label htmlFor="reset-code">6-Digit Code</label>
              <div className="bp-input">
                <MailIcon className="bp-input-icon" />
                <input
                  id="reset-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter the 6-digit code"
                  autoComplete="one-time-code"
                  required
                />
                <button
                  type="button"
                  className="bp-link bp-inline-link"
                  onClick={handleResend}
                  disabled={busy}
                >
                  Resend Code
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
              value={passwordConfirm}
              onChange={setPasswordConfirm}
            />

            <PasswordRequirements password={password} />

            <button type="submit" className="bp-button" disabled={busy}>
              {busy ? "Updating…" : "Reset Password"}
            </button>
          </form>
        )}

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
