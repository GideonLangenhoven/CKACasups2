import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const { default: PdfPrinter } = await import("pdfmake");
  const fonts = { Roboto: { normal: "Helvetica", bold: "Helvetica-Bold" } } as any;
  const printer = new (PdfPrinter as any)(fonts);

  const now = new Date();
  const issued = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const content: any[] = [];

  // Title
  content.push({ text: "CKA Cash Ups — Product Overview", style: "title" });
  content.push({ text: `Issued: ${issued}`, margin: [0, 4, 0, 16] });

  // Features
  content.push({ text: "Core Features", style: "h1" });
  content.push({ ul: [
    "Cash Up wizard (3 steps): Trip, Guides & Pax, Payments & Flags",
    "Trip date and time pickers with native-first + custom fallback",
    "Local draft auto-save and restore (per browser)",
    "Discount lines + discounts total computed",
    "Per-guide fee calculation using FeeRate (PER_TRIP + PER_PAX)",
    "My Trips list and detail views",
    "Single-trip PDF export from detail page",
    "Admin: Guides (add/deactivate), All Trips (status updates)",
    "Reports: Daily/Monthly/Yearly — PDF and Excel downloads",
    "Scheduled monthly report email with PDF+Excel attachments",
    "Authentication: email+name sign-in, JWT cookie session, RBAC (ADMIN/USER)",
    "Access control via middleware for /trips, /admin, /api",
    "PWA: manifest + service worker for basic offline-first cache",
    "Audit logging on account creation, sign-in, and trip updates",
  ]});

  // User journeys
  content.push({ text: "User Journeys", style: "h1", margin: [0, 12, 0, 6] });
  content.push({ text: "Guide/User — Create a Cash Up", style: "h2" });
  content.push({ ol: [
    "Sign in with email + name (new users auto-provisioned if permitted)",
    "Land on New Cash Up (/trips/new) after sign-in",
    "Step 1: Choose trip date/time, enter lead name, optional notes",
    "Step 2: Select guides by rank and enter total pax",
    "Step 3: Capture payments (cash received, phone pouches, water sales, sunglasses sales), add discounts, set flags, add suggestions",
    "Submit to create a Trip; view it in My Trips",
    "Open trip detail to review and optionally Download PDF",
  ]});

  content.push({ text: "Admin — Manage and Report", style: "h2", margin: [0, 8, 0, 0] });
  content.push({ ol: [
    "Manage guides: add new or deactivate existing",
    "Manage guides (add/deactivate) and oversee trips",
    "View All Trips and update statuses (DRAFT, SUBMITTED, APPROVED, REJECTED, LOCKED)",
    "Generate Daily/Monthly/Yearly reports (PDF/Excel)",
    "Configure monthly report email via cron hitting /api/reports/monthly-email",
  ]});

  content.push({ text: "Account — Name Reset", style: "h2", margin: [0, 8, 0, 0] });
  content.push({ ul: [
    "Use Forgot Name to receive a reset link",
    "Open the link and set a new display name",
  ]});

  // Technical overview bullets
  content.push({ text: "Technical Overview", style: "h1", margin: [0, 12, 0, 6] });
  content.push({ ul: [
    "Next.js 14 App Router; server routes in app/api/*",
    "Prisma (PostgreSQL) models: User, Guide, Trip, TripGuide, PaymentBreakdown, DiscountLine, FeeRate, Invite, AuditLog, Setting",
    "PDFs built with pdfmake; Excel with ExcelJS",
    "Timezone handling with date-fns-tz (defaults to Africa/Johannesburg)",
    "JWT cookie session (auth-token); route protection in middleware",
  ]});

  // Useful endpoints
  content.push({ text: "Key Endpoints", style: "h1", margin: [0, 12, 0, 6] });
  content.push({ ul: [
    "POST /api/auth/signin — Sign in, sets JWT cookie",
    "GET /api/auth/session — Current session info",
    "POST /api/auth/signout — Clear session cookie",
    "GET /api/trips — List trips (role-aware)",
    "POST /api/trips — Create trip (calculates per-guide fees)",
    "GET /api/trips/:id — Trip detail; PATCH to update status/fields",
    "GET /api/trips/:id/pdf — Single-trip PDF export",
    "GET /api/reports/daily?date=YYYY-MM-DD&format=pdf|xlsx",
    "GET /api/reports/monthly?month=YYYY-MM&format=pdf|xlsx",
    "GET /api/reports/yearly?year=YYYY&format=pdf|xlsx",
    "GET /api/reports/monthly-email?month=YYYY-MM — Email PDF+Excel to admins",
  ]});

  // Notes
  content.push({ text: "Notes", style: "h1", margin: [0, 12, 0, 6] });
  content.push({ ul: [
    "Fee rates removed from code; guide feeAmount fixed at 0",
    "After sign-in, users are redirected to New Cash Up",
  ]});

  const docDefinition = {
    content,
    styles: {
      title: { fontSize: 18, bold: true },
      h1: { fontSize: 14, bold: true, margin: [0, 6, 0, 4] },
      h2: { fontSize: 12, bold: true, margin: [0, 4, 0, 2] },
    },
    defaultStyle: { fontSize: 10 },
    pageMargins: [36, 36, 36, 36],
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
      "Content-Disposition": `attachment; filename="CKA-CashUps-Overview.pdf"`,
    },
  });
}
