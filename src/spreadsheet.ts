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
    : outputHeaders.some(header => ['studentName', 'studentEmail', 'studentId'].includes(header))
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
        throw new Error('Hay una nota vacía o fuera del rango de 0 a 5. Corrige el Excel y vuelve a importarlo.')
      }
      normalized[gradeIndex] = grade.toFixed(2)
    }
    return normalized
  })]
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(normalizedRows), { FS: ',' })
  return `\uFEFF${csv}`
}

export async function spreadsheetFileAsCsv(file: File, kind: ImportKind): Promise<File> {
  const XLSX = await import('xlsx')
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  const source: string | ArrayBuffer = isCsv ? await file.text() : await file.arrayBuffer()
  const workbook = XLSX.read(source, { type: isCsv ? 'string' : 'array', cellDates: false })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error('El libro de Excel no contiene hojas.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', raw: false })
  const csv = await normalizeSpreadsheetRows(rows, kind)
  const safeName = file.name.replace(/\.(csv|xlsx|xls)$/i, '')
  return new File([csv], `${safeName}.csv`, { type: 'text/csv;charset=utf-8' })
}

export async function createSpreadsheetTemplate(kind: ImportKind): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const rows = kind === 'roster'
    ? [['name', 'email', 'academicLevel'], ['María Pérez', 'maria@example.edu', 'MEDIUM']]
    : [['studentName', 'studentEmail', 'subject', 'grade', 'period'], ['María Pérez', 'maria@example.edu', 'Programación', 2.8, '2026-2']]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), kind === 'roster' ? 'Estudiantes' : 'Notas')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}
