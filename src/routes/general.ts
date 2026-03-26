export async function fallbackJson() {
  return Response.json({ message: "Not found" }, { status: 404 });
}

export async function fallback() {
  return new Response("Not Found", { status: 404 });
}
