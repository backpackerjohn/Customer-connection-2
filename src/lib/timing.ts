export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const dur = performance.now() - start;
    console.log(`[timing] ${label}: ${dur.toFixed(0)}ms`);
  }
}
