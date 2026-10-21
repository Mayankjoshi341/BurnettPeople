import { useNavigate } from "react-router-dom";

import AuthLayout from "../components/AuthLayout";
import {
  ForbiddenIllustration,
  NotFoundIllustration,
  ServerErrorIllustration,
} from "../components/ErrorIllustrations";
import {
  ArrowLeftIcon,
  ExternalIcon,
  HelpCircleIcon,
  HomeIcon,
  InfoIcon,
  ShieldLockIcon,
} from "../components/icons";

// Change these two to your real support / help-center addresses.
const SUPPORT_URL = "mailto:support@burnettpeople.com";
const HELP_CENTER_URL = "https://burnettpeople.com/help";

const VARIANTS = {
  404: {
    headline: (
      <>
        People
        <br />
        Build
        <br />
        Tomorrow.
      </>
    ),
    text: "Creating a simpler, smarter and more connected workplace for everyone.",
    Illustration: NotFoundIllustration,
    code: null,
    title: "Page Not Found",
    description: (
      <>
        The page you’re looking for doesn’t exist or may have been moved.
        <br />
        Let’s get you back on track.
      </>
    ),
    tips: null,
    linkLabel: "Visit Help Center",
    linkHref: HELP_CENTER_URL,
  },
  403: {
    headline: (
      <>
        Right People.
        <br />
        Brighter
        <br />
        Tomorrows.
      </>
    ),
    text: "Empowering teams with the tools to grow, collaborate and succeed.",
    Illustration: ForbiddenIllustration,
    code: "403",
    title: "Access Forbidden",
    lead: "You don’t have permission to access this page.",
    description:
      "The page you’re trying to view is restricted, or your account does not have the required permissions.",
    tipIcon: ShieldLockIcon,
    tips: [
      "Make sure you are logged in with the correct account",
      "Check if you have the required role or permissions",
      "If you believe this is a mistake, please contact your administrator or HR team",
    ],
    linkLabel: "Contact Administrator",
    linkHref: SUPPORT_URL,
  },
  500: {
    headline: (
      <>
        People
        <br />
        Build
        <br />
        Tomorrows.
      </>
    ),
    text: "We simplify people operations so your team can focus on what matters.",
    Illustration: ServerErrorIllustration,
    code: "500",
    title: "Internal Server Error",
    description: (
      <>
        Something went wrong on our server.
        <br />
        Our team has been notified and is working to fix the issue.
        <br />
        Please try again later.
      </>
    ),
    tipIcon: InfoIcon,
    tips: [
      "Try again in a few minutes",
      "If the issue persists, contact our support team",
      "You can also go back to the previous page or return to your dashboard",
    ],
    linkLabel: "Contact Support",
    linkHref: SUPPORT_URL,
  },
};

export default function ErrorPage({ status = 404 }) {
  const navigate = useNavigate();
  const view = VARIANTS[status] || VARIANTS[404];
  const { Illustration, tipIcon: TipIcon } = view;

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <AuthLayout headline={view.headline} text={view.text}>
      <div className="bp-error">
        <Illustration />

        {view.code && <div className="bp-error-code">{view.code}</div>}
        <h2 className="bp-error-title">{view.title}</h2>

        {view.lead && <p className="bp-error-lead">{view.lead}</p>}
        <p className="bp-error-text">{view.description}</p>

        {view.tips && (
          <div className="bp-tips">
            <TipIcon className="bp-tips-icon" width={30} height={30} />
            <div>
              <h3>What you can do:</h3>
              <ul>
                {view.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div
          className={`bp-error-actions${status === 404 ? " is-stacked" : ""}`}
        >
          <button
            type="button"
            className="bp-button"
            onClick={() => navigate("/", { replace: true })}
          >
            <HomeIcon width={19} height={19} />
            Go to Dashboard
          </button>

          <button type="button" className="bp-button bp-button-outline" onClick={goBack}>
            <ArrowLeftIcon width={19} height={19} />
            Go Back
          </button>
        </div>

        {status === 404 && (
          <div className="bp-divider">
            <span>or</span>
          </div>
        )}

        <a
          className="bp-link bp-error-link"
          href={view.linkHref}
          target="_blank"
          rel="noreferrer"
        >
          <HelpCircleIcon width={19} height={19} />
          {view.linkLabel}
          <ExternalIcon width={16} height={16} />
        </a>
      </div>
    </AuthLayout>
  );
}
