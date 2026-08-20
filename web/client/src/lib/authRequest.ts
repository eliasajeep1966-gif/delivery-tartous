export const WEB_REQUEST_TIMEOUT_MS = 15_000;
export const AUTH_REQUEST_TIMEOUT_MS = WEB_REQUEST_TIMEOUT_MS;

export class WebRequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebRequestTimeoutError';
  }
}

export function withWebRequestTimeout<T>(request: Promise<T>, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new WebRequestTimeoutError(timeoutMessage)),
      WEB_REQUEST_TIMEOUT_MS,
    );

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

/** @deprecated Use withWebRequestTimeout for new web data operations. */
export const withAuthRequestTimeout = withWebRequestTimeout;
