import { buildViewerDocument } from "@/lib/no-pdfjs-viewer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Expected a PDF file upload." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await buildViewerDocument(bytes, file.name || "document.pdf");

    return NextResponse.json(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse the PDF.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
