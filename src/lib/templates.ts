/**
 * Excel templates the teacher downloads, fills and uploads again. Loaded on demand (ExcelJS is large).
 *
 * Grades use the layout teachers already use: one sheet per corte, students in rows, topics in columns.
 * The importer (spreadsheet.ts) turns that grid back into one grade per row for the backend.
 */
import type { Workbook, Worksheet } from 'exceljs'
import { request } from '../api'
import { gradeScale } from './domain'
import { slugify } from './files'
import { passingFor, plainNumber } from './gradeSheet'

export const INSTRUCTIONS_SHEET = 'Instrucciones'
const INK = 'FF14232A'
const ACCENT = 'FF1D6F7E'
const ACCENT_SOFT = 'FFE3F0F2'
const LOW_FILL = 'FFFBE4DE'
const LOW_TEXT = 'FFA63A22'
const MAX_ROWS = 300

interface SheetData {
  period: string
  periods: string[]
  columns: { id: number; name: string; weight: number | null }[]
  maxGrade: number
  students: { id: number; name: string; email?: string | null }[]
  cells: { studentId: number; subjectId: number; grade: number }[]
}

async function newWorkbook(): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FairTeam'
  workbook.created = new Date()
  return workbook
}

function styleHeader(sheet: Worksheet, columns: number) {
  const header = sheet.getRow(1)
  header.height = 30
  for (let c = 1; c <= columns; c++) {
    const cell = header.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
    cell.alignment = { vertical: 'middle', horizontal: c <= 2 ? 'left' : 'center', wrapText: true }
  }
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
}

/** Grades from 0 to the course maximum with a clear message, and failing grades painted like the app paints them. */
function gradeRules(sheet: Worksheet, firstCol: number, lastCol: number, lastRow: number, max: number) {
  if (lastCol < firstCol) return
  const from = sheet.getColumn(firstCol).letter
  const to = sheet.getColumn(lastCol).letter
  const range = `${from}2:${to}${lastRow}`
  for (let r = 2; r <= lastRow; r++) {
    for (let c = firstCol; c <= lastCol; c++) {
      const cell = sheet.getRow(r).getCell(c)
      cell.dataValidation = {
        type: 'decimal', operator: 'between', formulae: [0, max], allowBlank: true, showErrorMessage: true,
        errorStyle: 'stop', errorTitle: 'Nota fuera de rango', error: `Escribe una nota entre 0 y ${plainNumber(max)}, por ejemplo ${plainNumber(max * 0.7)}.`,
        showInputMessage: false,
      }
      cell.numFmt = max > 20 ? '0.##' : '0.0#'
      cell.alignment = { horizontal: 'center' }
    }
  }
  sheet.addConditionalFormatting({
    ref: range,
    rules: [{ type: 'cellIs', operator: 'lessThan', formulae: [passingFor(max)], priority: 1,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: LOW_FILL } }, font: { color: { argb: LOW_TEXT }, bold: true } } }],
  })
}

function instructions(workbook: Workbook, title: string, steps: string[], example?: (string | number)[][]) {
  const sheet = workbook.addWorksheet(INSTRUCTIONS_SHEET, { properties: { tabColor: { argb: ACCENT } } })
  sheet.getColumn(1).width = 4
  sheet.getColumn(2).width = 96
  sheet.getCell('B2').value = title
  sheet.getCell('B2').font = { bold: true, size: 16, color: { argb: INK } }
  steps.forEach((step, i) => {
    const cell = sheet.getCell(`B${4 + i}`)
    cell.value = `${i + 1}. ${step}`
    cell.alignment = { wrapText: true, vertical: 'top' }
    sheet.getRow(4 + i).height = 30
  })
  if (example) {
    const start = 5 + steps.length
    sheet.getCell(`B${start}`).value = 'Ejemplo (esta hoja no se importa):'
    sheet.getCell(`B${start}`).font = { bold: true, color: { argb: ACCENT } }
    example.forEach((row, i) => {
      const cell = sheet.getCell(`B${start + 1 + i}`)
      cell.value = row.join('   |   ')
      cell.font = { name: 'Consolas', size: 10, color: { argb: i === 0 ? INK : 'FF4B6168' }, bold: i === 0 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_SOFT } }
    })
  }
  return sheet
}

function gradeSheet(workbook: Workbook, name: string, topics: string[], students: { name: string; email?: string | null }[], max: number, value?: (row: number, col: number) => number | undefined) {
  const sheet = workbook.addWorksheet(name.slice(0, 31))
  sheet.columns = [
    { header: 'Estudiante', key: 'name', width: 34 },
    { header: 'Correo', key: 'email', width: 34 },
    ...topics.map(topic => ({ header: topic, width: Math.min(24, Math.max(12, topic.length + 4)) })),
  ]
  students.forEach((student, r) => {
    const row = sheet.addRow([student.name, student.email ?? '', ...topics.map((_, c) => value?.(r, c) ?? null)])
    row.getCell(1).font = { bold: true, color: { argb: INK } }
    row.getCell(2).font = { color: { argb: 'FF4B6168' } }
  })
  styleHeader(sheet, 2 + topics.length)
  gradeRules(sheet, 3, 2 + topics.length, Math.max(students.length + 1, MAX_ROWS), max)
  return sheet
}

async function save(workbook: Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
  document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const gradeSteps = (max: number) => [
  'Cada hoja es un corte. Cambia el nombre de la pestaña si tu corte se llama distinto (por ejemplo "Parcial final").',
  'En la columna Estudiante escribe el nombre tal como está en FairTeam. El correo es opcional, pero ayuda cuando hay nombres repetidos.',
  'Cada columna desde la C es un tema o actividad. Cambia "Tema 1", "Tema 2"… por los tuyos y agrega las columnas que necesites.',
  `Escribe notas de 0 a ${plainNumber(max)}. Puedes usar coma o punto (${plainNumber(max * 0.7)} o ${String(Math.round(max * 70) / 100)}). Deja la celda vacía si aún no tienes esa nota.`,
  `Para otro corte, duplica una hoja y cámbiale el nombre. Las notas bajo ${plainNumber(passingFor(max))} se pintan solas para que las veas.`,
  'El porcentaje de cada columna y el peso de cada corte se ponen en FairTeam, en Estudiantes y notas → Notas.',
  'En FairTeam ve a Estudiantes y notas → Importar notas y elige este archivo. Esta hoja de instrucciones se ignora.',
]

/** Empty roster template: one sheet to fill, one with instructions and an example. */
export async function downloadRosterTemplate() {
  const workbook = await newWorkbook()
  const sheet = workbook.addWorksheet('Estudiantes')
  sheet.columns = [{ header: 'Nombre completo', width: 38 }, { header: 'Correo (opcional)', width: 38 }]
  styleHeader(sheet, 2)
  instructions(workbook, 'Cómo llenar la lista de estudiantes', [
    'Escribe un estudiante por fila en la hoja Estudiantes, empezando en la fila 2.',
    'El nombre completo es obligatorio. El correo es opcional y no puede repetirse entre estudiantes.',
    'Puedes pegar la lista desde otro Excel o desde el sistema de la universidad.',
    'En FairTeam ve a Estudiantes y notas → Importar lista y elige este archivo.',
    '¿Son pocos estudiantes? Usa "Agregar rápido" en FairTeam y pega los nombres sin usar Excel.',
  ], [['Nombre completo', 'Correo (opcional)'], ['Laura Méndez Ríos', 'laura.mendez@universidad.edu.co'], ['Camilo Rojas Torres', '']])
  await save(workbook, 'plantilla-estudiantes-fairteam.xlsx')
}

/** Empty grade template in the grid layout. */
export async function downloadGradesTemplate() {
  const workbook = await newWorkbook()
  const max = gradeScale()
  gradeSheet(workbook, 'Corte 1', ['Tema 1', 'Tema 2', 'Tema 3'], [], max)
  instructions(workbook, 'Cómo llenar las notas', gradeSteps(max), [
    ['Estudiante', 'Correo', 'Parcial 1', 'Taller Observer', 'Proyecto'],
    ['Laura Méndez Ríos', 'laura.mendez@universidad.edu.co', ...[3.8, 4.2, 4].map(v => plainNumber(v / 5 * max))],
    ['Camilo Rojas Torres', '', ...[2.6, 3.1].map(v => plainNumber(v / 5 * max)), ''],
  ])
  await save(workbook, 'plantilla-notas-fairteam.xlsx')
}

/**
 * The course's own grade book: one sheet per corte with its students, topics and current grades, plus an
 * empty sheet for the next corte. The teacher only has to type grades.
 */
export async function downloadCourseGradeWorkbook(courseId: number, courseName: string) {
  const first = await request<SheetData>(`/api/courses/${courseId}/grade-sheet`)
  const periods = first.periods.length ? first.periods : [first.period]
  const sheets = await Promise.all(periods.map(period => period === first.period ? first
    : request<SheetData>(`/api/courses/${courseId}/grade-sheet?period=${encodeURIComponent(period)}`)))
  const max = first.maxGrade
  const fallback = sheets.find(data => data.columns.length)?.columns ?? [{ id: -1, name: 'Tema 1', weight: null }]
  const workbook = await newWorkbook()
  for (const data of sheets) {
    const topics = data.columns.length ? data.columns : fallback
    const grades = new Map(data.cells.map(cell => [`${cell.studentId}:${cell.subjectId}`, Number(cell.grade)]))
    gradeSheet(workbook, data.period, topics.map(t => t.name), data.students, max,
      (r, c) => grades.get(`${data.students[r].id}:${topics[c].id}`))
  }
  const last = sheets[sheets.length - 1]
  const next = periods.map(p => Number(/(\d+)\D*$/.exec(p)?.[1])).filter(Number.isFinite)
  gradeSheet(workbook, `Corte ${next.length ? Math.max(...next) + 1 : 1}`, (last.columns.length ? last.columns : fallback).map(t => t.name), first.students, max)
  instructions(workbook, `Notas de ${courseName} (de 0 a ${plainNumber(max)})`, gradeSteps(max))
  await save(workbook, `notas-${slugify(courseName) || 'curso'}.xlsx`)
}
