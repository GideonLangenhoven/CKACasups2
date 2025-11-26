import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { calculateGuideEarnings } from "@/lib/guideEarnings";

/**
 * TEMPORARY ENDPOINT - DELETE AFTER USE
 *
 * Admin-only endpoint to backfill missing trip leader earnings.
 * Run this once to fix historical data, then delete this file.
 *
 * Usage: Navigate to /api/admin/backfill-trip-leaders in your browser
 */

interface BackfillResult {
  tripId: string;
  tripDate: string;
  guideName: string;
  earnings: number;
  status: 'fixed' | 'already_correct' | 'error';
  message?: string;
}

export async function GET(req: NextRequest) {
  try {
    // STRICT ADMIN CHECK
    const user = await getServerSession();
    if (!user?.id || user.role !== 'ADMIN') {
      return new Response('Forbidden - Admin only', { status: 403 });
    }

    const results: BackfillResult[] = [];
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let errorCount = 0;

    // Find all trips that have a trip leader
    const tripsWithLeader = await prisma.trip.findMany({
      where: {
        tripLeaderId: {
          not: null
        }
      },
      include: {
        tripLeader: true,
        guides: true
      },
      orderBy: {
        tripDate: 'desc'
      }
    });

    console.log(`[Backfill] Found ${tripsWithLeader.length} trips with trip leaders`);

    for (const trip of tripsWithLeader) {
      if (!trip.tripLeaderId) continue;

      // Check if trip leader already has a TripGuide record
      const hasLeaderRecord = trip.guides.some(g => g.guideId === trip.tripLeaderId);

      if (hasLeaderRecord) {
        alreadyCorrectCount++;
        results.push({
          tripId: trip.id,
          tripDate: trip.tripDate.toISOString().split('T')[0],
          guideName: trip.tripLeader?.name || 'Unknown',
          earnings: 0,
          status: 'already_correct'
        });
        continue;
      }

      // Trip leader is missing from guides - fix it!
      try {
        const tripLeader = trip.tripLeader;
        if (!tripLeader) {
          errorCount++;
          results.push({
            tripId: trip.id,
            tripDate: trip.tripDate.toISOString().split('T')[0],
            guideName: 'Unknown',
            earnings: 0,
            status: 'error',
            message: `Trip leader ${trip.tripLeaderId} not found`
          });
          continue;
        }

        // Calculate proper earnings for the trip leader
        const feeAmount = calculateGuideEarnings(
          trip.totalPax,
          tripLeader.rank as any,
          true, // is trip leader
          tripLeader.name
        );

        // Create the missing TripGuide record
        await prisma.tripGuide.create({
          data: {
            tripId: trip.id,
            guideId: trip.tripLeaderId,
            paxCount: 0,
            feeAmount
          }
        });

        fixedCount++;
        results.push({
          tripId: trip.id,
          tripDate: trip.tripDate.toISOString().split('T')[0],
          guideName: tripLeader.name,
          earnings: feeAmount,
          status: 'fixed',
          message: `Added earnings record: R ${feeAmount.toFixed(2)}`
        });

        console.log(`[Backfill] ✅ Fixed trip ${trip.id} (${trip.tripDate.toISOString().split('T')[0]}) - Added ${tripLeader.name} with R ${feeAmount.toFixed(2)}`);

      } catch (error: any) {
        errorCount++;
        results.push({
          tripId: trip.id,
          tripDate: trip.tripDate.toISOString().split('T')[0],
          guideName: trip.tripLeader?.name || 'Unknown',
          earnings: 0,
          status: 'error',
          message: error.message
        });
        console.error(`[Backfill] ❌ Error fixing trip ${trip.id}: ${error.message}`);
      }
    }

    const summary = {
      totalTripsWithLeaders: tripsWithLeader.length,
      alreadyCorrect: alreadyCorrectCount,
      fixed: fixedCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('[Backfill] Summary:', summary);

    // Return HTML for easy viewing in browser
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Backfill Trip Leader Earnings - Results</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 0 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-top: 0;
    }
    .summary {
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .summary h2 {
      margin-top: 0;
      color: #1e40af;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .stat:last-child {
      border-bottom: none;
    }
    .stat-label {
      font-weight: 500;
      color: #374151;
    }
    .stat-value {
      font-weight: 700;
      color: #111827;
    }
    .results {
      margin-top: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #f9fafb;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .badge-fixed {
      background: #dcfce7;
      color: #166534;
    }
    .badge-correct {
      background: #e5e7eb;
      color: #6b7280;
    }
    .badge-error {
      background: #fee2e2;
      color: #991b1b;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .success {
      background: #dcfce7;
      border-left: 4px solid #22c55e;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Backfill Trip Leader Earnings</h1>

    <div class="summary">
      <h2>📊 Summary</h2>
      <div class="stat">
        <span class="stat-label">Total trips with leaders:</span>
        <span class="stat-value">${summary.totalTripsWithLeaders}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Already correct:</span>
        <span class="stat-value">${summary.alreadyCorrect}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Fixed (added earnings):</span>
        <span class="stat-value" style="color: #059669;">${summary.fixed}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Errors:</span>
        <span class="stat-value" style="color: #dc2626;">${summary.errors}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Timestamp:</span>
        <span class="stat-value">${new Date(summary.timestamp).toLocaleString()}</span>
      </div>
    </div>

    ${summary.fixed > 0 ? `
      <div class="success">
        <strong>✨ Success!</strong> Fixed ${summary.fixed} trip leader earnings record${summary.fixed === 1 ? '' : 's'}.
      </div>
    ` : summary.alreadyCorrect === summary.totalTripsWithLeaders ? `
      <div class="success">
        <strong>✅ All Good!</strong> All trips already have correct trip leader earnings.
      </div>
    ` : ''}

    ${summary.errors > 0 ? `
      <div class="warning">
        <strong>⚠️ Warning:</strong> ${summary.errors} error${summary.errors === 1 ? '' : 's'} occurred. Check the details below.
      </div>
    ` : ''}

    <div class="warning">
      <strong>⚠️ IMPORTANT:</strong> This is a temporary endpoint. After verifying the results, delete the file at:<br>
      <code>app/api/admin/backfill-trip-leaders/route.ts</code>
    </div>

    <div class="results">
      <h2>📋 Detailed Results</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Guide Name</th>
            <th>Status</th>
            <th>Earnings</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${results.filter(r => r.status === 'fixed').map(result => `
            <tr>
              <td>${result.tripDate}</td>
              <td>${result.guideName}</td>
              <td><span class="badge badge-${result.status === 'fixed' ? 'fixed' : result.status === 'error' ? 'error' : 'correct'}">${result.status.replace('_', ' ').toUpperCase()}</span></td>
              <td>${result.earnings > 0 ? 'R ' + result.earnings.toFixed(2) : '-'}</td>
              <td>${result.message || '-'}</td>
            </tr>
          `).join('')}
          ${results.filter(r => r.status === 'error').map(result => `
            <tr>
              <td>${result.tripDate}</td>
              <td>${result.guideName}</td>
              <td><span class="badge badge-error">${result.status.toUpperCase()}</span></td>
              <td>-</td>
              <td style="color: #dc2626;">${result.message || 'Unknown error'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error: any) {
    console.error('[Backfill] Fatal error:', error);

    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Backfill Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
    }
    .error {
      background: #fee2e2;
      border-left: 4px solid #dc2626;
      padding: 20px;
      border-radius: 4px;
    }
    h1 { color: #991b1b; margin-top: 0; }
    pre {
      background: #f3f4f6;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>❌ Backfill Failed</h1>
    <p><strong>Error:</strong> ${error.message}</p>
    <pre>${error.stack || error.toString()}</pre>
  </div>
</body>
</html>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
}
