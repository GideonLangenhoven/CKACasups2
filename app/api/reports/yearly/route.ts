import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logEvent } from "@/lib/log";

function parseYear(year: string) {
  const y = parseInt(year);
  if (!y) throw new Error('Invalid year');
  const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const format = (searchParams.get('format') || 'pdf').toLowerCase();
  if (!year) return new Response('year required YYYY', { status: 400 });
  const { start, end } = parseYear(year);
  logEvent('report_yearly', { year, format });

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
    return new Response(Buffer.from(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="cashups-${year}.xlsx"` }});
  }

  const { default: PdfPrinter } = await import('pdfmake');
  const fonts = { Roboto: { normal: 'Helvetica', bold: 'Helvetica-Bold' } } as any;
  const printer = new (PdfPrinter as any)(fonts);

  // Load logo
  const fs = await import('fs');
  const path = await import('path');
  const logoPath = path.join(process.cwd(), 'CKAlogo.png');
  let logoDataUrl = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Could not read logo:', err);
  }

  const content: any[] = [];

  if (logoDataUrl) {
    content.push({
      image: logoDataUrl,
      width: 100,
      alignment: 'center',
      margin: [0, 0, 0, 10]
    });
  }

  content.push(
    { text: `Yearly Cash Ups Report`, style: 'header', alignment: 'center' },
    { text: year, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] }
  );

  const body: any[] = [[
    { text: 'Date', bold: true, fillColor: '#f1f5f9' },
    { text: 'Lead', bold: true, fillColor: '#f1f5f9' },
    { text: 'Pax', bold: true, fillColor: '#f1f5f9' },
    { text: 'Guides', bold: true, fillColor: '#f1f5f9' },
    { text: 'Cash', bold: true, fillColor: '#f1f5f9' },
    { text: 'Total', bold: true, fillColor: '#f1f5f9' }
  ]];
  for (const t of trips) {
    const counts = {
      SENIOR: t.guides.filter((g: any)=>g.guide.rank==='SENIOR').length,
      INTERMEDIATE: t.guides.filter((g: any)=>g.guide.rank==='INTERMEDIATE').length,
      JUNIOR: t.guides.filter((g: any)=>g.guide.rank==='JUNIOR').length,
    };
    const discountTotal = t.discounts.reduce((sum: number, d: any) => sum + parseFloat(d.amount?.toString() || '0'), 0);
    const totalPayments = (
      parseFloat(t.payments?.cashReceived?.toString() || '0') +
      parseFloat(t.payments?.phonePouches?.toString() || '0') +
      parseFloat(t.payments?.waterSales?.toString() || '0') +
      parseFloat(t.payments?.sunglassesSales?.toString() || '0') -
      discountTotal
    );
    body.push([
      new Date(t.tripDate).toISOString().slice(0,10),
      t.leadName,
      t.totalPax.toString(),
      `S:${counts.SENIOR} I:${counts.INTERMEDIATE} J:${counts.JUNIOR}`,
      `R ${t.payments?.cashReceived?.toString() || '0'}`,
      `R ${totalPayments.toFixed(2)}`
    ]);
  }

  content.push({
    table: {
      headerRows: 1,
      widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
      body
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#e2e8f0',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6
    }
  });

  const docDefinition = {
    content,
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    styles: {
      header: { fontSize: 20, bold: true, margin: [0, 0, 0, 5], color: '#0A66C2' },
      subheader: { fontSize: 11, margin: [0, 0, 0, 5], color: '#64748b' }
    },
    defaultStyle: {
      fontSize: 10,
      color: '#1e293b'
    }
  };
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => { pdfDoc.on('data', (c: Buffer) => chunks.push(c)); pdfDoc.on('end', () => resolve()); pdfDoc.end(); });
  const pdf = Buffer.concat(chunks);
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cashups-${year}.pdf"` }});
}
