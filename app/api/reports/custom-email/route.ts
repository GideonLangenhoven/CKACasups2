import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    // Dynamic imports to avoid build-time bundling issues
    const { prisma } = await import("@/lib/prisma");
    const { sendEmail } = await import("@/lib/sendMail");
    const { logEvent } = await import("@/lib/log");
    const fs = await import('fs');
    const path = await import('path');

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return new Response('start and end dates required (YYYY-MM-DD)', { status: 400 });
    }

    const startDate = new Date(start + 'T00:00:00Z');
    const endDate = new Date(end + 'T23:59:59Z');

    const trips = await prisma.trip.findMany({
      where: { tripDate: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'asc' },
      include: { payments: true, discounts: true, guides: { include: { guide: true } }, createdBy: true, tripLeader: true }
    });

    // Build PDF with logo
    const { default: PdfPrinter } = await import('pdfmake');
    const fonts = { Roboto: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } } as any;
    const printer = new (PdfPrinter as any)(fonts);

    // Read logo and convert to base64
    const logoPath = path.join(process.cwd(), 'public', 'CKAlogo.png');
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
      { text: `${start} to ${end}`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] }
    );

    // Calculate guide statistics
    const guideStats = new Map<string, { name: string; rank: string; tripCount: number }>();
    for (const t of trips) {
      for (const tg of t.guides) {
        if (!guideStats.has(tg.guide.id)) {
          guideStats.set(tg.guide.id, {
            name: tg.guide.name,
            rank: tg.guide.rank,
            tripCount: 0
          });
        }
        const stats = guideStats.get(tg.guide.id)!;
        stats.tripCount++;
      }
    }

    // Guide Summary Table
    if (guideStats.size > 0) {
      const guideSummaryBody: any[] = [
        [{ text: 'Guide Name', bold: true, fillColor: '#f1f5f9' }, { text: 'Rank', bold: true, fillColor: '#f1f5f9' }, { text: 'Total Trips', bold: true, fillColor: '#f1f5f9' }]
      ];
      for (const stats of Array.from(guideStats.values()).sort((a, b) => a.name.localeCompare(b.name))) {
        guideSummaryBody.push([stats.name, stats.rank, stats.tripCount.toString()]);
      }
      content.push(
        { text: 'Guide Summary', style: 'sectionHeader', margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: guideSummaryBody
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6
          },
          margin: [0, 0, 0, 20]
        }
      );
    }

    // Trip Details Table
    content.push({ text: 'Trip Details', style: 'sectionHeader', margin: [0, 0, 0, 8] });

    const body: any[] = [[
      { text: 'Date', bold: true, fillColor: '#f1f5f9' },
      { text: 'Time', bold: true, fillColor: '#f1f5f9' },
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
      const submittedTime = new Date(t.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      body.push([
        new Date(t.tripDate).toISOString().slice(0,10),
        submittedTime,
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
        widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
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
        subheader: { fontSize: 11, margin: [0, 0, 0, 5], color: '#64748b' },
        sectionHeader: { fontSize: 14, bold: true, color: '#334155' }
      },
      defaultStyle: {
        fontSize: 10,
        color: '#1e293b'
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const pdfChunks: Buffer[] = [];
    await new Promise<void>((resolve) => { pdfDoc.on('data', (c: Buffer) => pdfChunks.push(c)); pdfDoc.on('end', () => resolve()); pdfDoc.end(); });
    const pdf = Buffer.concat(pdfChunks);

    // Build Excel
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
      { header: 'Discounts', key: 'discounts', width: 12 }
    ];
    for (const t of trips) {
      const names = t.guides.map((g: any)=>g.guide.name).join(', ');
      const counts = { SENIOR: t.guides.filter((g: any)=>g.guide.rank==='SENIOR').length, INTERMEDIATE: t.guides.filter((g: any)=>g.guide.rank==='INTERMEDIATE').length, JUNIOR: t.guides.filter((g: any)=>g.guide.rank==='JUNIOR').length };
      const discountTotal = t.discounts.reduce((sum: number, d: any) => sum + parseFloat(d.amount?.toString() || '0'), 0);
      ws.addRow({ tripDate: new Date(t.tripDate).toISOString().slice(0,10), status: t.status, leadName: t.leadName, totalPax: t.totalPax, guideCounts: `S:${counts.SENIOR} I:${counts.INTERMEDIATE} J:${counts.JUNIOR}`, guideNames: names, cash: t.payments?.cashReceived?.toString() || '0', phonePouches: t.payments?.phonePouches?.toString() || '0', waterSales: t.payments?.waterSales?.toString() || '0', sunglasses: t.payments?.sunglassesSales?.toString() || '0', discounts: discountTotal.toFixed(2) });
    }
    const xlsBuf = await wb.xlsx.writeBuffer();

    const recipients = (process.env.ADMIN_EMAILS || '').split(',').map(e=>e.trim()).filter(Boolean);
    if (!recipients.length) return new Response('No ADMIN_EMAILS configured', { status: 500 });

    await sendEmail({
      to: recipients,
      subject: `Custom Date Range Cash Ups Report — ${start} to ${end}`,
      html: `<p>Attached are the PDF and Excel reports for custom date range ${start} to ${end}.</p>`,
      attachments: [
        { filename: `cashups-${start}-to-${end}.pdf`, content: pdf, contentType: 'application/pdf' },
        { filename: `cashups-${start}-to-${end}.xlsx`, content: Buffer.from(xlsBuf), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      ]
    });

    logEvent('report_custom_email_sent', { start, end, recipientsCount: recipients.length });
    return Response.json({ ok: true });
  } catch (error: any) {
    console.error('Custom email error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
