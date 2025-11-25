import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import fs from 'fs';
import path from 'path';

function parseMonth(month: string) {
  const [y, m] = month.split('-').map(n=>parseInt(n));
  if (!y || !m) throw new Error('Invalid month');
  const start = new Date(Date.UTC(y, m-1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const format = (searchParams.get('format') || 'pdf').toLowerCase();
  if (!month) return new Response('month required YYYY-MM', { status: 400 });
  const { start, end } = parseMonth(month);
  logEvent('report_monthly', { month, format });

  const trips = await prisma.trip.findMany({
    where: { tripDate: { gte: start, lte: end } },
    orderBy: { tripDate: 'asc' },
    include: {
      payments: true,
      discounts: true,
      guides: { include: { guide: true } },
      createdBy: true,
    }
  });

  if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('CashUps');
    ws.columns = [
      { header: 'Trip Date', key: 'tripDate', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Lead', key: 'leadName', width: 20 },
      { header: 'Total Pax', key: 'totalPax', width: 10 },
      { header: 'Guides (S/I/J counts)', key: 'guideCounts', width: 22 },
      { header: 'Guides (names)', key: 'guideNames', width: 36 },
      { header: 'Cash', key: 'cash', width: 10 },
      { header: 'Phone Pouches', key: 'phonePouches', width: 14 },
      { header: 'Water Sales', key: 'waterSales', width: 12 },
      { header: 'Sunglasses Sales', key: 'sunglasses', width: 16 },
      { header: 'Discounts', key: 'discounts', width: 12 },
      { header: 'Pax Guide Notes', key: 'paxNote', width: 30 },
      { header: 'Created By', key: 'creator', width: 24 },
    ];
    for (const t of trips) {
      const names = t.guides.map((g: any)=>g.guide.name).join(', ');
      const counts = {
        SENIOR: t.guides.filter((g: any)=>g.guide.rank==='SENIOR').length,
        INTERMEDIATE: t.guides.filter((g: any)=>g.guide.rank==='INTERMEDIATE').length,
        JUNIOR: t.guides.filter((g: any)=>g.guide.rank==='JUNIOR').length,
      };
      ws.addRow({
        tripDate: new Date(t.tripDate).toISOString().slice(0,10),
        status: t.status,
        leadName: t.leadName,
        totalPax: t.totalPax,
        guideCounts: `S:${counts.SENIOR} I:${counts.INTERMEDIATE} J:${counts.JUNIOR}`,
        guideNames: names,
        cash: t.payments?.cashReceived?.toString() || '0',
        phonePouches: t.payments?.phonePouches?.toString() || '0',
        waterSales: t.payments?.waterSales?.toString() || '0',
        sunglasses: t.payments?.sunglassesSales?.toString() || '0',
        discounts: t.discounts.reduce((sum: number, d: any) => sum + parseFloat(d.amount?.toString() || '0'), 0).toFixed(2),
        paxNote: (t as any).paxGuideNote || '',
        creator: t.createdBy?.email || ''
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Response(Buffer.from(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="cashups-${month}.xlsx"` }});
  }

  const { default: PdfPrinter } = await import('pdfmake');
  const fonts = { Roboto: { normal: 'Helvetica', bold: 'Helvetica-Bold' } } as any;
  const printer = new (PdfPrinter as any)(fonts);

  // Read logo and convert to base64
  const logoPath = path.join(process.cwd(), 'CKAlogo.png');
  let logoDataUrl = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Could not read logo:', err);
  }

  const content: any[] = [];

  // Add logo if available
  if (logoDataUrl) {
    content.push({
      image: logoDataUrl,
      width: 100,
      alignment: 'center',
      margin: [0, 0, 0, 10]
    });
  }

  content.push(
    { text: `Monthly Cash Ups Report`, style: 'header', alignment: 'center' },
    { text: `${month} (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)})`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 15] }
  );

  const body: any[] = [[
    { text: 'Date', bold: true }, { text: 'Lead', bold: true }, { text: 'Pax', bold: true }, { text: 'S/I/J', bold: true }, { text: 'Cash', bold: true }, { text: 'Phone Pouches', bold: true }, { text: 'Water', bold: true }, { text: 'Sunglasses', bold: true }, { text: 'Discounts', bold: true }
  ]];
  for (const t of trips) {
    const counts = {
      SENIOR: t.guides.filter((g: any)=>g.guide.rank==='SENIOR').length,
      INTERMEDIATE: t.guides.filter((g: any)=>g.guide.rank==='INTERMEDIATE').length,
      JUNIOR: t.guides.filter((g: any)=>g.guide.rank==='JUNIOR').length,
    };
    const discountTotal = t.discounts.reduce((sum: number, d: any) => sum + parseFloat(d.amount?.toString() || '0'), 0);
    body.push([
      new Date(t.tripDate).toISOString().slice(0,10),
      t.leadName,
      t.totalPax,
      `S:${counts.SENIOR} I:${counts.INTERMEDIATE} J:${counts.JUNIOR}`,
      t.payments?.cashReceived?.toString() || '0',
      t.payments?.phonePouches?.toString() || '0',
      t.payments?.waterSales?.toString() || '0',
      t.payments?.sunglassesSales?.toString() || '0',
      discountTotal.toFixed(2),
    ]);
  }

  content.push({
    table: { headerRows: 1, widths: ['*','*','*','*','*','*','*','*','*'], body },
    layout: 'lightHorizontalLines'
  });

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 12, margin: [0, 0, 0, 5] }
    }
  };
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => { pdfDoc.on('data', (c: Buffer) => chunks.push(c)); pdfDoc.on('end', () => resolve()); pdfDoc.end(); });
  const pdf = Buffer.concat(chunks);
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cashups-${month}.pdf"` }});
}
