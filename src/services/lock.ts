/**
 * In-process per-key mutex. Ensures that only one handler runs at a time
 * for a given key (e.g. "owner/repo#42" for a PR). Subsequent calls wait
 * for the previous one to finish rather than racing.
 */

const locks = new Map<string, Promise<void>>();

export function withLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();

  const current = previous
    .catch(() => {})
    .then(() => fn());

  const release = current.then(
    () => {},
    () => {},
  );

  locks.set(key, release);

  release.finally(() => {
    if (locks.get(key) === release) {
      locks.delete(key);
    }
  });

  return current;
}
