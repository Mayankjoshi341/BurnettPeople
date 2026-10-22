import ErrorLayout from "../components/ErrorLayout";
import art from "../assets/error-404.png";
import { HELP_CENTER_URL } from "../config/support";

export default function NotFoundPage({ user }) {
  return (
    <ErrorLayout
      user={user}
      headline={<>People<br />Build<br />Tomorrow.</>}
      text="Creating a simpler, smarter and more connected workplace for everyone."
      image={art}
      imageAlt="A person sitting on a large 404 next to a signpost reading Lost? This way?"
      title="Page Not Found"
      description={<>The page you&rsquo;re looking for doesn&rsquo;t exist or may have been moved.<br />Let&rsquo;s get you back on track.</>}
      stacked
      showOr
      helpLabel="Visit Help Center"
      helpHref={HELP_CENTER_URL}
    />
  );
}