type FairTeamMarkProps = { size?: number; className?: string }

/**
 * FairTeam's mark: an owl whose beak is a teacher's check. Two eyes side by side (the team), one tick
 * (the work reviewed). Flat colours so it stays legible from the favicon to the landing page.
 */
export default function FairTeamMark({ size = 40, className }: FairTeamMarkProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FairTeam">
    <path d="M3 15C3 8 7 4 13 4c4 0 7 1.6 11 4.4C28 5.6 31 4 35 4c6 0 10 4 10 11v17c0 7.7-5.3 13-13 13H16C8.3 45 3 39.700 3 32V15Z" fill="#0e6676" />
    <circle cx="16" cy="22" r="8.2" fill="#fff" /><circle cx="32" cy="22" r="8.2" fill="#fff" />
    <circle cx="17.8" cy="22.6" r="3.4" fill="#12262b" /><circle cx="30.2" cy="22.6" r="3.4" fill="#12262b" />
    <path d="m18.600 35.200 3.900 3.700 7.400-8.300" fill="none" stroke="#f4d35e" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
