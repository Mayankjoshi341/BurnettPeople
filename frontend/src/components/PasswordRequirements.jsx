import { PASSWORD_RULES } from "./passwordRules";
import { CheckCircleFilledIcon, CircleIcon, ShieldCheckIcon } from "./icons";

/* Live checklist: a rule turns green as soon as the typed password satisfies it. */
export default function PasswordRequirements({ password = "" }) {
  return (
    <div className="bp-requirements">
      <ShieldCheckIcon className="bp-requirements-icon" width={30} height={30} />
      <div>
        <h3>Password Requirements</h3>
        <ul>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li key={rule.id} className={met ? "met" : ""}>
                {met ? <CheckCircleFilledIcon /> : <CircleIcon />}
                <span>{rule.label}</span>
                <span className="bp-sr-only">{met ? " (done)" : " (not done yet)"}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}