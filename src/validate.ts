export function assertLocalUrl(value: string): string {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Validation URL must use loopback host.');
  }
  return url.toString();
}

export function nextRepairAttempt(current: number): number {
  if (current >= 3) throw new Error('Repair loop limit is three attempts.');
  return current + 1;
}
