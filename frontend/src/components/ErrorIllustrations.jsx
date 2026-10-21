const GREEN = "#0b5d45";
const GREEN_MID = "#2f8f74";
const MINT = "#cfe9df";
const MINT_LIGHT = "#e3f3ec";
const INK = "#16302b";
const RED = "#e5353b";
const SKIN = "#f2c9a5";

function Cloud({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={MINT_LIGHT}>
      <ellipse cx="40" cy="44" rx="40" ry="16" />
      <circle cx="28" cy="30" r="20" />
      <circle cx="58" cy="26" r="24" />
    </g>
  );
}

function Plant({ x, y, scale = 1, flip = false }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}
    >
      <path d="M0 0C-16-10-22-34-14-56 4-44 8-22 0 0Z" fill={GREEN_MID} opacity=".75" />
      <path d="M2 0C14-14 28-26 40-30 38-10 22 6 2 0Z" fill={GREEN_MID} opacity=".55" />
      <path d="M-2 0C-12-6-26-8-36-4-28 8-14 10-2 0Z" fill={GREEN_MID} opacity=".45" />
    </g>
  );
}

function Ground({ width }) {
  return <ellipse cx={width / 2} cy="0" rx={width / 2} ry="9" fill={MINT_LIGHT} />;
}

/* ---------------- 404 ---------------- */

export function NotFoundIllustration() {
  return (
    <svg
      viewBox="0 0 560 270"
      role="img"
      aria-label="A person sitting on a giant 404 next to a signpost"
      className="bp-illustration"
    >
      <Cloud x={50} y={40} scale={1.2} />
      <Cloud x={400} y={60} scale={0.9} />

      <g transform="translate(0 246)">
        <Ground width={560} />
      </g>

      <Plant x={58} y={240} scale={0.9} />
      <Plant x={496} y={242} scale={0.8} flip />

      {/* 404 numerals */}
      <g
        fontFamily="Manrope, DM Sans, sans-serif"
        fontWeight="800"
        fontSize="190"
        textAnchor="middle"
      >
        <text x="148" y="246" fill="#06402f">4</text>
        <text x="143" y="240" fill={GREEN}>4</text>
        <text x="288" y="246" fill="#06402f">0</text>
        <text x="283" y="240" fill={GREEN}>0</text>
        <text x="428" y="246" fill="#06402f">4</text>
        <text x="423" y="240" fill={GREEN}>4</text>
      </g>

      {/* person sitting on the zero */}
      <g transform="translate(262 28)">
        <ellipse cx="30" cy="100" rx="26" ry="8" fill="#06402f" opacity=".0" />
        <path d="M20 66c-8 0-12 8-12 18v6h44v-6c0-10-6-18-14-18Z" fill={GREEN} />
        <rect x="8" y="88" width="46" height="22" rx="10" fill={INK} />
        <rect x="6" y="104" width="22" height="9" rx="4.5" fill="#ffffff" stroke={MINT} />
        <rect x="34" y="104" width="22" height="9" rx="4.5" fill="#ffffff" stroke={MINT} />
        <circle cx="30" cy="48" r="15" fill={SKIN} />
        <path d="M14 46c-1-14 8-22 18-21 9 1 15 8 14 18-6-3-10-9-12-12-3 6-12 11-20 15Z" fill={INK} />
        <path d="M38 62c6 2 10-2 10-8" fill="none" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* thought bubble */}
      <g transform="translate(312 12)">
        <circle cx="22" cy="22" r="22" fill={MINT} opacity=".7" />
        <text
          x="22"
          y="32"
          textAnchor="middle"
          fontFamily="Manrope, sans-serif"
          fontWeight="800"
          fontSize="28"
          fill={GREEN}
        >
          ?
        </text>
      </g>

      {/* signpost */}
      <g transform="translate(486 80)">
        <rect x="-5" y="0" width="12" height="164" rx="5" fill="#8aa89d" />
        <g transform="rotate(-8 -50 28)">
          <path d="M-96 8h94l22 18-22 18h-94Z" fill="#a9c4ba" />
          <text
            x="-52"
            y="33"
            textAnchor="middle"
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fontSize="17"
            fill={GREEN}
          >
            Lost?
          </text>
        </g>
        <g transform="rotate(-8 -50 78)">
          <path d="M-110 56h108l22 18-22 18h-108Z" fill="#a9c4ba" />
          <text
            x="-58"
            y="81"
            textAnchor="middle"
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fontSize="17"
            fill={GREEN}
          >
            This way?
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ---------------- 403 ---------------- */

export function ForbiddenIllustration() {
  return (
    <svg
      viewBox="0 0 560 280"
      role="img"
      aria-label="A person standing in front of a door marked Restricted Access"
      className="bp-illustration"
    >
      <Cloud x={20} y={50} scale={1.1} />
      <Cloud x={420} y={50} scale={1} />

      <g transform="translate(0 262)">
        <Ground width={560} />
      </g>

      <Plant x={130} y={256} scale={1.1} />

      {/* door */}
      <g transform="translate(318 8)">
        <path d="M-6 0h160v250H-6Z" fill="#dcefe7" />
        <rect x="8" y="12" width="132" height="238" fill={MINT} />
        <rect x="8" y="12" width="132" height="238" fill="none" stroke="#b6d6ca" strokeWidth="3" />

        <rect x="38" y="44" width="72" height="74" rx="10" fill="#f4faf7" />
        <circle cx="74" cy="80" r="26" fill={RED} />
        <rect x="58" y="75" width="32" height="10" rx="5" fill="#ffffff" />

        <rect x="30" y="128" width="88" height="40" rx="8" fill="#f4faf7" />
        <text
          x="74"
          y="146"
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontWeight="600"
          fontSize="12"
          fill={INK}
        >
          Restricted
        </text>
        <text
          x="74"
          y="161"
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontWeight="600"
          fontSize="12"
          fill={INK}
        >
          Access
        </text>

        <rect x="124" y="140" width="9" height="34" rx="4.5" fill="#a9c4ba" />
      </g>

      {/* person standing, seen from behind */}
      <g transform="translate(250 54)">
        <circle cx="30" cy="22" r="17" fill={SKIN} />
        <path d="M12 22c-2-16 8-26 20-25 11 1 18 10 16 22-6-3-12-9-14-13-4 8-14 13-22 16Z" fill={INK} />
        <path d="M10 62c0-12 8-20 20-20s20 8 20 20v66H10Z" fill={GREEN} />
        <rect x="2" y="62" width="14" height="58" rx="7" fill={GREEN} />
        <rect x="44" y="62" width="14" height="58" rx="7" fill={GREEN} />
        <rect x="10" y="124" width="21" height="82" rx="6" fill={INK} />
        <rect x="29" y="124" width="21" height="82" rx="6" fill={INK} />
        <rect x="4" y="200" width="28" height="10" rx="5" fill="#ffffff" stroke={MINT} />
        <rect x="28" y="200" width="28" height="10" rx="5" fill="#ffffff" stroke={MINT} />
      </g>
    </svg>
  );
}

/* ---------------- 500 ---------------- */

function Server({ y, lights }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x="0" y="0" width="190" height="52" rx="8" fill="#31453f" />
      <rect x="0" y="0" width="190" height="6" rx="3" fill="#425a53" />
      <circle cx="22" cy="28" r="5" fill={lights[0]} />
      <circle cx="42" cy="28" r="5" fill={lights[1]} />
      <rect x="110" y="21" width="56" height="5" rx="2.5" fill="#55726a" />
      <rect x="110" y="31" width="56" height="5" rx="2.5" fill="#55726a" />
    </g>
  );
}

export function ServerErrorIllustration() {
  const ok = "#5fcf9f";

  return (
    <svg
      viewBox="0 0 560 280"
      role="img"
      aria-label="A worried person sitting next to a broken server"
      className="bp-illustration"
    >
      <Cloud x={20} y={60} scale={1.1} />
      <Cloud x={400} y={20} scale={1.2} />

      <g transform="translate(0 262)">
        <Ground width={560} />
      </g>

      <Plant x={60} y={252} scale={1} />
      <Plant x={506} y={252} scale={0.9} flip />

      {/* server stack */}
      <g transform="translate(286 66)">
        <Server y={0} lights={[ok, RED]} />
        <Server y={56} lights={[RED, RED]} />
        <Server y={112} lights={[RED, ok]} />
        <g transform="translate(150 -32)">
          <circle cx="0" cy="0" r="30" fill={RED} />
          <path
            d="m-11-11 22 22m0-22-22 22"
            stroke="#ffffff"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* laptop */}
      <path d="M240 244l14-34h44l8 34Z" fill="#31453f" />

      {/* person sitting, hand on head */}
      <g transform="translate(150 70)">
        <circle cx="62" cy="34" r="19" fill={SKIN} />
        <path d="M42 32c-3-18 10-28 23-26 12 2 19 12 17 26-8-3-14-9-17-14-5 9-14 14-23 14Z" fill={INK} />
        <path d="M30 62c-14 12-18 40-14 70l60 4c10-26 14-52 4-70-8-10-34-12-50-4Z" fill={GREEN} />
        <path d="M82 64c14-4 14-18 2-28" fill="none" stroke={GREEN} strokeWidth="14" strokeLinecap="round" />
        <circle cx="82" cy="34" r="7" fill={SKIN} />
        <path d="M30 134c26 4 60 4 86 0l-6 28H34Z" fill={INK} />
        <path d="M104 150l36 28" stroke={INK} strokeWidth="22" strokeLinecap="round" />
        <rect x="116" y="168" width="52" height="14" rx="7" fill="#ffffff" stroke={MINT} />
        <rect x="20" y="168" width="52" height="14" rx="7" fill="#ffffff" stroke={MINT} />
      </g>

      {/* confused marks */}
      <g
        fontFamily="Manrope, sans-serif"
        fontWeight="800"
        fill="#5a7a70"
      >
        <text x="168" y="62" fontSize="26">?</text>
        <text x="200" y="46" fontSize="34">?</text>
        <text x="236" y="64" fontSize="26">?</text>
      </g>
    </svg>
  );
}
