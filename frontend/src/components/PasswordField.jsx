import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="bp-field">
      <label htmlFor={id}>{label}</label>

      <div className="bp-input">
        <LockIcon className="bp-input-icon" />

        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />

        <button
          type="button"
          className="bp-input-action"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
    </div>
  );
}
