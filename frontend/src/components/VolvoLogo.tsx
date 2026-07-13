/* Volvo Logo SVG — authentic iron-mark badge */
export function VolvoLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* ── Outer ring gradient (dark chrome) ── */}
      <defs>
        <radialGradient id="vring" cx="38%" cy="32%" r="70%">
          <stop offset="0%"   stopColor="#D4D6DB" />
          <stop offset="45%"  stopColor="#8E9095" />
          <stop offset="100%" stopColor="#2A2B2E" />
        </radialGradient>
        <radialGradient id="vfill" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#232427" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <linearGradient id="varrow" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#8E9095" />
          <stop offset="50%"  stopColor="#F4F5F7" />
          <stop offset="100%" stopColor="#B7B9BE" />
        </linearGradient>
        {/* Light theme versions */}
        <radialGradient id="vring-l" cx="38%" cy="32%" r="70%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="45%"  stopColor="#C7C9CF" />
          <stop offset="100%" stopColor="#33353A" />
        </radialGradient>
        <radialGradient id="vfill-l" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8E9EC" />
        </radialGradient>
        <linearGradient id="varrow-l" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#33353A" />
          <stop offset="50%"  stopColor="#111214" />
          <stop offset="100%" stopColor="#6B6D73" />
        </linearGradient>
      </defs>

      {/* ── Outer chrome border ring ── */}
      <circle cx="50" cy="50" r="48" fill="url(#vring)" />

      {/* ── Inner filled disc ── */}
      <circle cx="50" cy="50" r="41" fill="url(#vfill)" />

      {/* ── Diagonal iron-mark bar (top-left to bottom-right of circle) ── */}
      {/* This is the authentic Volvo "iron" / Mars symbol diagonal  */}
      <line
        x1="24" y1="76"
        x2="76" y2="24"
        stroke="url(#varrow)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* Arrow head at top-right end */}
      <polyline
        points="60,18 76,24 70,40"
        fill="none"
        stroke="url(#varrow)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── VOLVO wordmark inside ring ── */}
      <text
        x="50"
        y="57"
        textAnchor="middle"
        fontFamily="'DM Sans', 'Inter', Arial, sans-serif"
        fontSize="13.5"
        fontWeight="800"
        letterSpacing="3.5"
        fill="url(#varrow)"
      >
        VOLVO
      </text>
    </svg>
  );
}

/* Light-theme variant — same structure, alternate gradient IDs */
export function VolvoLogoLight({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="vring2" cx="38%" cy="32%" r="70%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="45%"  stopColor="#C7C9CF" />
          <stop offset="100%" stopColor="#33353A" />
        </radialGradient>
        <radialGradient id="vfill2" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8E9EC" />
        </radialGradient>
        <linearGradient id="varrow2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#33353A" />
          <stop offset="50%"  stopColor="#111214" />
          <stop offset="100%" stopColor="#6B6D73" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#vring2)" />
      <circle cx="50" cy="50" r="41" fill="url(#vfill2)" />
      <line x1="24" y1="76" x2="76" y2="24" stroke="url(#varrow2)" strokeWidth="5.5" strokeLinecap="round"/>
      <polyline points="60,18 76,24 70,40" fill="none" stroke="url(#varrow2)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="50" y="57" textAnchor="middle" fontFamily="'DM Sans', 'Inter', Arial, sans-serif" fontSize="13.5" fontWeight="800" letterSpacing="3.5" fill="url(#varrow2)">
        VOLVO
      </text>
    </svg>
  );
}
