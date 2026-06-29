import PDFDocument from "pdfkit";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  buyerName: string;
  buyerEmail: string;
  buyerClId: string;
  competitionTitle: string;
  events: string[];
  baseFee: number;
  perEventFee: number;
  eventCount: number;
  totalAmount: number;
  paymentId: string;
  razorpayPaymentId?: string;
}

function fmtInr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function generateInvoicePDF(data: InvoiceData): typeof PDFDocument.prototype {
  const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
  const w = 595.28;

  // Header
  doc.fontSize(20).fillColor("#1a1a1a").text("CUBELELO EVENTS", 50, 50);
  doc.fontSize(10).fillColor("#666666").text("GST Invoice", 50, 75);

  // Invoice details (right side)
  doc.fontSize(9).fillColor("#333333");
  doc.text(`Invoice #: ${data.invoiceNumber}`, 380, 50, { width: 165, align: "right" });
  doc.text(`Date: ${data.date}`, 380, 64, { width: 165, align: "right" });
  if (data.razorpayPaymentId) {
    doc.text(`Payment Ref: ${data.razorpayPaymentId}`, 380, 78, { width: 165, align: "right" });
  }

  doc.moveTo(50, 100).lineTo(w - 50, 100).lineWidth(1).stroke("#cccccc");

  // Bill To
  doc.fontSize(10).fillColor("#888888").text("BILL TO", 50, 115);
  doc.fontSize(11).fillColor("#1a1a1a").text(data.buyerName, 50, 132);
  doc.fontSize(9).fillColor("#555555").text(`CL ID: ${data.buyerClId}`, 50, 148);
  doc.text(`Email: ${data.buyerEmail}`, 50, 162);

  // Competition
  doc.fontSize(10).fillColor("#888888").text("COMPETITION", 300, 115);
  doc.fontSize(11).fillColor("#1a1a1a").text(data.competitionTitle, 300, 132);
  doc.fontSize(9).fillColor("#555555").text(`Events: ${data.events.join(", ")}`, 300, 148);

  // Table
  const tableTop = 200;
  const colX = [50, 280, 380, 470];

  doc.rect(50, tableTop, w - 100, 22).fill("#f0f0f0");
  doc.fontSize(9).fillColor("#333333");
  doc.text("Description", colX[0]! + 8, tableTop + 6, { width: 220 });
  doc.text("Qty", colX[1]! + 8, tableTop + 6, { width: 80 });
  doc.text("Rate", colX[2]! + 8, tableTop + 6, { width: 80 });
  doc.text("Amount", colX[3]! + 8, tableTop + 6, { width: 80 });

  let y = tableTop + 28;

  // Base fee line
  if (data.baseFee > 0) {
    doc.fontSize(9).fillColor("#333333");
    doc.text("Registration Base Fee", colX[0]! + 8, y, { width: 220 });
    doc.text("1", colX[1]! + 8, y, { width: 80 });
    doc.text(fmtInr(data.baseFee), colX[2]! + 8, y, { width: 80 });
    doc.text(fmtInr(data.baseFee), colX[3]! + 8, y, { width: 80 });
    y += 20;
  }

  // Per-event fee line
  if (data.perEventFee > 0 && data.eventCount > 0) {
    doc.text("Event Fee", colX[0]! + 8, y, { width: 220 });
    doc.text(String(data.eventCount), colX[1]! + 8, y, { width: 80 });
    doc.text(fmtInr(data.perEventFee), colX[2]! + 8, y, { width: 80 });
    doc.text(fmtInr(data.perEventFee * data.eventCount), colX[3]! + 8, y, { width: 80 });
    y += 20;
  }

  // Divider
  doc.moveTo(50, y + 5).lineTo(w - 50, y + 5).lineWidth(0.5).stroke("#cccccc");
  y += 15;

  // Subtotal
  const subtotal = data.totalAmount;
  const gstRate = 18;
  const gstAmount = Math.round(subtotal * gstRate / (100 + gstRate));
  const preGst = subtotal - gstAmount;

  doc.fontSize(9).fillColor("#555555");
  doc.text("Subtotal (excl. GST)", 350, y, { width: 120, align: "right" });
  doc.text(fmtInr(preGst), colX[3]! + 8, y, { width: 80 });
  y += 18;

  doc.text(`GST @ ${gstRate}%`, 350, y, { width: 120, align: "right" });
  doc.text(fmtInr(gstAmount), colX[3]! + 8, y, { width: 80 });
  y += 18;

  doc.moveTo(350, y).lineTo(w - 50, y).lineWidth(1).stroke("#333333");
  y += 8;

  doc.fontSize(12).fillColor("#1a1a1a");
  doc.text("Total", 350, y, { width: 120, align: "right" });
  doc.text(fmtInr(data.totalAmount), colX[3]! + 8, y, { width: 80 });

  // Footer
  doc.fontSize(8).fillColor("#999999").text(
    "This is a computer-generated invoice and does not require a signature.",
    50, 750,
    { align: "center", width: w - 100 },
  );

  doc.end();
  return doc;
}
