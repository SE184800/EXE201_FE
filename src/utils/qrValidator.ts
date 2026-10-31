/**
 * Lightweight QR Code Image Validator
 * Detects whether an uploaded image contains a QR code matrix / finder pattern.
 * Uses native BarcodeDetector API when available, with a fast Canvas-based
 * 1:1:3:1:1 finder pattern & contrast heuristic fallback.
 */

export interface QrValidationResult {
  isValid: boolean;
  message?: string;
}

export async function validateQrCodeImage(file: File): Promise<QrValidationResult> {
  if (!file) {
    return { isValid: false, message: 'Vui lòng chọn file ảnh mã QR.' };
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      message: 'Định dạng ảnh không được hỗ trợ. Vui lòng chọn file ảnh JPG, PNG hoặc WEBP.',
    };
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return {
      isValid: false,
      message: 'Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.',
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      // Method 1: Check with native BarcodeDetector if available (supported in Chrome/Edge)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(img);
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            return resolve({ isValid: true });
          } else {
            return resolve({
              isValid: false,
              message:
                'Ảnh được đăng lên không phải là mã QR. Vui lòng chụp hoặc tải lại đúng ảnh mã QR thanh toán của ngân hàng.',
            });
          }
        } catch {
          // If detector throws, fall through to canvas heuristic
        }
      }

      // Method 2: Canvas-based QR finder pattern scanner (1:1:3:1:1 module ratio)
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve({ isValid: true });

        // Normalize dimension for fast inspection
        const maxDim = 400;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        let darkCount = 0;
        let lightCount = 0;
        let midtoneCount = 0;
        const sampleStep = 3;
        let sampled = 0;

        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 80) darkCount++;
          else if (lum > 175) lightCount++;
          else midtoneCount++;
          sampled++;
        }

        const darkRatio = darkCount / sampled;
        const lightRatio = lightCount / sampled;
        const midRatio = midtoneCount / sampled;

        // Scan for 1:1:3:1:1 Finder Pattern in horizontal lines
        let finderPatternFound = false;
        const stepY = Math.max(2, Math.floor(height / 35));

        for (let y = Math.floor(height * 0.05); y < height * 0.95; y += stepY) {
          const lineRuns: { dark: boolean; count: number }[] = [];
          let currentDark = false;
          let runLength = 0;

          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const isDark = lum < 128;
            if (x === 0) {
              currentDark = isDark;
              runLength = 1;
            } else if (isDark === currentDark) {
              runLength++;
            } else {
              lineRuns.push({ dark: currentDark, count: runLength });
              currentDark = isDark;
              runLength = 1;
            }
          }
          lineRuns.push({ dark: currentDark, count: runLength });

          // Scan for 1:1:3:1:1 ratio
          for (let i = 0; i <= lineRuns.length - 5; i++) {
            if (
              lineRuns[i].dark &&
              !lineRuns[i + 1].dark &&
              lineRuns[i + 2].dark &&
              !lineRuns[i + 3].dark &&
              lineRuns[i + 4].dark
            ) {
              const r1 = lineRuns[i].count;
              const r2 = lineRuns[i + 1].count;
              const r3 = lineRuns[i + 2].count;
              const r4 = lineRuns[i + 3].count;
              const r5 = lineRuns[i + 4].count;
              const moduleSize = (r1 + r2 + r4 + r5) / 4;
              if (moduleSize >= 2) {
                const variance =
                  Math.abs(r1 - moduleSize) +
                  Math.abs(r2 - moduleSize) +
                  Math.abs(r4 - moduleSize) +
                  Math.abs(r5 - moduleSize);
                if (variance / moduleSize < 2.0 && Math.abs(r3 - 3 * moduleSize) < 2.5 * moduleSize) {
                  finderPatternFound = true;
                  break;
                }
              }
            }
          }
          if (finderPatternFound) break;
        }

        const aspect = width / height;
        const isReasonableAspect = aspect >= 0.5 && aspect <= 2.0;

        if (finderPatternFound || (isReasonableAspect && darkRatio > 0.12 && lightRatio > 0.25 && midRatio < 0.55)) {
          return resolve({ isValid: true });
        }

        return resolve({
          isValid: false,
          message:
            'Ảnh được đăng lên không phải là mã QR. Vui lòng chụp hoặc tải lại đúng ảnh mã QR thanh toán của ngân hàng.',
        });
      } catch {
        return resolve({ isValid: true });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        isValid: false,
        message: 'Không thể đọc tệp ảnh. Vui lòng kiểm tra lại file ảnh.',
      });
    };

    img.src = objectUrl;
  });
}
