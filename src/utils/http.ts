export interface FetchJsonOptions extends RequestInit {
  headers?: HeadersInit
}

export async function fetchJson<T>(endpoint: string, options: FetchJsonOptions = {}) {
  const headers = new Headers(options.headers)

  const body = options.body
  const shouldSetContentType = body != null && !(body instanceof FormData)

  if (shouldSetContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(endpoint, { ...options, headers })

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response))
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T
  }

  const contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  return undefined as T
}

async function extractErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json()

      if (typeof data === 'string') {
        return data
      }

      if (data && typeof data === 'object' && 'message' in data) {
        const maybeMessage = (data as { message?: unknown }).message

        if (typeof maybeMessage === 'string') {
          return maybeMessage
        }
      }
    } catch {
      // ignore parsing errors and fall back to generic error text
    }
  } else {
    try {
      const text = await response.text()

      if (text) {
        return text
      }
    } catch {
      // ignore parsing errors and fall back to generic error text
    }
  }

  return `Request failed with status ${response.status}`
}
