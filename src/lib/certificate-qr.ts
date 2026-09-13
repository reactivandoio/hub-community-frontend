import QRCode from 'qrcode';

// Works in Node and in the browser; react-pdf's <Image> accepts data URLs.
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 0, width: 240, errorCorrectionLevel: 'M' });
}
