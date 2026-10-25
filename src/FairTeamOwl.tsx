/** Original FairTeam mascot illustration, drawn as responsive vector artwork. */
export default function FairTeamOwl() {
  return <svg className="landing-owl-svg" viewBox="0 0 520 490" role="img" aria-label="Búho profesor de FairTeam, listo para ayudar a revisar el aprendizaje">
    <defs>
      <linearGradient id="owlBody" x1="128" y1="120" x2="380" y2="396" gradientUnits="userSpaceOnUse"><stop stopColor="#2789A1"/><stop offset="1" stopColor="#155F7C"/></linearGradient>
      <linearGradient id="owlWing" x1="130" y1="240" x2="220" y2="350" gradientUnits="userSpaceOnUse"><stop stopColor="#80C1CC"/><stop offset="1" stopColor="#3F8FA5"/></linearGradient>
      <linearGradient id="owlBook" x1="118" y1="374" x2="402" y2="449" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#E7F3F4"/></linearGradient>
      <filter id="owlShadow" x="60" y="50" width="410" height="420" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="20" stdDeviation="16" floodColor="#16465A" floodOpacity=".16"/></filter>
    </defs>
    <ellipse cx="263" cy="444" rx="173" ry="24" fill="#16465A" opacity=".08"/>
    <g className="owl-float" filter="url(#owlShadow)">
      <path d="M131 179 110 105c-3-12 9-20 19-12l67 52m213 34 21-74c3-12-9-20-19-12l-67 52" fill="#267F94" stroke="#15566D" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M144 161c9-53 48-87 116-87s107 34 116 87l13 135c4 48-19 88-64 112l-65 31-65-31c-45-24-68-64-64-112l13-135Z" fill="url(#owlBody)" stroke="#15566D" strokeWidth="4"/>
      <path d="M143 233c-39 7-59 37-56 75 2 28 20 49 51 55l29-37m210-93c39 7 59 37 56 75-2 28-20 49-51 55l-29-37" fill="url(#owlWing)" stroke="#15566D" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M168 208c0-38 26-65 59-65 21 0 37 11 45 28 8-17 24-28 45-28 33 0 59 27 59 65 0 45-33 74-104 74s-104-29-104-74Z" fill="#F9F8F4"/>
      <circle cx="222" cy="207" r="31" fill="white" stroke="#CDE3E6" strokeWidth="5"/><circle cx="322" cy="207" r="31" fill="white" stroke="#CDE3E6" strokeWidth="5"/>
      <circle cx="228" cy="209" r="11" fill="#163B4C"/><circle cx="316" cy="209" r="11" fill="#163B4C"/><circle cx="231" cy="205" r="3.5" fill="white"/><circle cx="319" cy="205" r="3.5" fill="white"/>
      <path d="m272 228-17 22h34l-17-22Z" fill="#E6A84B" stroke="#CE8B39" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M189 311c28-16 58-20 83-20s55 4 83 20l-15 87-68 37-68-37-15-87Z" fill="#F7F5EF"/>
      <path d="M196 333c22 8 48 12 76 12s54-4 76-12" fill="none" stroke="#CDE3E6" strokeWidth="4" strokeLinecap="round"/>
      <path d="m229 367 43 16 43-16v52l-43 22-43-22v-52Z" fill="#287F91"/>
      <path d="m272 383 43-16v52l-43 22v-58Z" fill="#3B97A6"/><path d="m272 383-43-16v52l43 22v-58Z" fill="#1B687D"/>
      <path d="m193 93 79-43 79 43-79 38-79-38Z" fill="#18394C" stroke="#102D3E" strokeWidth="4" strokeLinejoin="round"/>
      <path d="M226 109v27c0 19 20 29 46 29s46-10 46-29v-27" fill="#24627A" stroke="#18394C" strokeWidth="4"/>
      <path d="M193 93v40" stroke="#E8B354" strokeWidth="5" strokeLinecap="round"/><circle cx="193" cy="139" r="7" fill="#E8B354"/>
      <path d="m135 374 108 40 29-11 29 11 108-40v62l-108 39-29-11-29 11-108-39v-62Z" fill="url(#owlBook)" stroke="#D8DBEB" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M272 403v61m0-61-29 11v62m29-62 29 11v62" fill="none" stroke="#BED7DB" strokeWidth="3"/>
      <path d="m384 142 5 12 12 5-12 5-5 12-5-12-12-5 12-5 5-12Zm-253 79 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" fill="#F1C96C"/>
    </g>
    <g className="owl-note-pill"><rect x="351" y="307" width="129" height="48" rx="16" fill="white" stroke="#D9E5E8"/><circle cx="373" cy="331" r="7" fill="#167D83"/><path d="m370 331 2 2 4-5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><text x="389" y="335" fill="#17394A" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700">Aprendizaje</text></g>
  </svg>
}
