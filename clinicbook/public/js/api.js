/** Thin fetch wrapper for the ClinicBook API. Errors carry status and the parsed JSON body. */
export async function request(method, url, body, fetchFn = fetch) {
  const response = await fetchFn(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Soʻrov bajarilmadi');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
export const get = (url) => request('GET', url);
export const post = (url, body = {}) => request('POST', url, body);
export const put = (url, body = {}) => request('PUT', url, body);
