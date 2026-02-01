/**
 * ScreenshotCapture.js
 * Captures WebGL canvas to image blob
 *
 * CRITICAL: Renderer must be created with { preserveDrawingBuffer: true }
 * This has a ~5-10% performance cost but is required for screenshots.
 *
 * Usage:
 * - Call capture() immediately after renderer.render(), before next frame
 * - The capture is async (uses toBlob)
 */
export class ScreenshotCapture {
  /**
   * @param {THREE.WebGLRenderer} renderer - Must have preserveDrawingBuffer: true
   */
  constructor(renderer) {
    this.renderer = renderer;
    this.canvas = renderer.domElement;

    // Verify preserveDrawingBuffer is enabled
    this._verifyConfig();
  }

  /**
   * Verify renderer configuration
   * @private
   */
  _verifyConfig() {
    try {
      const gl = this.renderer.getContext();
      const contextAttributes = gl.getContextAttributes();
      if (!contextAttributes.preserveDrawingBuffer) {
        console.warn(
          '[ScreenshotCapture] preserveDrawingBuffer is false - screenshots may be blank! ' +
          'Add { preserveDrawingBuffer: true } to WebGLRenderer options.'
        );
      }
    } catch (e) {
      console.warn('[ScreenshotCapture] Could not verify renderer config:', e);
    }
  }

  /**
   * Capture current canvas state as blob
   * MUST be called immediately after renderer.render(), before next frame
   *
   * @param {string} format - 'image/png' or 'image/jpeg'
   * @param {number} quality - JPEG quality 0-1 (ignored for PNG)
   * @returns {Promise<Blob>}
   */
  capture(format = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
      try {
        this.canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null - check preserveDrawingBuffer'));
            }
          },
          format,
          quality
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Capture as data URL (for immediate display)
   * Synchronous but larger memory footprint than blob
   *
   * @param {string} format - 'image/png' or 'image/jpeg'
   * @param {number} quality - JPEG quality 0-1 (ignored for PNG)
   * @returns {string} Base64 data URL
   */
  captureDataURL(format = 'image/png', quality = 0.92) {
    return this.canvas.toDataURL(format, quality);
  }

  /**
   * Capture and scale down (for mobile memory optimization)
   *
   * @param {number} maxDimension - Max width or height
   * @param {string} format - Image format
   * @param {number} quality - JPEG quality
   * @returns {Promise<Blob>}
   */
  captureScaled(maxDimension = 1920, format = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
      const { width, height } = this.getDimensions();

      // Check if scaling is needed
      if (width <= maxDimension && height <= maxDimension) {
        return this.capture(format, quality).then(resolve).catch(reject);
      }

      // Calculate scaled dimensions
      const scale = maxDimension / Math.max(width, height);
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      // Create temporary canvas for scaling
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = scaledWidth;
      tempCanvas.height = scaledHeight;

      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(this.canvas, 0, 0, scaledWidth, scaledHeight);

      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Scaled canvas toBlob returned null'));
          }
        },
        format,
        quality
      );
    });
  }

  /**
   * Get canvas dimensions
   * @returns {{width: number, height: number}}
   */
  getDimensions() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Get aspect ratio
   * @returns {number}
   */
  getAspectRatio() {
    return this.canvas.width / this.canvas.height;
  }
}
