import { Fragment } from 'react'

/** Splits AI text into prose and ``` fenced code so starter code keeps its indentation and can be copied. */
export function splitFences(text: string): { kind: 'text' | 'code'; value: string; lang?: string }[] {
  const parts: { kind: 'text' | 'code'; value: string; lang?: string }[] = []
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g
  let last = 0
  for (const match of text.matchAll(fence)) {
    const before = text.slice(last, match.index).trim()
    if (before) parts.push({ kind: 'text', value: before })
    parts.push({ kind: 'code', value: match[2].replace(/\n$/, ''), lang: match[1] || undefined })
    last = (match.index ?? 0) + match[0].length
  }
  const rest = text.slice(last).trim()
  if (rest) parts.push({ kind: 'text', value: rest })
  return parts
}

export function RichText({ text }: { text: string }) {
  return <>{splitFences(text).map((part, i) => <Fragment key={i}>
    {part.kind === 'code'
      ? <pre className="code-block" aria-label={part.lang ? `Código ${part.lang}` : 'Código'}>{part.lang && <span className="code-lang">{part.lang}</span>}<code>{part.value}</code></pre>
      : <p>{part.value}</p>}
  </Fragment>)}</>
}
