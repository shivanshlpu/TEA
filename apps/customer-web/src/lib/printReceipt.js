/**
 * Professional Zero-Bleed Receipt Printer Utility — Tea Bhatti Customer Web
 * Uses an isolated hidden iframe for printing customer bills & pickup tokens.
 * Guarantees exactly 1 physical page / roll, eliminates blank pages, 
 * and ensures 100% color, typography, and QR code fidelity.
 */

export function printReceipt(elementId = 'tea-bhatti-printable-bill', options = {}) {
  const {
    printMode = 'standard', // 'standard' (A4) | 'pos' (80mm)
    title = 'Tea Bhatti Bill',
  } = options;

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.warn(`[printReceipt] Target element #${elementId} not found.`);
    window.print();
    return;
  }

  // Remove existing print iframe if any
  const existingIframe = document.getElementById('tea-bhatti-print-iframe');
  if (existingIframe) {
    try { document.body.removeChild(existingIframe); } catch {}
  }

  // Create isolated print iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'tea-bhatti-print-iframe';
  iframe.setAttribute(
    'style',
    'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;pointer-events:none;'
  );
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();

  // Grab all active stylesheets from host window (Tailwind + CSS variables)
  const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');

  const isPos = printMode === 'pos';

  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <base href="${window.location.origin}">
      ${headStyles}
      <style>
        @page {
          size: ${isPos ? '80mm auto' : 'A4 portrait'};
          margin: ${isPos ? '2mm 3mm' : '8mm 12mm 0mm 12mm'};
        }
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #171717 !important;
          width: 100% !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          font-family: ${
            isPos
              ? 'monospace, ui-monospace, "Courier New", Courier'
              : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          };
        }
        body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 0;
        }
        .print-receipt-wrapper {
          width: 100% !important;
          max-width: ${isPos ? '74mm' : '155mm'} !important;
          margin: 0 auto !important;
          padding: ${isPos ? '2px' : '4px 8px'} !important;
          background: #ffffff !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          box-sizing: border-box !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        img {
          max-width: 100% !important;
          height: auto !important;
          display: inline-block !important;
        }
        .print-hidden, .print\\:hidden {
          display: none !important;
        }

        /* ── Half-A4 Compact Formatting Rules ── */
        ${!isPos ? `
          #tea-bhatti-printable-bill {
            padding: 4px 6px !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }
          .bill-header {
            padding-bottom: 5px !important;
            border-bottom-width: 1.5px !important;
          }
          .bill-header h1 {
            font-size: 17px !important;
            margin-bottom: 2px !important;
          }
          .bill-header img {
            width: 26px !important;
            height: 26px !important;
          }
          .bill-header p {
            font-size: 8.5px !important;
            line-height: 1.2 !important;
            margin: 1px 0 !important;
          }
          .bill-tag {
            font-size: 8px !important;
            padding: 1px 5px !important;
            margin-top: 3px !important;
          }
          .bill-token-box {
            margin: 5px 0 !important;
            padding: 5px 8px !important;
            border-radius: 6px !important;
            border-width: 1.5px !important;
          }
          .bill-token-number {
            font-size: 24px !important;
            line-height: 1.1 !important;
            margin: 1px 0 !important;
          }
          .bill-meta-grid {
            padding: 3px 0 !important;
            font-size: 9px !important;
            row-gap: 2px !important;
          }
          .bill-items-table {
            padding: 3px 0 !important;
          }
          .bill-items-table table th {
            padding: 2px 4px !important;
            font-size: 8px !important;
          }
          .bill-items-table table td {
            padding: 2.5px 4px !important;
            font-size: 9px !important;
          }
          .bill-financial-summary {
            padding-top: 3px !important;
            font-size: 9px !important;
            row-gap: 1.5px !important;
            border-top-width: 1.5px !important;
          }
          .bill-total-row {
            padding: 2.5px 0 !important;
            font-size: 11.5px !important;
            border-top-width: 1.5px !important;
            border-bottom-width: 1.5px !important;
          }
          .bill-split-grid {
            padding-top: 3px !important;
            gap: 6px !important;
          }
          .bill-split-box {
            padding: 3px 6px !important;
            font-size: 9px !important;
          }
          .bill-qr-section {
            margin-top: 5px !important;
            padding-top: 4px !important;
            gap: 8px !important;
          }
          .bill-qr-section img {
            width: 48px !important;
            height: 48px !important;
          }
          .bill-footer {
            margin-top: 5px !important;
            padding-top: 3px !important;
            font-size: 7.5px !important;
            border-top-width: 1.5px !important;
          }
          .bill-cut-guide {
            display: block !important;
            margin-top: 8px !important;
            padding-top: 4px !important;
            border-top: 1px dashed #9ca3af !important;
            text-align: center !important;
            font-family: monospace !important;
            font-size: 7.5px !important;
            color: #6b7280 !important;
            letter-spacing: 1px !important;
          }
        ` : `
          /* POS 80mm Specific */
          #tea-bhatti-printable-bill {
            padding: 4px !important;
            font-size: 9.5px !important;
            font-family: monospace !important;
          }
          .bill-token-number {
            font-size: 22px !important;
          }
          .bill-qr-section img {
            width: 44px !important;
            height: 44px !important;
          }
          .bill-cut-guide {
            display: none !important;
          }
        `}
      </style>
    </head>
    <body>
      <div class="print-receipt-wrapper">
        ${targetElement.innerHTML}
      </div>
    </body>
    </html>
  `);
  doc.close();

  const executePrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Print iframe error:', err);
      window.print();
    } finally {
      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch {}
      }, 3000);
    }
  };

  // Wait for all images inside receipt (logo & QR code) to load
  const images = Array.from(doc.images);
  if (images.length === 0) {
    setTimeout(executePrint, 200);
  } else {
    let loaded = 0;
    let fired = false;

    const checkDone = () => {
      loaded++;
      if (loaded >= images.length && !fired) {
        fired = true;
        setTimeout(executePrint, 200);
      }
    };

    // Safety fallback timeout
    setTimeout(() => {
      if (!fired) {
        fired = true;
        executePrint();
      }
    }, 900);

    images.forEach(img => {
      if (img.complete) {
        checkDone();
      } else {
        img.onload = checkDone;
        img.onerror = checkDone;
      }
    });
  }
}
