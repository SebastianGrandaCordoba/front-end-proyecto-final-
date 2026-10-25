type FairTeamMarkProps = { size?: number; className?: string }

/** Original FairTeam symbol: three learners connected around a shared goal. */
export default function FairTeamMark({ size = 40, className }: FairTeamMarkProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FairTeam: aprendizaje en equipo">
    <defs>
      <linearGradient id="fairteam-mark-gradient" x1="5" y1="4" x2="43" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5967cf"/><stop offset="1" stopColor="#8869d5"/>
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="15" fill="url(#fairteam-mark-gradient)"/>
    <path d="M13 19.5c2.9-4.4 6.7-6.6 11-6.6s8.1 2.2 11 6.6M9.7 31.2c1.7-2.5 3.8-3.8 6.3-3.8m16 0c2.5 0 4.6 1.3 6.3 3.8" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="24" cy="19" r="4.05" fill="none" stroke="white" strokeWidth="1.9"/>
    <circle cx="14.9" cy="22" r="3.1" fill="none" stroke="white" strokeWidth="1.7"/>
    <circle cx="33.1" cy="22" r="3.1" fill="none" stroke="white" strokeWidth="1.7"/>
    <path d="M15.2 36v-1.9c0-5.1 3.8-8.6 8.8-8.6s8.8 3.5 8.8 8.6V36H15.2Z" fill="none" stroke="white" strokeWidth="1.9" strokeLinejoin="round"/>
    <path d="m37.3 11.1.75 1.72 1.72.75-1.72.75-.75 1.72-.75-1.72-1.72-.75 1.72-.75.75-1.72Z" fill="#e8e7ff"/>
  </svg>
}
