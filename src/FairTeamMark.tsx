type FairTeamMarkProps = { size?: number; className?: string }

/** Original FairTeam owl mark: a thoughtful teacher's owl with a graduation cap. */
export default function FairTeamMark({ size = 40, className }: FairTeamMarkProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FairTeam: aprendizaje en equipo">
    <defs>
      <linearGradient id="fairteam-mark-gradient" x1="5" y1="4" x2="43" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#187F94"/><stop offset="1" stopColor="#155B78"/>
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="15" fill="url(#fairteam-mark-gradient)"/>
    <path d="m13 13.5 11-6 11 6-11 5.7-11-5.7Z" fill="#e6f5f5" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M19 16.6v3c0 2.3 2.2 3.6 5 3.6s5-1.3 5-3.6v-3" fill="none" stroke="white" strokeWidth="1.5"/>
    <path d="M14.5 22.5c.6-6.7 4.3-10.5 9.5-10.5s8.9 3.8 9.5 10.5c.3 4.5-1 8.7-3.9 11.2L24 38l-5.6-4.3c-2.9-2.5-4.2-6.7-3.9-11.2Z" fill="url(#fairteam-mark-gradient)" stroke="white" strokeWidth="1.7" strokeLinejoin="round"/>
    <circle cx="20.1" cy="24.8" r="4" fill="#fff"/><circle cx="27.9" cy="24.8" r="4" fill="#fff"/>
    <circle cx="20.4" cy="24.8" r="1.5" fill="#14394a"/><circle cx="27.6" cy="24.8" r="1.5" fill="#14394a"/>
    <path d="M20.2 24.8h7.6M24 27.2l-2.1 2.5h4.2L24 27.2Z" fill="none" stroke="#d9a745" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18 33.2 24 37l6-3.8" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
}
