import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
    include: {
      payments: true,
      discounts: true,
      guides: { include: { guide: true } },
      createdBy: true,
    },
  });
  if (!trip) return new Response("Not found", { status: 404 });

  const dateStr = new Date(trip.tripDate).toISOString().slice(0, 10);

  const { default: PdfPrinter } = await import("pdfmake");
  const fonts = { Roboto: { normal: "Helvetica", bold: "Helvetica-Bold" } } as any;
  const printer = new (PdfPrinter as any)(fonts);

  const guideLines = trip.guides.map((g: any) => `${g.guide.name} (${g.guide.rank}) — pax ${g.paxCount}`);
  const discountLines = trip.discounts.length
    ? trip.discounts.map((d: any) => `R ${d.amount.toString()} — ${d.reason}`)
    : ["None"];

  const payments = trip.payments;

  const docDefinition = {
    content: [
      { text: `Cash Up — ${dateStr}`, style: "header" },
      { text: `Lead: ${trip.leadName}` },
      { text: `Status: ${trip.status}` },
      { text: `Total Pax: ${trip.totalPax}` },
      { text: `Created by: ${trip.createdBy?.email || ""}` },
      { text: `Pax Guide notes: ${(trip as any).paxGuideNote || ""}`, margin: [0, 6, 0, 10] },
      { text: "Guides", style: "subheader" },
      { ul: guideLines, margin: [0, 0, 0, 10] },
      { text: "Payments", style: "subheader" },
      {
        table: {
          widths: ["*", "*"] as any,
          body: [
            ["Cash received", `R ${payments?.cashReceived?.toString() || "0"}`],
            ["Phone pouches", `R ${payments?.phonePouches?.toString() || "0"}`],
            ["Water sales", `R ${payments?.waterSales?.toString() || "0"}`],
            ["Sunglasses sales", `R ${payments?.sunglassesSales?.toString() || "0"}`],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      },
      { text: "Discount Lines", style: "subheader" },
      { ul: discountLines, margin: [0, 0, 0, 10] },
      { text: "Flags", style: "subheader" },
      {
        ul: [
          `All payments in Activitar: ${trip.paymentsMadeYN ? "Yes" : "No"}`,
          `Facebook pictures uploaded: ${trip.picsUploadedYN ? "Yes" : "No"}`,
          `Trip email sent: ${trip.tripEmailSentYN ? "Yes" : "No"}`,
        ],
      },
      ((trip as any).suggestions ? { text: `Suggestions: ${(trip as any).suggestions}`, margin: [0, 10, 0, 0] } : {}),
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 13, bold: true, margin: [0, 8, 0, 6] },
    },
  } as any;

  const pdfDoc = (printer as any).createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    pdfDoc.on("data", (c: Buffer) => chunks.push(c));
    pdfDoc.on("end", () => resolve());
    pdfDoc.end();
  });
  const pdf = Buffer.concat(chunks);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cashup-${dateStr}.pdf"`,
    },
  });
}

