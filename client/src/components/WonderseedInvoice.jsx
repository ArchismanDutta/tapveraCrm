import React, { useRef } from "react";
import { Download, ExternalLink, FileText, CheckCircle } from "lucide-react";
import tapveraLogo from "../assets/tapvera.png";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const INVOICE = {
  number: "INV-2025-WS001",
  date: "February 25, 2025",
  dueDate: "March 10, 2025",
  client: {
    name: "Harshad Patel",
    company: "Wonderseed",
    email: "harshad.patel@javind.com",
  },
  from: {
    name: "Tapvera",
    email: "billing@tapvera.com",
    website: "www.tapvera.com",
  },
  items: [
    {
      description: "Digital Marketing & CRM Services",
      detail: "Monthly retainer — March 2025",
      amount: 1200.0,
    },
  ],
  total: 1200.0,
};

const WonderseedInvoice = () => {
  const invoiceRef = useRef(null);

  const handleDownloadPDF = async () => {
    const element = invoiceRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = (canvas.height * pageWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
      pdf.save(`Invoice-${INVOICE.number}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  return (
    <div className="mb-6 lg:mb-8">
      {/* Banner */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h2 className="text-base font-semibold text-white">Your Invoice</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/40">
          Payment Due
        </span>
      </div>

      {/* Invoice Card */}
      <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] overflow-hidden">
        {/* Printable Invoice Area */}
        <div ref={invoiceRef} className="bg-white p-8 sm:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
            {/* Logo + From */}
            <div>
              <img
                src={tapveraLogo}
                alt="Tapvera"
                className="h-10 mb-3 object-contain"
              />
              <p className="text-xs text-gray-500">{INVOICE.from.email}</p>
              <p className="text-xs text-gray-500">{INVOICE.from.website}</p>
            </div>

            {/* Invoice Meta */}
            <div className="text-right">
              <h1 className="text-3xl font-bold text-gray-800 tracking-widest mb-1">
                INVOICE
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                {INVOICE.number}
              </p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-end gap-6 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Date:</span>
                  <span>{INVOICE.date}</span>
                </div>
                <div className="flex justify-end gap-6 text-xs">
                  <span className="font-medium text-gray-700">Due Date:</span>
                  <span className="text-red-500 font-semibold">
                    {INVOICE.dueDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-6" />

          {/* Bill To */}
          <div className="mb-8">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Bill To
            </p>
            <p className="text-base font-bold text-gray-800">
              {INVOICE.client.company}
            </p>
            <p className="text-sm text-gray-600">{INVOICE.client.name}</p>
            <p className="text-sm text-gray-500">{INVOICE.client.email}</p>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-md">
                    Description
                  </th>
                  <th className="text-right px-4 py-3 font-semibold rounded-tr-md">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {INVOICE.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-800">
                        {item.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.detail}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-800">
                      ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end mb-8">
            <div className="w-56">
              <div className="flex justify-between items-center py-2 border-t border-gray-200 text-sm text-gray-500">
                <span>Subtotal</span>
                <span>${INVOICE.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-200 text-sm text-gray-500">
                <span>Tax (0%)</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-t-2 border-gray-800 mt-1">
                <span className="font-bold text-gray-800 text-base">Total</span>
                <span className="font-bold text-gray-800 text-xl">
                  $1,200.00
                </span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 text-center">
              Thank you for your business. Please complete the payment by the due
              date.
            </p>
          </div>
        </div>

        {/* Action Buttons (outside printable area) */}
        <div className="bg-[#0f1419] px-6 py-4 flex flex-col sm:flex-row items-center gap-3 border-t border-[#232945]">
          {/* Pay via Remitly */}
          <a
            href="https://www.remitly.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-lg shadow-emerald-900/30 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Pay via Remitly
          </a>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#232945] hover:bg-[#2d3558] text-blue-300 border border-[#232945] hover:border-blue-500/40 font-medium transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>

          {/* Status hint */}
          <div className="sm:ml-auto flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Secure payment via Remitly
          </div>
        </div>
      </div>
    </div>
  );
};

export default WonderseedInvoice;
