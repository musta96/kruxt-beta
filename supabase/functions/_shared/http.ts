export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export async function parseJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
