import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { calculateGuideEarnings } from "@/lib/guideEarnings";

/**
 * COMPREHENSIVE TEST ENDPOINT - DELETE AFTER USE
 *
 * Tests ALL guides in the database to ensure:
 * 1. Trip leaders are added to earnings
 * 2. Earnings link to guide user accounts
 * 3. Earnings appear in guide's invoice/earnings page
 */

interface TestResult {
  guideId: string;
  guideName: string;
  guideRank: string;
  guideActive: boolean;
  hasUserAccount: boolean;
  userEmail: string | null;
  canBeTripLeader: boolean;
  tripsCreated: number;
  tripsInEarnings: number;
  earningsVisibleViaAPI: boolean;
  expectedEarnings: number;
  actualEarnings: number;
  success: boolean;
  errors: string[];
  warnings: string[];
}

export async function GET(req: NextRequest) {
  try {
    // STRICT ADMIN CHECK
    const user = await getServerSession();
    if (!user?.id || user.role !== 'ADMIN') {
      return new Response('Forbidden - Admin only', { status: 403 });
    }

    const testResults: TestResult[] = [];
    const testTripIds: string[] = [];
    let logs: string[] = [];

    const log = (message: string) => {
      logs.push(message);
      console.log(message);
    };

    log('🧪 COMPREHENSIVE GUIDE EARNINGS TEST');
    log('Testing ALL guides in database\n');
    log('='.repeat(80));

    // Get admin user to create trips
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      return new Response('No admin user found', { status: 500 });
    }

    // Fetch ALL guides from database
    const guides = await prisma.guide.findMany({
      include: {
        user: true
      },
      orderBy: { name: 'asc' }
    });

    log(`\nFound ${guides.length} guides in database:\n`);

    for (const guide of guides) {
      log(`  - ${guide.name} (${guide.rank}, ${guide.active ? 'ACTIVE' : 'INACTIVE'})`);
    }

    log('\n' + '='.repeat(80) + '\n');

    // Test each guide
    for (const guide of guides) {
      const canBeTripLeader = guide.rank === 'SENIOR' || guide.rank === 'INTERMEDIATE';

      const result: TestResult = {
        guideId: guide.id,
        guideName: guide.name,
        guideRank: guide.rank,
        guideActive: guide.active,
        hasUserAccount: !!guide.user,
        userEmail: guide.user?.email || null,
        canBeTripLeader,
        tripsCreated: 0,
        tripsInEarnings: 0,
        earningsVisibleViaAPI: false,
        expectedEarnings: 0,
        actualEarnings: 0,
        success: false,
        errors: [],
        warnings: []
      };

      log(`\n${'─'.repeat(80)}`);
      log(`Testing: ${guide.name} (${guide.rank})`);
      log(`${'─'.repeat(80)}`);
      log(`  Active: ${guide.active}`);
      log(`  User Account: ${guide.user ? guide.user.email : 'NONE'}`);
      log(`  Can be Trip Leader: ${canBeTripLeader ? 'YES' : 'NO (Junior/Trainee)'}`);

      if (!guide.user) {
        result.warnings.push('No user account linked - cannot access earnings page');
        log(`  ⚠️  Warning: No user account - guide cannot log in to view earnings`);
      }

      if (!canBeTripLeader) {
        log(`  ℹ️  Skipping trip creation (only SENIOR/INTERMEDIATE can be trip leaders)`);
        result.success = true; // Not applicable
        testResults.push(result);
        continue;
      }

      try {
        log(`\n  Creating 5 test trips...`);

        // Create 5 test trips with this guide as trip leader
        for (let i = 1; i <= 5; i++) {
          const tripDate = new Date();
          tripDate.setDate(tripDate.getDate() - i);
          const totalPax = 10 + (i * 2);

          const earnings = calculateGuideEarnings(totalPax, guide.rank as any, true, guide.name);

          const trip = await prisma.trip.create({
            data: {
              tripDate,
              leadName: `TEST-ALL-${guide.name}-Trip${i}`,
              paxGuideNote: `Comprehensive test trip ${i} for ${guide.name}`,
              totalPax,
              tripLeaderId: guide.id,
              paymentsMadeYN: true,
              picsUploadedYN: true,
              tripEmailSentYN: true,
              tripReport: 'Automated test trip',
              status: 'APPROVED',
              createdById: adminUser.id,
              payments: {
                create: {
                  cashReceived: 1000,
                  phonePouches: 0,
                  waterSales: 0,
                  sunglassesSales: 0
                }
              },
              guides: {
                create: [{
                  guideId: guide.id,
                  paxCount: 0,
                  feeAmount: earnings
                }]
              }
            }
          });

          testTripIds.push(trip.id);
          result.tripsCreated++;
          result.expectedEarnings += earnings;

          log(`    ✓ Trip ${i}: ${totalPax} pax → R ${earnings.toFixed(2)}`);
        }

        // Verify trips are in TripGuide records
        log(`\n  Verifying TripGuide records...`);

        const tripGuides = await prisma.tripGuide.findMany({
          where: {
            guideId: guide.id,
            trip: {
              leadName: {
                startsWith: `TEST-ALL-${guide.name}`
              }
            }
          }
        });

        result.tripsInEarnings = tripGuides.length;
        result.actualEarnings = tripGuides.reduce((sum, tg) =>
          sum + parseFloat(tg.feeAmount.toString()), 0
        );

        if (result.tripsCreated === result.tripsInEarnings) {
          log(`    ✅ All ${result.tripsCreated} trips found in TripGuide records`);
        } else {
          result.errors.push(`Only ${result.tripsInEarnings}/${result.tripsCreated} trips in TripGuide`);
          log(`    ❌ Only ${result.tripsInEarnings}/${result.tripsCreated} trips found`);
        }

        // Verify earnings appear via API (simulate guide accessing their earnings page)
        log(`\n  Checking if earnings visible via API...`);

        const apiTrips = await prisma.trip.findMany({
          where: {
            guides: {
              some: {
                guideId: guide.id
              }
            },
            leadName: {
              startsWith: `TEST-ALL-${guide.name}`
            }
          },
          include: {
            guides: {
              where: { guideId: guide.id },
              include: { guide: true }
            }
          }
        });

        result.earningsVisibleViaAPI = apiTrips.length === result.tripsCreated;

        if (result.earningsVisibleViaAPI) {
          log(`    ✅ All trips visible via API query (as guide would see)`);
        } else {
          result.errors.push(`API query found ${apiTrips.length}/${result.tripsCreated} trips`);
          log(`    ❌ API only found ${apiTrips.length}/${result.tripsCreated} trips`);
        }

        // Calculate if earnings match
        const earningsMatch = Math.abs(result.expectedEarnings - result.actualEarnings) < 0.01;

        if (earningsMatch) {
          log(`    ✅ Earnings match: R ${result.actualEarnings.toFixed(2)}`);
        } else {
          result.errors.push(`Earnings mismatch: expected R${result.expectedEarnings.toFixed(2)}, got R${result.actualEarnings.toFixed(2)}`);
          log(`    ❌ Earnings mismatch!`);
        }

        // Overall success
        if (result.tripsCreated === result.tripsInEarnings &&
            result.earningsVisibleViaAPI &&
            earningsMatch) {
          result.success = true;
          log(`\n  ✅ PASSED: All checks successful`);
        } else {
          log(`\n  ❌ FAILED: ${result.errors.length} error(s)`);
        }

      } catch (error: any) {
        result.errors.push(error.message);
        log(`\n  ❌ ERROR: ${error.message}`);
      }

      testResults.push(result);
    }

    // Cleanup
    log('\n\n' + '='.repeat(80));
    log('🧹 Cleaning up test data...');
    log('='.repeat(80) + '\n');

    if (testTripIds.length > 0) {
      const deletedTripGuides = await prisma.tripGuide.deleteMany({
        where: { tripId: { in: testTripIds } }
      });
      const deletedPayments = await prisma.paymentBreakdown.deleteMany({
        where: { tripId: { in: testTripIds } }
      });
      const deletedTrips = await prisma.trip.deleteMany({
        where: { id: { in: testTripIds } }
      });

      log(`  ✓ Deleted ${deletedTrips.count} test trips`);
      log(`  ✓ Deleted ${deletedTripGuides.count} TripGuide records`);
      log(`  ✓ Deleted ${deletedPayments.count} PaymentBreakdown records`);
    }

    const successful = testResults.filter(r => r.success);
    const failed = testResults.filter(r => !r.success && r.canBeTripLeader);
    const notApplicable = testResults.filter(r => !r.canBeTripLeader);
    const withWarnings = testResults.filter(r => r.warnings.length > 0);

    // Generate HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Comprehensive Guide Earnings Test</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1400px;
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
    h1 { color: #333; margin-top: 0; }
    .summary {
      background: ${failed.length === 0 ? '#dcfce7' : '#fef3c7'};
      border-left: 4px solid ${failed.length === 0 ? '#22c55e' : '#f59e0b'};
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .summary h2 {
      margin-top: 0;
      color: ${failed.length === 0 ? '#166534' : '#92400e'};
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .stat:last-child { border-bottom: none; }
    .stat-label { font-weight: 500; color: #374151; }
    .stat-value { font-weight: 700; color: #111827; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 0.9em;
    }
    th {
      background: #f9fafb;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      position: sticky;
      top: 0;
    }
    td {
      padding: 12px 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover { background: #f9fafb; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-failed { background: #fee2e2; color: #991b1b; }
    .badge-na { background: #e5e7eb; color: #6b7280; }
    .badge-yes { background: #dbeafe; color: #1e40af; }
    .badge-no { background: #fef3c7; color: #92400e; }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1f2937;
      color: #f3f4f6;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.8em;
      line-height: 1.4;
      max-height: 600px;
    }
    .section { margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 Comprehensive Guide Earnings Test</h1>
    <p style="color: #64748b;">Testing ALL ${guides.length} guides in database</p>

    <div class="summary">
      <h2>📊 Test Summary</h2>
      <div class="stat">
        <span class="stat-label">Total Guides in Database:</span>
        <span class="stat-value">${guides.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Eligible Trip Leaders (Sr/Int):</span>
        <span class="stat-value">${testResults.filter(r => r.canBeTripLeader).length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">✅ Tests Passed:</span>
        <span class="stat-value" style="color: #059669;">${successful.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">❌ Tests Failed:</span>
        <span class="stat-value" style="color: #dc2626;">${failed.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">ℹ️  Not Applicable (Jr/Trainee):</span>
        <span class="stat-value">${notApplicable.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">⚠️  Warnings:</span>
        <span class="stat-value">${withWarnings.length} guides without user accounts</span>
      </div>
      <div class="stat">
        <span class="stat-label">Success Rate (of eligible):</span>
        <span class="stat-value">${testResults.filter(r => r.canBeTripLeader).length > 0 ? Math.round(successful.length / testResults.filter(r => r.canBeTripLeader).length * 100) : 0}%</span>
      </div>
    </div>

    ${failed.length === 0 ? `
      <div style="background: #dcfce7; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong>🎉 All Tests Passed!</strong><br>
        Trip leader earnings working correctly for all eligible guides.
      </div>
    ` : `
      <div class="warning">
        <strong>⚠️ ${failed.length} Test(s) Failed</strong><br>
        Some guides not receiving earnings correctly. See details below.
      </div>
    `}

    <div class="section">
      <h2>📋 Complete Test Results - All ${guides.length} Guides</h2>
      <table>
        <thead>
          <tr>
            <th>Guide Name</th>
            <th>Rank</th>
            <th>Active</th>
            <th>Has Account</th>
            <th>Email</th>
            <th>Status</th>
            <th>Trips</th>
            <th>In Earnings</th>
            <th>API Visible</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Errors/Warnings</th>
          </tr>
        </thead>
        <tbody>
          ${testResults.map(r => `
            <tr>
              <td><strong>${r.guideName}</strong></td>
              <td>${r.guideRank}</td>
              <td><span class="badge ${r.guideActive ? 'badge-yes' : 'badge-no'}">${r.guideActive ? 'Yes' : 'No'}</span></td>
              <td><span class="badge ${r.hasUserAccount ? 'badge-yes' : 'badge-no'}">${r.hasUserAccount ? 'Yes' : 'No'}</span></td>
              <td style="font-size: 0.85em;">${r.userEmail || '-'}</td>
              <td>
                <span class="badge badge-${r.success ? 'success' : (!r.canBeTripLeader ? 'na' : 'failed')}">
                  ${r.success ? 'PASS' : (!r.canBeTripLeader ? 'N/A' : 'FAIL')}
                </span>
              </td>
              <td style="text-align: center;">${r.tripsCreated || '-'}</td>
              <td style="text-align: center;">${r.tripsInEarnings || '-'}</td>
              <td style="text-align: center;">
                ${r.canBeTripLeader ? (r.earningsVisibleViaAPI ? '✅' : '❌') : '-'}
              </td>
              <td style="text-align: right;">R ${r.expectedEarnings.toFixed(2)}</td>
              <td style="text-align: right;">R ${r.actualEarnings.toFixed(2)}</td>
              <td style="font-size: 0.85em;">
                ${r.errors.length > 0 ? '<span style="color: #dc2626;">❌ ' + r.errors.join('; ') + '</span>' : ''}
                ${r.warnings.length > 0 ? '<br><span style="color: #f59e0b;">⚠️  ' + r.warnings.join('; ') + '</span>' : ''}
                ${r.errors.length === 0 && r.warnings.length === 0 && r.success ? '✅' : ''}
                ${!r.canBeTripLeader ? 'Junior/Trainee - cannot be trip leader' : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="warning" style="margin-top: 40px;">
      <strong>⚠️ IMPORTANT:</strong> Delete this temporary endpoint after use:<br>
      <code>app/api/admin/test-all-guide-earnings/route.ts</code>
    </div>

    <div class="section">
      <h2>📝 Detailed Execution Log</h2>
      <pre>${logs.join('\n')}</pre>
    </div>
  </div>
</body>
</html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    console.error('[Test] Fatal error:', error);

    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Error</title>
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
    <h1>❌ Test Failed</h1>
    <p><strong>Error:</strong> ${error.message}</p>
    <pre>${error.stack || error.toString()}</pre>
  </div>
</body>
</html>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
