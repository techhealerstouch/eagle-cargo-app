
import { usePage } from '@inertiajs/react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Printer, Download, Package } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import BrandLogoImage, { getLogoSources } from '@/components/layout/brand-logo-image';



interface QrCodeLabelProps {
    trackingNumber: string;
    serialNumber?: string;
    bookingRef?: string;
    senderName?: string;
    senderPhone?: string;
    senderAddress?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientAddress?: string;
    destination?: string;
    paymentStatus?: string;
    status?: string;
    boxType?: string;
    serviceType?: string;
    preferredDate?: string;
    boxLabel?: string;
    size?: number;
    showActions?: boolean;
}

  export interface QrCodeLabelHandle {
    handlePrint: () => void;
    handleDownload: () => Promise<void>;
  }

  const QrCodeLabel = forwardRef<QrCodeLabelHandle, QrCodeLabelProps>(({
    trackingNumber,
    serialNumber,
    bookingRef,
    senderName,
    senderPhone,
    senderAddress,
    recipientName,
    recipientPhone,
    recipientAddress,
    destination,
    paymentStatus = 'pending',
    status = 'confirmed',
    boxType,
    preferredDate,
    boxLabel,
    size = 180,
    showActions = true,
}: QrCodeLabelProps, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const { settings } = usePage().props as any;
    const logoSources = useMemo(() => getLogoSources(settings?.appLogo), [settings?.appLogo]);
    const logoSourceKey = logoSources.join('|');
    const appLogo = logoSources[0] ?? null;
    const appName = settings?.appName || 'Box Tracker';
    const appSubtitle = settings?.appSubtitle || 'SEA CARGO';
    const qrValue = serialNumber || trackingNumber;

    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const readBlobAsDataUrl = (blob: Blob) =>
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

        async function loadLogo() {
            for (const logoSource of logoSources) {
                const absoluteUrl = logoSource.startsWith('http') || logoSource.startsWith('data:')
                    ? logoSource
                    : `${window.location.origin}${logoSource}`;

                try {
                    const response = await fetch(absoluteUrl);

                    if (!response.ok) {
                        throw new Error(`Logo request failed with ${response.status}`);
                    }

                    const dataUrl = await readBlobAsDataUrl(await response.blob());

                    if (!cancelled) {
                        setLogoDataUrl(dataUrl);
                    }

                    return;
                } catch (err) {
                    console.error('Failed to convert app logo to data URL', err);
                }
            }

            if (!cancelled) {
                setLogoDataUrl(null);
            }
        }

        loadLogo();

        return () => {
            cancelled = true;
        };
    }, [logoSourceKey, logoSources]);

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, qrValue, {
                width: size,
                margin: 2,
                color: {
                    dark: '#1c1917',
                    light: '#ffffff',
                },
                errorCorrectionLevel: 'H',
            }).catch(console.error);
        }
    }, [qrValue, size]);

    const getPrintHtml = (qrDataUrl: string) => {

      const labelDate = new Date().toLocaleDateString();

      return `
            <html>
              <head>
                <title>QR Label – ${qrValue}</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: #fff;
                  }
                  .label-wrapper {
                    border: 1px solid #000;
                    border-radius: 8px;
                    width: 380px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                  }
                  .header {
                    background: #fff;
                    border-bottom: 2px solid #000;
                    padding: 8px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .brand-box { display: flex; align-items: center; gap: 12px; }
                  .brand-logo-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 60px;
                    height: 60px;
                    flex-shrink: 0;
                  }
                  .brand-logo {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                  }
                  .brand-text-container {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                  }
                  .brand-name {
                    font-weight: 900;
                    font-size: 13px;
                    line-height: 1.2;
                    color: #000;
                  }
                  .brand-subtitle-container {
                    display: flex;
                    align-items: center;
                    margin-top: 2px;
                  }
                  .brand-subtitle-line {
                    width: 12px;
                    height: 2px;
                    background-color: #c2410c;
                    border-radius: 9999px;
                    margin-right: 4px;
                    display: inline-block;
                  }
                  .brand-subtitle {
                    font-size: 8px;
                    font-weight: 900;
                    color: #c2410c;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    line-height: 1;
                  }
                  .scan-status { text-align: right; font-size: 9px; line-height: 1.2; }
                  .ref-header {
                    padding: 8px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    border-bottom: 1px solid #000;
                  }
                  .ref-num { font-size: 15px; font-weight: 950; letter-spacing: -1px; }
                  .date-box { text-align: right; font-size: 9px; }
                  .sub-header {
                    background: #000;
                    color: #fff;
                    border-bottom: 1px solid #000;
                    padding: 6px;
                    text-align: center;
                    font-weight: 900;
                    font-size: 10px;
                    text-transform:;
                    letter-spacing: 2px;
                  }
                  .content { padding: 16px; }
                  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
                  .info-title { font-size: 9px; font-weight: 900; text-transform:; display: block; margin-bottom: 6px; color: #000; border-bottom: 1px solid #eee; padding-bottom: 2px; }
                  .info-item { margin-bottom: 6px; }
                  .info-label { font-size: 7px; color: #666; display: block; text-transform:; font-weight: bold; }
                  .info-value { font-size: 10px; font-weight: 900; display: block; color: #000; }
                  .info-value-sm { font-size: 8px; font-weight: 600; display: block; color: #333; line-height: 1.3; }
                  .meta-bar { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; margin-bottom: 10px; }
                  .meta-item { text-align: center; flex: 1; }
                  .meta-label { font-size: 6px; color: #999; display: block; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; }
                  .meta-value { font-size: 9px; font-weight: 900; color: #000; display: block; }
                  .qr-section {
                    border-top: 1px dashed #000;
                    padding-top: 12px;
                    text-align: center;
                  }
                  .qr-img { display: block; margin: 0 auto 8px; border: 1px solid #eee; padding: 4px; }
                  .serial-num-display { font-family: "Courier New", Courier, monospace; font-size: 18px; font-weight: 900; letter-spacing: 3px; color: #000; }
                  .tracking-num-display { font-family: "Courier New", Courier, monospace; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #555; margin-top: 3px; }
                  .footer {
                    border-top: 1px solid #000;
                    padding: 8px 12px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8px;
                    color: #000;
                    background: #f8f8f8;
                    font-weight: bold;
                  }
                  @page {
                    size: 95mm 140mm;
                    margin: 0;
                  }
                  @media print {
                    html, body {
                      width: 95mm;
                      height: 140mm;
                      margin: 0;
                      padding: 0;
                      background: #fff;
                      display: block !important;
                      overflow: hidden;
                      box-sizing: border-box;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                    .label-wrapper {
                      width: 91mm;
                      height: 136mm;
                      border: 2px solid #000 !important;
                      border-radius: 0 !important;
                      margin: 2mm auto;
                      padding: 4mm;
                      box-shadow: none !important;
                      display: flex !important;
                      flex-direction: column !important;
                      background: #fff !important;
                      box-sizing: border-box !important;
                      overflow: hidden;
                    }
                    .header, .ref-header, .footer {
                      padding-left: 0 !important;
                      padding-right: 0 !important;
                    }
                    .info-grid {
                      display: flex !important;
                      flex-direction: row !important;
                      justify-content: space-between !important;
                      gap: 16px !important;
                      margin-bottom: 16px !important;
                    }
                    .info-grid > div {
                      flex: 1 !important;
                      min-width: 0 !important;
                    }
                    .info-label {
                      color: #000 !important;
                    }
                    .footer {
                      background: #fff !important;
                      display: flex !important;
                      justify-content: space-between !important;
                      margin-top: auto !important;
                      padding: 4px 8px !important;
                    }
                    .content {
                      flex: 1 !important;
                      display: flex !important;
                      flex-direction: column !important;
                      justify-content: space-between !important;
                      padding: 6px 0 !important;
                    }
                    .qr-section {
                      margin-top: auto !important;
                      padding-top: 4px !important;
                    }
                    .qr-img {
                      border: none !important;
                      padding: 0 !important;
                      width: 90px !important;
                      height: 90px !important;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="label-wrapper" id="pdf-target">
                  <div class="header">
                    <div class="brand-box">
                      ${logoDataUrl ? `
                        <div class="brand-logo-container">
                          <img src="${logoDataUrl}" class="brand-logo" alt="${appName}" />
                        </div>
                      ` : ''}
                      <div class="brand-text-container">
                        <div class="brand-name">${appName}</div>
                        ${appSubtitle ? `
                          <div class="brand-subtitle-container">
                            <span class="brand-subtitle-line"></span>
                            <span class="brand-subtitle">${appSubtitle}</span>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                    <div class="scan-status">
                      <div style="text-transform:; font-weight: bold;">Status:</div>
                      <strong style="font-size: 12px; color: ${status === 'paid' || status === 'confirmed' ? '#059669' : '#000'}">${status.toUpperCase()}</strong>
                    </div>
                  </div>
                  <div class="ref-header">
                    <div class="ref-num">${bookingRef || 'N/A'}</div>
                    <div class="date-box">
                      <div>Label Date:</div>
                      <strong>${labelDate}</strong>
                    </div>
                  </div>
                  <div class="sub-header">Box Serial & Tracking Label</div>
                  <div class="content">
                    ${(boxType || preferredDate || boxLabel) ? `
                    <div class="meta-bar">
                      ${boxType ? `<div class="meta-item"><span class="meta-label">Box Type</span><span class="meta-value">${boxType}</span></div>` : ''}
                      ${preferredDate ? `<div class="meta-item"><span class="meta-label">Pickup Date</span><span class="meta-value">${preferredDate}</span></div>` : ''}
                      ${boxLabel ? `<div class="meta-item"><span class="meta-label">Box</span><span class="meta-value">${boxLabel}</span></div>` : ''}
                    </div>
                    ` : ''}
                    <div class="info-grid">
                      <div>
                        <span class="info-title">Sender</span>
                        <div class="info-item">
                          <span class="info-value">${senderName || '-'}</span>
                          ${senderPhone ? `<span class="info-value-sm">${senderPhone}</span>` : ''}
                          ${senderAddress ? `<span class="info-value-sm">${senderAddress}</span>` : ''}
                        </div>
                      </div>
                      <div>
                        <span class="info-title">Recipient</span>
                        <div class="info-item">
                          <span class="info-value">${recipientName || '-'}</span>
                          ${recipientPhone ? `<span class="info-value-sm">${recipientPhone}</span>` : ''}
                          ${recipientAddress ? `<span class="info-value-sm">${recipientAddress}</span>` : ''}
                        </div>
                      </div>
                    </div>
                    <div class="info-grid">
                      <div>
                        <div class="info-item">
                          <span class="info-label">Destination</span>
                          <span class="info-value">${destination || '-'}</span>
                        </div>
                      </div>
                      <div>
                        <div class="info-item">
                          <span class="info-label">Payment</span>
                          <span class="info-value">${paymentStatus.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <div class="qr-section">
                      <img src="${qrDataUrl}" class="qr-img" width="120" height="120" />
                      <div class="serial-num-display">${trackingNumber}</div>
                      ${serialNumber ? `<div class="tracking-num-display">Serial: ${serialNumber}</div>` : ''}
                    </div>
                  </div>
                  <div class="footer">
                    <div></div>
                    <div style="text-align: right;">
                      PRINT TIMESTAMP:<br/><strong>${new Date().toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </body>
            </html>
        `;
    };

    const handlePrint = () => {
        const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

        const dataUrl = canvas.toDataURL('image/png');
        const win = window.open('', '_blank');

        if (!win) {
          return;
        }

        win.document.write(getPrintHtml(dataUrl));
        win.document.write('<script>window.onload = () => { window.print(); window.close(); };</script>');
        win.document.close();
    };

      useImperativeHandle(ref, () => ({
        handlePrint,
        handleDownload,
      }));

    const handleDownload = async () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

        try {
            setIsDownloading(true);
            const dataUrl = canvas.toDataURL('image/png');

            // Create a hidden iframe to render the print layout exactly
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '380px';
            iframe.style.height = '600px';
            iframe.style.left = '-9999px';
            iframe.style.top = '-9999px';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow?.document;

            if (!doc) {
              throw new Error('Could not create iframe document');
            }

            doc.open();
            doc.write(getPrintHtml(dataUrl));
            doc.close();

            // Wait for styles and images to apply
            await new Promise(resolve => setTimeout(resolve, 300));

            const targetElement = doc.getElementById('pdf-target');

            if (!targetElement) {
              throw new Error('Could not find label target');
            }

            // Generate image of the print layout
            const printDataUrl = await toPng(targetElement as HTMLElement, {
                cacheBust: true,
                pixelRatio: 3,
                backgroundColor: '#ffffff',
            });

            // Cleanup iframe
            document.body.removeChild(iframe);

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [95, 140]
            });

            // Add 0.05 inch (~1.27mm) margin
            const margin = 1.27;
            const pdfWidth = 95;
            const pdfHeight = 140;
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeight = imgWidth * 1.5; // keep 100x150 aspect ratio (1:1.5)
            const x = margin;
            const y = (pdfHeight - imgHeight) / 2; // Center vertically

            pdf.addImage(printDataUrl, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`Label-${qrValue}.pdf`);
        } catch (error) {
            console.error('Failed to download label', error);
        } finally {
            setIsDownloading(false);
        }
    };    return (
        <div className="flex flex-col items-center gap-3 group p-1">
            <div ref={labelRef} className="w-full max-w-[360px] min-w-[300px] flex flex-col bg-white rounded-xl shadow-xl border border-zinc-100 ring-1 ring-zinc-100/5 transition-all duration-300 group-hover:shadow-2xl relative overflow-hidden text-zinc-900">
                <div className="bg-orange-50/40 border-b border-zinc-900/10 p-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <BrandLogoImage
                            src={appLogo}
                            alt={appName}
                            className="size-14 shrink-0 object-contain"
                            fallback={
                                <div className="flex items-center justify-center rounded-xl bg-orange-100/80 p-2 text-orange-700 size-14 grow-0 shrink-0">
                                     <Package className="size-6" />
                                </div>
                            }
                        />
                        <div className="flex flex-col justify-center min-w-0">
                            <span className="font-bold text-[13px] text-zinc-900 leading-tight">{appName}</span>
                            {appSubtitle && (
                                <div className="flex items-center mt-0.5">
                                    <span className="inline-block w-3 h-0.5 bg-[#c2410c] rounded-full mr-1 shrink-0"></span>
                                    <span className="text-[7.5px] font-black tracking-[0.15em] text-[#c2410c] uppercase leading-none truncate">
                                        {appSubtitle}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-right leading-tight text-zinc-650">
                        <span className="block tracking-tighter text-zinc-500">Current Status:</span>
                        <span className={`font-bold ${
                            status === 'paid' || status === 'confirmed' ? 'text-emerald-600' :
                            status === 'pending' ? 'text-amber-600' : 'text-zinc-600'
                        }`}>{status.toUpperCase()}</span>
                    </div>
                </div>

                <div className="px-4 py-2.5 flex items-baseline justify-between bg-white border-b border-zinc-900/10 z-10">
                    <span className="font-medium text-xl tracking-tight text-zinc-900">{bookingRef}</span>
                    <div className="text-xs text-right text-zinc-650">
                        <span className="block text-zinc-500 tracking-tighter">Label Date</span>
                        <span className="font-semibold text-zinc-800">{new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                    </div>
                </div>

                <div className="bg-orange-100/40 border-b border-zinc-900/10 py-1 text-center z-10">
                    <span className="font-medium text-xs text-orange-900">Box Serial & Tracking Label</span>
                </div>

                <div className="p-4 bg-white z-10 flex-1 flex flex-col justify-between">
                    {/* Meta bar: Box Type / Pickup Date / Box # */}
                    {(boxType || preferredDate || boxLabel) && (
                        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-zinc-100">
                            {boxType && (
                                <div className="text-center flex-1">
                                    <p className="text-[7px] text-zinc-500 uppercase tracking-widest leading-none mb-0.5 font-bold">Box Type</p>
                                    <p className="text-[10px] font-bold text-zinc-900">{boxType}</p>
                                </div>
                            )}
                            {preferredDate && (
                                <div className="text-center flex-1">
                                    <p className="text-[7px] text-zinc-500 uppercase tracking-widest leading-none mb-0.5 font-bold">Pickup Date</p>
                                    <p className="text-[10px] font-bold text-zinc-900">{preferredDate}</p>
                                </div>
                            )}
                            {boxLabel && (
                                <div className="text-center flex-1">
                                    <p className="text-[7px] text-zinc-500 uppercase tracking-widest leading-none mb-0.5 font-bold">Box</p>
                                    <p className="text-[10px] font-bold text-zinc-900">{boxLabel}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="space-y-1 text-zinc-800">
                            <h4 className="text-[9px] font-bold text-zinc-500 tracking-wider border-b border-zinc-100 pb-1 mb-1.5">Sender</h4>
                            <p className="text-xs font-bold text-zinc-900 line-clamp-1">{senderName}</p>
                            {senderPhone && <p className="text-[9px] text-zinc-700 font-medium line-clamp-1">{senderPhone}</p>}
                            {senderAddress && <p className="text-[8px] text-zinc-600 line-clamp-2 leading-snug">{senderAddress}</p>}
                        </div>

                        <div className="space-y-1 text-zinc-800">
                            <h4 className="text-[9px] font-bold text-zinc-500 tracking-wider border-b border-zinc-100 pb-1 mb-1.5">Recipient</h4>
                            <p className="text-xs font-bold text-zinc-900 line-clamp-1">{recipientName || '-'}</p>
                            {recipientPhone && <p className="text-[9px] text-zinc-700 font-medium line-clamp-1">{recipientPhone}</p>}
                            {recipientAddress && <p className="text-[8px] text-zinc-600 line-clamp-2 leading-snug">{recipientAddress}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <p className="text-[8px] text-zinc-500 font-bold leading-none mb-0.5">Destination</p>
                            <p className="text-xs font-bold text-zinc-950 line-clamp-1">{destination}</p>
                        </div>
                        <div>
                            <p className="text-[8px] text-zinc-500 font-bold leading-none mb-0.5">Payment</p>
                            <p className={`text-xs font-bold ${
                                paymentStatus === 'paid' ? 'text-emerald-600' :
                                paymentStatus === 'pending' ? 'text-amber-600' :
                                'text-zinc-650'
                            }`}>
                                {paymentStatus.toUpperCase()}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center pt-3 border-t border-dashed border-zinc-200">
                        <div className="bg-white p-1.5 rounded-lg ring-1 ring-zinc-100 shadow-sm mb-2">
                            <canvas
                                ref={canvasRef}
                                className="block h-28 w-28 [image-rendering:pixelated]"
                            />
                        </div>
                        <p className="font-mono text-lg font-semibold text-zinc-900">
                            {trackingNumber}
                        </p>
                        {serialNumber && (
                            <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                Serial: {serialNumber}
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-50/50 border-t border-zinc-900/10 px-4 py-2.5 pb-3 flex justify-end items-center text-[8px] text-zinc-500 z-10 font-mono">
                    <div className="leading-tight text-right">
                        <p className="uppercase tracking-tighter mb-0.5">Print Timestamp</p>
                        <p className="text-zinc-700 font-bold tracking-wider">{new Date().toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {showActions && (
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="p-2 text-zinc-500 hover:text-brand-navy hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Print Label"
                    >
                        <Printer className="size-5" />
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="p-2 text-zinc-500 hover:text-brand-navy hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download Label"
                    >
                        {isDownloading ? (
                            <div className="size-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Download className="size-5" />
                        )}
                    </button>
                </div>
            )}
        </div>
    );
});

QrCodeLabel.displayName = 'QrCodeLabel';

export default QrCodeLabel;





