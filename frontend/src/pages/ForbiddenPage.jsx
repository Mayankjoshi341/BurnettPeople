import ErrorLayout from "../components/ErrorLayout";
import { ShieldLockIcon } from "../components/icons";
import art from "../assets/error-403.png";
import { ADMIN_EMAIL } from "../config/support";

export default function ForbiddenPage({ user }) {
  return (
    <ErrorLayout
      user={user}
      headline={<>Right People.<br />Brighter<br />Tomorrows.</>}
      text="Empowering teams with the tools to grow, collaborate and succeed."
      image={art}
      imageAlt="A person standing in front of a door marked Restricted Access"
      code="403"
      title="Access Forbidden"
      description={
        <>
          <strong>You don&rsquo;t have permission to access this page.</strong>
          <br />
          The page you&rsquo;re trying to view is restricted, or your account does not have the required permissions.
        </>
      }
      tipsIcon={<ShieldLockIcon width={34} height={34} />}
      tips={[
        "Make sure you are logged in with the correct account",
        "Check if you have the required role or permissions",
        "If you believe this is a mistake, please contact your administrator or HR team",
      ]}
      helpLabel="Contact Administrator"
      helpHref={`mailto:${ADMIN_EMAIL}`}
    />
  );
}