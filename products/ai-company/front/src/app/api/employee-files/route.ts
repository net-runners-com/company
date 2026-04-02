const BACK_URL = process.env.BACK_URL || "http://localhost:8001";
import { NextRequest } from "next/server";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || "";
  const action = searchParams.get("action") || "list";
  const path = searchParams.get("path") || "";

  if (!employeeId) return Response.json({ error: "employeeId required" }, { status: 400 });

  // Presigned URL for Office files
  if (action === "presign") {
    try {
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/files/presign?path=${encodeURIComponent(path)}`);
      return Response.json(await res.json());
    } catch {
      return Response.json({ error: "Worker not reachable" }, { status: 502 });
    }
  }

  // Serve file (binary proxy for images etc.)
  if (action === "serve") {
    try {
      const res = await fetch(`${BACK_URL}/worker/employee/${employeeId}/files/serve?path=${encodeURIComponent(path)}`);
      if (!res.ok) return new Response("Not found", { status: 404 });
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      return new Response(res.body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" } });
    } catch {
      return new Response("Error", { status: 502 });
    }
  }

  const endpoints: Record<string, string> = {
    list: `/employee/${employeeId}/files?path=${encodeURIComponent(path)}`,
    read: `/employee/${employeeId}/files/read?path=${encodeURIComponent(path)}`,
    skills: `/employee/${employeeId}/skills`,
  };

  try {
    const res = await fetch(`${BACK_URL}/worker${endpoints[action] || endpoints.list}`);
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { employeeId, _action, ...params } = body;

  if (!employeeId) return Response.json({ error: "employeeId required" }, { status: 400 });

  // File upload (forward multipart)
  if (_action === "upload") {
    const formData = body._formData;
    // This route expects the frontend to call the worker directly for uploads
    return Response.json({ error: "Use /api/employee-upload for file uploads" });
  }

  const urlMap: Record<string, [string, string]> = {
    writeFile: [`/employee/${employeeId}/files/write`, "POST"],
    saveSkill: [`/employee/${employeeId}/skills`, "POST"],
    deleteSkill: [`/employee/${employeeId}/skills/${params.name}`, "DELETE"],
    getSkill: [`/employee/${employeeId}/skills/${params.name}`, "GET"],
  };

  const [url, method] = urlMap[_action] || [`/employee/${employeeId}/files`, "GET"];

  try {
    const res = await fetch(`${BACK_URL}/worker${url}`, {
      method,
      headers: method !== "GET" ? { "Content-Type": "application/json" } : {},
      body: method !== "GET" && method !== "DELETE" ? JSON.stringify(params) : undefined,
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Worker not reachable" }, { status: 502 });
  }
}
