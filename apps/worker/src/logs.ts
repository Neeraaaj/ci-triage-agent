const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/;
const ANSI = /\x1b\[[0-9;]*m/g;

export function cleanLog(raw: string): string {
  // 1. Split into lines and strip timestamps + color codes from each line
  const lines = raw.split('\n').map((line) => line.replace(TIMESTAMP, '').replace(ANSI, ''));

  // 2. Find the first error line
  const errorIdx = lines.findIndex((line) => line.includes('##[error]'));

  // 3. Fallback: no error marker → just return the last 150 lines
  if (errorIdx === -1) {
    return lines.slice(-150).join('\n');
  }

  // 4. Walk BACKWARDS from errorIdx to the nearest '##[group]Run '
  let startIdx = 0;
  for (let i = errorIdx; i >= 0; i--) {
    if (lines[i].startsWith('##[group]Run ')) {
      startIdx = i;
      break;
    }
  }

  // 5. Slice from step start up to AND including the error line
  const step = lines.slice(startIdx, errorIdx + 1);

  // 6. Tidy: drop marker prefixes and the 'shell:' line, collapse blank lines
  const tidy = step
    .map((l) => l.replace(/^##\[(group|endgroup|error)\]/, ''))
    .filter((l) => !l.startsWith('shell: '))
    .filter((l, i, arr) => !(l.trim() === '' && arr[i - 1]?.trim() === ''));

  // 7. Cap at the last 200 lines
  return tidy.slice(-200).join('\n');
}