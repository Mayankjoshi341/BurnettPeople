import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";

/* Password input with a lock icon and a show/hide eye button.
   onChange receives the new VALUE (a string), not the event. */
export default function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoComplete = "new-password",
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="bp-field">
      <label className="bp-label" htmlFor={id}>{label}</label>
      <div className="bp-input-wrap">
        <LockIcon className="bp-input-icon" width={20} height={20} />
        <input
          id={id}
          className="bp-input"
          type={visible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          className="bp-eye"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeIcon width={20} height={20} /> : <EyeOffIcon width={20} height={20} />}
        </button>
      </div>
    </div>
  );
}