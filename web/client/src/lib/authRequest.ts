export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

export function withAuthRequestTimeout<T>(request: Promise<T>, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), AUTH_REQUEST_TIMEOUT_MS);

    request.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
