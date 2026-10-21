import { PASSWORD_RULES } from "./passwordRules";
import {
  CheckCircleIcon,
  EmptyCircleIcon,
  ShieldCheckIcon,
} from "./icons";

export default function PasswordRequirements({ password }) {
  return (
    <div className="bp-requirements" aria-live="polite">
      <ShieldCheckIcon className="bp-requirements-shield" width={26} height={26} />

      <div className="bp-requirements-body">
        <h3>Password Requirements</h3>

        <ul>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password);

            return (
              <li key={rule.id} className={met ? "is-met" : ""}>
                {met ? (
                  <CheckCircleIcon size={17} />
                ) : (
                  <EmptyCircleIcon size={17} />
                )}
                <span>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
