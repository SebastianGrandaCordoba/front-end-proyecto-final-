/** Original FairTeam owl, drawn in code so it stays crisp, light and on-brand. */
export type OwlPose = 'wave' | 'read' | 'think'

const ink = '#14394a', teal = '#1d7a90', tealDark = '#155b6f', cream = '#fbf8f1', gold = '#e3a848'

export default function Owl({ pose = 'wave', size = 160, className = '' }: { pose?: OwlPose; size?: number; className?: string }) {
  return <svg className={`owl owl-${pose} ${className}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-hidden="true">
    <ellipse cx="100" cy="186" rx="54" ry="7" fill={ink} opacity=".08" />
    <g className="owl-body">
      <path d="M58 66 46 34c-2-6 4-10 9-6l26 20m61 18 12-32c2-6-4-10-9-6l-26 20" fill={teal} stroke={tealDark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M56 70c4-24 22-38 44-38s40 14 44 38l6 60c2 24-12 42-34 50l-16 6-16-6c-22-8-36-26-34-50l6-60Z" fill={teal} stroke={tealDark} strokeWidth="3" />
      <path d="M70 120c8-6 18-9 30-9s22 3 30 9l-4 40-26 12-26-12-4-40Z" fill={cream} />
      <path d="M74 132c8 3 17 4 26 4s18-1 26-4M78 146c7 2 14 3 22 3s15-1 22-3" fill="none" stroke="#d9e8ea" strokeWidth="3" strokeLinecap="round" />
      <path d="M64 84c0-15 10-26 23-26 7 0 12 3 13 9 1-6 6-9 13-9 13 0 23 11 23 26 0 18-14 30-36 30S64 102 64 84Z" fill={cream} />
      <circle cx="84" cy="84" r="12" fill="#fff" stroke="#d6e6e8" strokeWidth="2" /><circle cx="116" cy="84" r="12" fill="#fff" stroke="#d6e6e8" strokeWidth="2" />
      <g className="owl-eyes"><circle cx="86" cy="85" r="5" fill={ink} /><circle cx="114" cy="85" r="5" fill={ink} /><circle cx="87.5" cy="83" r="1.6" fill="#fff" /><circle cx="115.5" cy="83" r="1.6" fill="#fff" /></g>
      <path d="m100 94-6 8h12l-6-8Z" fill={gold} stroke="#c98a35" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m70 36 30-16 30 16-30 15-30-15Z" fill={ink} /><path d="M83 42v9c0 6 8 10 17 10s17-4 17-10v-9" fill="#1f5468" /><path d="M70 36v15" stroke={gold} strokeWidth="2.5" strokeLinecap="round" /><circle cx="70" cy="54" r="3" fill={gold} />
    </g>
    {pose === 'wave' && <g className="owl-wave"><path d="M146 112c14-6 24-18 26-34 1-6-6-9-9-4-6 10-13 18-24 22" fill={teal} stroke={tealDark} strokeWidth="3" strokeLinejoin="round" /><path d="M54 112c-10 4-16 14-16 26 0 6 7 8 10 3 4-7 9-12 16-15" fill={teal} stroke={tealDark} strokeWidth="3" strokeLinejoin="round" /></g>}
    {pose === 'read' && <g className="owl-read"><path d="M58 150l42 12 42-12v26l-42 12-42-12v-26Z" fill="#fff" stroke="#cfe0e3" strokeWidth="2.5" strokeLinejoin="round" /><path d="M100 162v26" stroke="#cfe0e3" strokeWidth="2.5" /><path d="M70 160l20 5M70 168l20 5M110 165l20-5M110 173l20-5" stroke="#d9e8ea" strokeWidth="2" strokeLinecap="round" /><path d="M54 126c-6 10-6 22 2 30M146 126c6 10 6 22-2 30" fill="none" stroke={tealDark} strokeWidth="3" strokeLinecap="round" /></g>}
    {pose === 'think' && <g className="owl-think"><circle cx="158" cy="44" r="5" fill="#d6e8eb" /><circle cx="170" cy="28" r="8" fill="#d6e8eb" /><g className="owl-sparkles"><path d="m40 52 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill={gold} /><path d="m160 92 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill={gold} /></g><path d="M146 116c8 4 10 14 4 20-4 4-12 2-14-4" fill={teal} stroke={tealDark} strokeWidth="3" strokeLinejoin="round" /></g>}
  </svg>
}
