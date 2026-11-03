export function checkoutRequestId(cache: Map<string, string>, body: unknown, createId = () => crypto.randomUUID()) {
  const signature = JSON.stringify(body);
  let id = cache.get(signature);
  if (!id) {
    id = createId();
    cache.set(signature, id);
  }
  return id;
}
