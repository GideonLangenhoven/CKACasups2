import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function parseWeek(week: string) {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error('Invalid week format. Use YYYY-Wnn');
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfWeek = jan1.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const week1Start = new Date(Date.UTC(year, 0, 1 + daysToMonday));
  const start = new Date(week1Start);
  start.setUTCDate(week1Start.getUTCDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

function getPreviousWeek(): string {
  // Calculate Monday-Sunday of the previous week
  const now = new Date();

  // Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const currentDayOfWeek = now.getDay();

  // Calculate days to subtract to get to last week's Monday
  // If today is Sunday (0), go back 6 days to previous Monday
  // If today is Monday (1), go back 7 days to previous Monday
  // If today is Tuesday (2), go back 8 days to previous Monday, etc.
  const daysToLastMonday = currentDayOfWeek === 0 ? 6 : (currentDayOfWeek + 6);

  // Get last week's Monday
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);

  // Calculate ISO week number for last Monday
  const jan1 = new Date(Date.UTC(lastMonday.getFullYear(), 0, 1));
  const dayOfWeek = jan1.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const week1Start = new Date(Date.UTC(lastMonday.getFullYear(), 0, 1 + daysToMonday));

  const diffMs = lastMonday.getTime() - week1Start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 1;

  return `${lastMonday.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    // Dynamic imports to avoid build-time bundling issues
    const { prisma } = await import("@/lib/prisma");
    const { sendEmail } = await import("@/lib/sendMail");
    const { logEvent } = await import("@/lib/log");
    const fs = await import('fs');
    const path = await import('path');

    const { searchParams } = new URL(req.url);
    const week = searchParams.get('week') || getPreviousWeek();
    const { start, end } = parseWeek(week);

  const trips = await prisma.trip.findMany({
    where: { tripDate: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    include: { payments: true, discounts: true, guides: { include: { guide: true } }, createdBy: true, tripLeader: true }
  });

  // Calculate per-guide statistics (trip counts and earnings)
  const guideStats = new Map<string, {
    name: string;
    rank: string;
    tripCount: number;
    totalEarnings: number;
    tripLeaderCount: number;
  }>();

  for (const trip of trips) {
    for (const tg of trip.guides) {
      if (!guideStats.has(tg.guide.id)) {
        guideStats.set(tg.guide.id, {
          name: tg.guide.name,
          rank: tg.guide.rank,
          tripCount: 0,
          totalEarnings: 0,
          tripLeaderCount: 0
        });
      }
      const stats = guideStats.get(tg.guide.id)!;
      stats.tripCount++;
      stats.totalEarnings += parseFloat(tg.feeAmount?.toString() || '0');
      if (trip.tripLeaderId === tg.guide.id) {
        stats.tripLeaderCount++;
      }
    }
  }

  // Build PDF with logo
  const { default: PdfPrinter } = await import('pdfmake');
  const fonts = { Roboto: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } } as any;
  const printer = new (PdfPrinter as any)(fonts);

  const logoPath = path.join(process.cwd(), 'public', 'CKAlogo.png');
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
    { text: `Weekly Cash Ups Report`, style: 'header', alignment: 'center' },
    { text: `${week} (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)})`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 15] }
  );

  // Calculate totals for summary
  const totalTrips = trips.length;
  const totalCashCollected = trips.reduce((sum, t) => sum + parseFloat(t.payments?.cashReceived?.toString() || '0'), 0);
  const totalAllPayments = trips.reduce((sum, t) => {
    const discountTotal = t.discounts.reduce((sum: number, d: any) => sum + parseFloat(d.amount?.toString() || '0'), 0);
    return sum +
      parseFloat(t.payments?.cashReceived?.toString() || '0') +
      parseFloat(t.payments?.phonePouches?.toString() || '0') +
      parseFloat(t.payments?.waterSales?.toString() || '0') +
      parseFloat(t.payments?.sunglassesSales?.toString() || '0') -
      discountTotal;
  }, 0);

  // Calculate daily totals
  const dailyTotals = new Map<string, number>();
  for (const trip of trips) {
    const dateStr = new Date(trip.tripDate).toISOString().slice(0, 10);
    const discountTotal = trip.discounts.reduce((sum: number, d: any) => sum + parseFloat(d.amount?.toString() || '0'), 0);
    const total = parseFloat(trip.payments?.cashReceived?.toString() || '0') +
      parseFloat(trip.payments?.phonePouches?.toString() || '0') +
      parseFloat(trip.payments?.waterSales?.toString() || '0') +
      parseFloat(trip.payments?.sunglassesSales?.toString() || '0') -
      discountTotal;
    dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + total);
  }

  // Add summary statistics in top left
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: 'Period Summary', style: 'summaryHeader', margin: [0, 0, 0, 8] },
          { text: `Report Date: ${new Date().toISOString().slice(0, 10)}`, style: 'summaryText' },
          { text: `Total Trips: ${totalTrips}`, style: 'summaryText' },
          { text: `Total Cash Collected: R ${totalCashCollected.toFixed(2)}`, style: 'summaryText' },
          { text: `Total All Payments: R ${totalAllPayments.toFixed(2)}`, style: 'summaryText', margin: [0, 0, 0, 8] },
          { text: 'Daily Breakdown:', style: 'summarySubheader', margin: [0, 4, 0, 4] },
          ...Array.from(dailyTotals.entries()).sort().map(([date, total]) => ({
            text: `${date}: R ${total.toFixed(2)}`,
            style: 'summaryText',
            fontSize: 9
          }))
        ]
      },
      { width: '*', text: '' }
    ],
    margin: [0, 0, 0, 15]
  });

  // Guide Summary Table
  const summaryBody: any[] = [
    [
      { text: 'Guide Name', bold: true, fillColor: '#f1f5f9' },
      { text: 'Rank', bold: true, fillColor: '#f1f5f9' },
      { text: 'Trip Count', bold: true, fillColor: '#f1f5f9' },
      { text: 'Trip Leader', bold: true, fillColor: '#f1f5f9' },
      { text: 'Earnings', bold: true, fillColor: '#f1f5f9' }
    ]
  ];

  for (const stats of Array.from(guideStats.values()).sort((a, b) => a.name.localeCompare(b.name))) {
    summaryBody.push([
      stats.name,
      stats.rank,
      stats.tripCount.toString(),
      stats.tripLeaderCount.toString(),
      `R ${stats.totalEarnings.toFixed(2)}`
    ]);
  }

  content.push(
    { text: 'Guide Summary', style: 'sectionHeader', margin: [0, 10, 0, 5] },
    {
      table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto'], body: summaryBody },
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

  // Company Trip Details with Running Total
  content.push({ text: 'Company Trip Details', style: 'sectionHeader', margin: [0, 15, 0, 5], pageBreak: 'before' });

  const tripDetailsBody: any[] = [
    [
      { text: 'Date', bold: true, fillColor: '#f1f5f9' },
      { text: 'Time', bold: true, fillColor: '#f1f5f9' },
      { text: 'Lead', bold: true, fillColor: '#f1f5f9' },
      { text: 'Pax', bold: true, fillColor: '#f1f5f9' },
      { text: 'Guides', bold: true, fillColor: '#f1f5f9' },
      { text: 'Total', bold: true, fillColor: '#f1f5f9' },
      { text: 'Running Total', bold: true, fillColor: '#f1f5f9' }
    ]
  ];

  // Build a map of all dates in the week with trips
  const tripsByDate = new Map<string, any[]>();
  for (const trip of trips) {
    const dateStr = new Date(trip.tripDate).toISOString().slice(0,10);
    if (!tripsByDate.has(dateStr)) {
      tripsByDate.set(dateStr, []);
    }
    tripsByDate.get(dateStr)!.push(trip);
  }

  // Generate all days in the week range
  const allDaysInWeek: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    allDaysInWeek.push(current.toISOString().slice(0,10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  let runningTotal = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const dateStr of allDaysInWeek) {
    const tripsOnDate = tripsByDate.get(dateStr) || [];
    const currentDate = new Date(dateStr + 'T00:00:00Z');

    if (tripsOnDate.length === 0) {
      // Only show "No trips logged" for dates in the past or today, skip future dates
      if (currentDate <= today) {
        tripDetailsBody.push([
          dateStr,
          '-',
          { text: 'No trips logged', color: '#94a3b8', italics: true },
          '-',
          '-',
          'R 0.00',
          `R ${runningTotal.toFixed(2)}`
        ]);
      }
    } else {
      // Add all trips for this date
      for (const t of tripsOnDate) {
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
        runningTotal += totalPayments;
        const submittedTime = new Date(t.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
        tripDetailsBody.push([
          new Date(t.tripDate).toISOString().slice(0,10),
          submittedTime,
          t.leadName,
          t.totalPax.toString(),
          `S:${counts.SENIOR} I:${counts.INTERMEDIATE} J:${counts.JUNIOR}`,
          `R ${totalPayments.toFixed(2)}`,
          `R ${runningTotal.toFixed(2)}`
        ]);
      }
    }
  }

  content.push({
    table: {
      headerRows: 1,
      widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
      body: tripDetailsBody
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
      sectionHeader: { fontSize: 14, bold: true, color: '#334155', margin: [0, 10, 0, 8] },
      guideName: { fontSize: 11, bold: true, color: '#475569' },
      summaryHeader: { fontSize: 13, bold: true, color: '#334155' },
      summarySubheader: { fontSize: 10, bold: true, color: '#475569' },
      summaryText: { fontSize: 10, color: '#1e293b', margin: [0, 2, 0, 0] }
    },
    defaultStyle: {
      fontSize: 10,
      color: '#1e293b'
    }
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const pdfChunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    pdfDoc.on('data', (c: Buffer) => pdfChunks.push(c));
    pdfDoc.on('end', () => resolve());
    pdfDoc.end();
  });
  const pdf = Buffer.concat(pdfChunks);

  // Build Excel
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();

  // Guide Summary Sheet
  const summaryWs = wb.addWorksheet('Guide Summary');
  summaryWs.columns = [
    { header: 'Guide Name', key: 'name', width: 20 },
    { header: 'Rank', key: 'rank', width: 15 },
    { header: 'Trip Count', key: 'tripCount', width: 12 },
    { header: 'Trip Leader Count', key: 'tripLeaderCount', width: 18 },
    { header: 'Total Earnings', key: 'totalEarnings', width: 15 }
  ];
  for (const stats of Array.from(guideStats.values()).sort((a, b) => a.name.localeCompare(b.name))) {
    summaryWs.addRow({
      name: stats.name,
      rank: stats.rank,
      tripCount: stats.tripCount,
      tripLeaderCount: stats.tripLeaderCount,
      totalEarnings: stats.totalEarnings
    });
  }

  // Company Trip Details Sheet
  const detailWs = wb.addWorksheet('Company Trip Details');
  detailWs.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Lead', key: 'leadName', width: 20 },
    { header: 'Pax', key: 'pax', width: 10 },
    { header: 'Guides', key: 'guides', width: 15 },
    { header: 'Cash', key: 'cash', width: 12 },
    { header: 'Phone Pouches', key: 'phonePouches', width: 14 },
    { header: 'Water Sales', key: 'waterSales', width: 12 },
    { header: 'Sunglasses Sales', key: 'sunglasses', width: 16 },
    { header: 'Discounts', key: 'discounts', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Running Total', key: 'runningTotal', width: 15 }
  ];

  let excelRunningTotal = 0;
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
    excelRunningTotal += totalPayments;

    detailWs.addRow({
      date: new Date(t.tripDate).toISOString().slice(0,10),
      leadName: t.leadName,
      pax: t.totalPax,
      guides: `S:${counts.SENIOR} I:${counts.INTERMEDIATE} J:${counts.JUNIOR}`,
      cash: t.payments?.cashReceived?.toString() || '0',
      phonePouches: t.payments?.phonePouches?.toString() || '0',
      waterSales: t.payments?.waterSales?.toString() || '0',
      sunglasses: t.payments?.sunglassesSales?.toString() || '0',
      discounts: discountTotal.toFixed(2),
      total: totalPayments.toFixed(2),
      runningTotal: excelRunningTotal.toFixed(2)
    });
  }

  const xlsBuf = await wb.xlsx.writeBuffer();

  const recipients = (process.env.ADMIN_EMAILS || '').split(',').map(e=>e.trim()).filter(Boolean);
  if (!recipients.length) return new Response('No ADMIN_EMAILS configured', { status: 500 });

  await sendEmail({
    to: recipients,
    subject: `Weekly Cash Ups Report — ${week}`,
    html: `<p>Attached are the PDF and Excel weekly reports for ${week} (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}).</p>`,
    attachments: [
      { filename: `cashups-${week}.pdf`, content: pdf, contentType: 'application/pdf' },
      { filename: `cashups-${week}.xlsx`, content: Buffer.from(xlsBuf), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    ]
  });

    logEvent('report_weekly_email_sent', { week, recipientsCount: recipients.length });
    return Response.json({ ok: true });
  } catch (error: any) {
    console.error('Weekly email error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
