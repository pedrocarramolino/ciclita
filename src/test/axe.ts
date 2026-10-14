/**
 * Revisión automática de accesibilidad con axe-core en las pruebas de pantallas.
 * Devuelve las infracciones en texto legible (vacío si no hay ninguna).
 *
 * El contraste de color no se puede calcular en jsdom (no pinta): se comprueba con
 * los tokens del tema (src/styles/index.css, WCAG AA).
 */
import axe from 'axe-core'

export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const result = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  })
  return result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes.map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, '\n      ')}`).join('\n'),
  )
}
