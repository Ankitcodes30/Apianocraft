export const formatOctaveValue = (oct: number): string => {
  if (oct === 0) return '● 0 Oct'
  if (oct > 0) return `↑ +${oct} Oct`
  return `↓ ${oct} Oct`
}

export const formatTransposeValue = (tr: number): string => {
  if (tr === 0) return '● 0 st'
  if (tr > 0) return `↑ +${tr} st`
  return `↓ ${tr} st`
}

export const formatTuningValue = (cents: number): string => {
  if (cents === 0) return '● 0 ¢'
  if (cents > 0) return `↑ +${cents} ¢`
  return `↓ ${cents} ¢`
}

export const shiftBadgeStyle = (val: number): string => {
  const base =
    'chip font-mono text-[10px] h-6 px-2 min-w-[5rem] inline-flex items-center justify-center transition-colors duration-150 rounded border select-none tabular-nums shrink-0 text-center'
  if (val === 0) {
    return `${base} bg-secondary/60 text-muted-foreground border-border/60 font-medium`
  }
  if (val > 0) {
    return `${base} bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold shadow-xs`
  }
  return `${base} bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 font-bold shadow-xs`
}
