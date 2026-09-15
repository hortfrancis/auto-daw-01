export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** "bar 3" or "bars 3–6". */
export function barRange(startBar: number, lengthBars: number) {
  return lengthBars === 1 ? `bar ${startBar}` : `bars ${startBar}–${startBar + lengthBars - 1}`;
}
