import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { sendEmail } from "@/lib/sendMail";
import { logEvent } from "@/lib/log";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const user = await getServerSession();
    if (!user?.id) return new Response('Unauthorized', { status: 401 });

    // Get user's guide info
    const userWithGuide = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        guideId: true,
        guide: {
          select: {
            id: true,
            name: true,
            rank: true,
            email: true
          }
        }
      }
    });

    if (!userWithGuide?.guideId || !userWithGuide.guide) {
      return new Response('You are not linked to a guide profile', { status: 403 });
    }

    const { invoiceType = 'monthly', month, week } = await req.json();

    if (invoiceType === 'monthly' && !month) {
      return new Response('Month is required for monthly invoices', { status: 400 });
    }
    if (invoiceType === 'weekly' && !week) {
      return new Response('Week is required for weekly invoices', { status: 400 });
    }

    // Block invoices while unresolved exceptions exist
    const openExceptions = await prisma.paymentException.count({
      where: { guideId: userWithGuide.guideId, resolvedAt: null }
    });
    if (openExceptions > 0) {
      return new Response(JSON.stringify({
        error: `You have ${openExceptions} unresolved cash/card/EFT handover(s). Please hand over and let admin confirm first.`
      }), { status: 409, headers: { "Content-Type": "application/json" } });
    }

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (invoiceType === 'weekly') {
      // Parse week format: YYYY-Wnn
      const [yearStr, weekStr] = week.split('-W');
      const year = parseInt(yearStr);
      const weekNum = parseInt(weekStr);

      // Calculate start date of the week (Monday)
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

      startDate = new Date(week1Monday);
      startDate.setUTCDate(week1Monday.getUTCDate() + (weekNum - 1) * 7);

      endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 6);
      endDate.setUTCHours(23, 59, 59, 999);

      periodLabel = `Week ${weekNum}, ${year}`;
    } else {
      // Monthly invoice
      const [year, monthNum] = month.split('-').map(Number);
      startDate = new Date(Date.UTC(year, monthNum - 1, 1));
      endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
      periodLabel = month;
    }

    // Get all trips for this guide in the specified month
    const trips = await prisma.trip.findMany({
      where: {
        guides: {
          some: {
            guideId: userWithGuide.guideId
          }
        },
        tripDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        guides: {
          where: { guideId: userWithGuide.guideId },
          include: { guide: true }
        },
        tripLeader: true
      },
      orderBy: { tripDate: 'asc' }
    });

    if (trips.length === 0) {
      return new Response(`No trips found for this ${invoiceType === 'weekly' ? 'week' : 'month'}`, { status: 404 });
    }

    // Calculate totals (by week for monthly invoices, by day for weekly invoices)
    const weeklyTotals = new Map<string, { trips: number; earnings: number }>();
    const dailyTotals = new Map<string, { trips: number; earnings: number }>();
    let monthlyTotal = 0;
    let monthlyTripCount = 0;

    for (const trip of trips) {
      const earnings = parseFloat(trip.guides[0]?.feeAmount?.toString() || '0');
      monthlyTotal += earnings;
      monthlyTripCount++;

      const tripDate = new Date(trip.tripDate);

      if (invoiceType === 'monthly') {
        // Calculate week number for monthly invoices
        const jan1 = new Date(Date.UTC(tripDate.getUTCFullYear(), 0, 1));
        const dayOfWeek = jan1.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
        const week1Start = new Date(Date.UTC(tripDate.getUTCFullYear(), 0, 1 + daysToMonday));
        const diffMs = tripDate.getTime() - week1Start.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7) + 1;
        const weekKey = `Week ${weekNum}`;

        if (!weeklyTotals.has(weekKey)) {
          weeklyTotals.set(weekKey, { trips: 0, earnings: 0 });
        }
        const weekData = weeklyTotals.get(weekKey)!;
        weekData.trips++;
        weekData.earnings += earnings;
      } else {
        // For weekly invoices, group by day
        const dayKey = tripDate.toISOString().slice(0, 10);
        if (!dailyTotals.has(dayKey)) {
          dailyTotals.set(dayKey, { trips: 0, earnings: 0 });
        }
        const dayData = dailyTotals.get(dayKey)!;
        dayData.trips++;
        dayData.earnings += earnings;
      }
    }

    // Generate PDF Invoice
    const { default: PdfPrinter } = await import('pdfmake');
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    } as any;
    const printer = new (PdfPrinter as any)(fonts);

    // Read logo
    const fs = await import('fs');
    const path = await import('path');
    const logoPath = path.join(process.cwd(), 'public', 'CKAlogo.png');
    let logoDataUrl = '';
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (err) {
      console.error('Could not read logo:', err);
    }

    const content: any[] = [];

    // Add logo
    if (logoDataUrl) {
      content.push({
        image: logoDataUrl,
        width: 100,
        alignment: 'center',
        margin: [0, 0, 0, 20]
      });
    }

    // Invoice header
    content.push(
      { text: 'GUIDE INVOICE', style: 'header', alignment: 'center' },
      { text: `${periodLabel}`, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] }
    );

    // Guide details
    content.push(
      { text: 'Guide Information', style: 'sectionHeader', margin: [0, 10, 0, 8] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: `Name: ${userWithGuide.guide.name}`, margin: [0, 0, 0, 4] },
              { text: `Rank: ${userWithGuide.guide.rank}`, margin: [0, 0, 0, 4] },
              { text: `Email: ${userWithGuide.guide.email || user.email}`, margin: [0, 0, 0, 4] }
            ]
          },
          {
            width: '*',
            stack: [
              { text: `Invoice Date: ${new Date().toISOString().slice(0, 10)}`, margin: [0, 0, 0, 4] },
              { text: `Period: ${periodLabel}`, margin: [0, 0, 0, 4] },
              { text: `Total Trips: ${monthlyTripCount}`, margin: [0, 0, 0, 4] }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      }
    );

    // Summary (weekly for monthly invoices, daily for weekly invoices)
    if (invoiceType === 'monthly' && weeklyTotals.size > 0) {
      content.push(
        { text: 'Weekly Summary', style: 'sectionHeader', margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Week', bold: true, fillColor: '#f1f5f9' },
                { text: 'Trips', bold: true, fillColor: '#f1f5f9' },
                { text: 'Earnings', bold: true, fillColor: '#f1f5f9' }
              ],
              ...Array.from(weeklyTotals.entries()).map(([week, data]) => [
                week,
                data.trips.toString(),
                `R ${data.earnings.toFixed(2)}`
              ])
            ]
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
    } else if (invoiceType === 'weekly' && dailyTotals.size > 0) {
      content.push(
        { text: 'Daily Summary', style: 'sectionHeader', margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Date', bold: true, fillColor: '#f1f5f9' },
                { text: 'Trips', bold: true, fillColor: '#f1f5f9' },
                { text: 'Earnings', bold: true, fillColor: '#f1f5f9' }
              ],
              ...Array.from(dailyTotals.entries()).sort().map(([date, data]) => [
                new Date(date).toLocaleDateString('en-ZA'),
                data.trips.toString(),
                `R ${data.earnings.toFixed(2)}`
              ])
            ]
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

    // Trip details
    content.push(
      { text: 'Trip Details', style: 'sectionHeader', margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Date', bold: true, fillColor: '#f1f5f9' },
              { text: 'Lead', bold: true, fillColor: '#f1f5f9' },
              { text: 'Pax', bold: true, fillColor: '#f1f5f9' },
              { text: 'Role', bold: true, fillColor: '#f1f5f9' },
              { text: 'Earnings', bold: true, fillColor: '#f1f5f9' }
            ],
            ...trips.map(trip => {
              const isTripLeader = trip.tripLeaderId === userWithGuide.guideId;
              const earnings = parseFloat(trip.guides[0]?.feeAmount?.toString() || '0');
              return [
                new Date(trip.tripDate).toISOString().slice(0, 10),
                trip.leadName,
                trip.totalPax.toString(),
                isTripLeader ? 'Trip Leader' : 'Guide',
                `R ${earnings.toFixed(2)}`
              ];
            })
          ]
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

    // Total
    content.push(
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            table: {
              widths: ['auto', 'auto'],
              body: [
                [
                  { text: 'TOTAL EARNINGS:', bold: true, fontSize: 12, alignment: 'right', border: [false, true, false, false] },
                  { text: `R ${monthlyTotal.toFixed(2)}`, bold: true, fontSize: 14, color: '#059669', alignment: 'right', border: [false, true, false, false] }
                ]
              ]
            },
            layout: {
              hLineWidth: (i: number) => i === 0 ? 2 : 0,
              hLineColor: () => '#059669',
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 8,
              paddingBottom: () => 8
            }
          }
        ],
        margin: [0, 10, 0, 0]
      }
    );

    const docDefinition = {
      content,
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      styles: {
        header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5], color: '#0A66C2' },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5], color: '#64748b' },
        sectionHeader: { fontSize: 14, bold: true, color: '#334155' }
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

    // Send email to admin
    const adminEmails = (process.env.ADMIN_EMAILS || 'gidslang89@gmail.com,info@kayak.co.za')
      .split(',').map(e => e.trim()).filter(Boolean);

    const periodForFilename = invoiceType === 'weekly' ? week.replace('/', '-') : month;

    await sendEmail({
      to: adminEmails,
      subject: `${invoiceType === 'weekly' ? 'Weekly' : 'Monthly'} Invoice from ${userWithGuide.guide.name} - ${periodLabel}`,
      html: `
        <h2>Guide Invoice Submission</h2>
        <p><strong>Guide:</strong> ${userWithGuide.guide.name} (${userWithGuide.guide.rank})</p>
        <p><strong>Type:</strong> ${invoiceType === 'weekly' ? 'Weekly' : 'Monthly'}</p>
        <p><strong>Period:</strong> ${periodLabel}</p>
        <p><strong>Total Trips:</strong> ${monthlyTripCount}</p>
        <p><strong>Total Earnings:</strong> R ${monthlyTotal.toFixed(2)}</p>
        <p>Please find the detailed invoice attached.</p>
      `,
      attachments: [
        {
          filename: `invoice-${userWithGuide.guide.name.replace(/\s+/g, '-')}-${periodForFilename}.pdf`,
          content: pdf,
          contentType: 'application/pdf'
        }
      ]
    });

    logEvent('guide_invoice_submitted', {
      guideId: userWithGuide.guideId,
      guideName: userWithGuide.guide.name,
      userId: user.id,
      invoiceType,
      period: periodLabel,
      month: invoiceType === 'monthly' ? month : undefined,
      week: invoiceType === 'weekly' ? week : undefined,
      tripCount: monthlyTripCount,
      totalEarnings: monthlyTotal
    });

    return Response.json({
      success: true,
      message: `Invoice for ${periodLabel} submitted successfully`,
      tripCount: monthlyTripCount,
      totalEarnings: monthlyTotal
    });
  } catch (error: any) {
    console.error('Submit invoice error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
