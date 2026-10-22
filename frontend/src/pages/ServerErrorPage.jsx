import ErrorLayout from "../components/ErrorLayout";
import { InfoCircleIcon } from "../components/icons";
import art from "../assets/error-500.png";
import { SUPPORT_EMAIL } from "../config/support";

export default function ServerErrorPage({ user, onReset }) {
  return (
    <ErrorLayout
      user={user}
      onReset={onReset}
      headline={<>People<br />Build<br />Tomorrows.</>}
      text="We simplify people operations so your team can focus on what matters."
      image={art}
      imageAlt="A person holding their head next to a broken server"
      code="500"
      title="Internal Server Error"
      description={
        <>
          Something went wrong on our server.
          <br />
          Our team has been notified and is working to fix the issue.
          <br />
          Please try again later.
        </>
      }
      tipsIcon={<InfoCircleIcon />}
      tips={[
        "Try again in a few minutes.",
        "If the issue persists, contact our support team.",
        "You can also go back to the previous page or return to your dashboard.",
      ]}
      helpLabel="Contact Support"
      helpHref={`mailto:${SUPPORT_EMAIL}`}
    />
  );
}