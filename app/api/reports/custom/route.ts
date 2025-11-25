import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const format = (searchParams.get('format') || 'pdf').toLowerCase();

  if (!start || !end) {
    return new Response('start and end dates required (YYYY-MM-DD)', { status: 400 });
  }

  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T23:59:59Z');

  logEvent('report_custom', { start, end, format });

  const trips = await prisma.trip.findMany({
    where: { tripDate: { gte: startDate, lte: endDate } },
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
    return new Response(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cashups-${start}-to-${end}.xlsx"`
      }
    });
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
    { text: `Custom Date Range Cash Ups Report`, style: 'header', alignment: 'center' },
    { text: `${start} to ${end}`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 15] }
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
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cashups-${start}-to-${end}.pdf"`
    }
  });
}
