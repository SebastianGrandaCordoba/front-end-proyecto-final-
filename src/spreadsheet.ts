export type ImportKind = 'roster' | 'grades'

const headerAliases: Record<ImportKind, Record<string, string>> = {
  roster: {
    name: 'name', nombre: 'name', estudiante: 'name', student: 'name', studentname: 'name',
    nombrecompleto: 'name', nombresyapellidos: 'name',
    email: 'email', correo: 'email', correoelectronico: 'email', studentemail: 'email',
    academiclevel: 'academicLevel', nivel: 'academicLevel', nivelacademico: 'academicLevel',
  },
  grades: {
    studentname: 'studentName', nombre: 'studentName', estudiante: 'studentName', alumno: 'studentName',
    nombrecompleto: 'studentName', nombresyapellidos: 'studentName',
    studentemail: 'studentEmail', correo: 'studentEmail', correoelectronico: 'studentEmail', email: 'studentEmail',
    correoestudiante: 'studentEmail', studentid: 'studentId', idestudiante: 'studentId', codigoestudiante: 'studentId',
    subject: 'subject', materia: 'subject', asignatura: 'subject', tema: 'subject', subjectid: 'subjectId', idmateria: 'subjectId',
    grade: 'grade', nota: 'grade', notafinal: 'grade', calificacion: 'grade',
    period: 'period', periodo: 'period', corte: 'period', semestre: 'period', ciclo: 'period',
  },
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export async function normalizeSpreadsheetRows(rows: unknown[][], kind: ImportKind): Promise<string> {
  // Lazy-load SheetJS only when the teacher actually imports a spreadsheet.
  const XLSX = await import('xlsx')
  if (rows.length < 2) throw new Error('El archivo debe tener encabezados y al menos una fila de datos.')
  const sourceHeaders = rows[0].map(normalizeHeader)
  const aliases = headerAliases[kind]
  const outputHeaders = sourceHeaders.map(header => aliases[header] || header)
  const required = kind === 'roster' ? ['name'] : ['grade', 'period']
  const hasStudentId = kind === 'roster'
    ? outputHeaders.includes('name')
    : outputHeaders.some(header => STUDENT_COLUMNS.has(header))
  if (required.some(header => !outputHeaders.includes(header))
      || (kind === 'grades' && !outputHeaders.some(header => ['subject', 'subjectId'].includes(header)))
      || !hasStudentId) {
    const expected = kind === 'roster'
      ? 'nombre/name (correo/email y nivel/academicLevel son opcionales)'
      : 'estudiante o correo, materia, nota y periodo'
    throw new Error(`No reconocí las columnas. Incluye: ${expected}. Descarga la plantilla para ver un ejemplo.`)
  }

  const gradeIndex = outputHeaders.indexOf('grade')
  const normalizedRows = [outputHeaders, ...rows.slice(1).map(row => {
    const normalized = [...row]
    if (kind === 'grades' && gradeIndex >= 0) {
      const rawGrade = String(normalized[gradeIndex] ?? '').trim().replace(',', '.')
      const grade = Number(rawGrade)
      if (!Number.isFinite(grade) || grade < 0 || grade > 5) {
        const who = String(normalized[outputHeaders.indexOf('studentName')] ?? '').trim()
        throw new Error(`La nota "${rawGrade || 'vacía'}"${who ? ` de ${who}` : ''} no está entre 0 y 5. Corrige el Excel y vuelve a importarlo.`)
      }
      normalized[gradeIndex] = grade.toFixed(2)
    }
    return normalized
  })]
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(normalizedRows), { FS: ',' })
  return `\uFEFF${csv}`
}

const IGNORED_SHEETS = new Set(['instrucciones', 'instructions', 'ejemplo'])
const STUDENT_COLUMNS = new Set(['studentName', 'studentEmail', 'studentId'])

/**
 * Grid layout used by the templates: students in rows, one column per topic, the corte is the sheet name.
 * Returns null when the sheet is in the classic "one grade per row" layout.
 */
export function gridToGradeRows(rows: unknown[][], period: string): unknown[][] | null {
  if (rows.length < 1) return null
  const headers = rows[0].map(value => String(value ?? '').trim())
  const mapped = headers.map(header => headerAliases.grades[normalizeHeader(header)] || '')
  if (mapped.includes('grade') || !mapped.some(h => STUDENT_COLUMNS.has(h))) return null
  const topicColumns = headers.map((header, i) => ({ header, i })).filter(({ header, i }) => header && !mapped[i])
  if (!topicColumns.length) return null
  const nameAt = mapped.indexOf('studentName')
  const emailAt = mapped.indexOf('studentEmail')
  const out: unknown[][] = [['studentName', 'studentEmail', 'subject', 'grade', 'period']]
  for (const row of rows.slice(1)) {
    const name = nameAt >= 0 ? String(row[nameAt] ?? '').trim() : ''
    const email = emailAt >= 0 ? String(row[emailAt] ?? '').trim() : ''
    if (!name && !email) continue
    for (const { header, i } of topicColumns) {
      const raw = String(row[i] ?? '').trim()
      if (raw !== '') out.push([name, email, header, raw, period])
    }
  }
  return out
}

export async function spreadsheetFileAsCsv(file: File, kind: ImportKind): Promise<File> {
  const XLSX = await import('xlsx')
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  const source: string | ArrayBuffer = isCsv ? await file.text() : await file.arrayBuffer()
  const workbook = XLSX.read(source, { type: isCsv ? 'string' : 'array', cellDates: false })
  const names = workbook.SheetNames.filter(name => !IGNORED_SHEETS.has(name.trim().toLowerCase()))
  if (!names.length) throw new Error('El libro de Excel no contiene hojas.')
  const read = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', raw: false })
  let rows: unknown[][]
  if (kind === 'grades') {
    // Each grid sheet is a corte; classic sheets are used as they are. All of them go in one import.
    const grids = names.map(name => gridToGradeRows(read(name), name.trim()))
    rows = grids.every(grid => grid === null) ? read(names[0])
      : [['studentName', 'studentEmail', 'subject', 'grade', 'period'], ...grids.flatMap(grid => grid?.slice(1) ?? [])]
  } else rows = read(names[0])
  const csv = await normalizeSpreadsheetRows(rows, kind)
  const safeName = file.name.replace(/\.(csv|xlsx|xls)$/i, '')
  return new File([csv], `${safeName}.csv`, { type: 'text/csv;charset=utf-8' })
}


