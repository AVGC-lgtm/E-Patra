// services/signatureExtractionService.js - Advanced Pure Signature Extraction
const sharp = require('sharp');

class SignatureExtractionService {

  // MAIN: Extract only pen writing from image (remove background, lines, paper)
  async extractPureSignature(imageBuffer, options = {}) {
    try {
      console.log('🖊️ Starting pure signature extraction...');
      
      const {
        maxWidth = 200,
        maxHeight = 80,
        penThreshold = 120,      // Darker values = pen ink
        lineThreshold = 180,     // Lighter values = notebook lines/background
        minSignatureArea = 300,  // Minimum pixels for valid signature
        contrastBoost = 1.5,     // Enhance pen contrast
        removeNoise = true       // Remove small artifacts
      } = options;

      // Step 1: Load and analyze image
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      console.log('📊 Original image:', { width: metadata.width, height: metadata.height, format: metadata.format });

      // Step 2: Convert to grayscale for analysis
      const grayBuffer = await image
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data: grayData, info } = grayBuffer;
      const { width, height } = info;

      // Step 3: Analyze pixel intensities to detect pen writing
      console.log('🔍 Analyzing pen writing vs background...');
      
      let penPixels = [];
      let backgroundPixels = [];
      
      // Classify each pixel
      for (let i = 0; i < grayData.length; i++) {
        const intensity = grayData[i];
        const x = i % width;
        const y = Math.floor(i / width);
        
        if (intensity < penThreshold) {
          // Dark pixels = likely pen writing
          penPixels.push({ x, y, intensity });
        } else if (intensity > lineThreshold) {
          // Light pixels = background/paper
          backgroundPixels.push({ x, y, intensity });
        }
        // Medium pixels (lineThreshold to penThreshold) = possibly notebook lines
      }

      console.log(`📈 Analysis: ${penPixels.length} pen pixels, ${backgroundPixels.length} background pixels`);

      if (penPixels.length < minSignatureArea) {
        throw new Error(`Insufficient pen writing detected (${penPixels.length} pixels). Minimum required: ${minSignatureArea}`);
      }

      // Step 4: Find signature bounding box
      const bounds = this.calculateSignatureBounds(penPixels);
      console.log('📦 Signature bounds:', bounds);

      // Add padding
      const padding = 10;
      const cropLeft = Math.max(0, bounds.minX - padding);
      const cropTop = Math.max(0, bounds.minY - padding);
      const cropWidth = Math.min(width - cropLeft, bounds.maxX - bounds.minX + (padding * 2));
      const cropHeight = Math.min(height - cropTop, bounds.maxY - bounds.minY + (padding * 2));

      // Step 5: Create binary mask for pen pixels only
      const maskBuffer = Buffer.alloc(width * height * 4); // RGBA
      
      for (let i = 0; i < width * height; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        const intensity = grayData[i];
        const idx = i * 4;
        
        if (intensity < penThreshold) {
          // Keep pen writing - make it black
          maskBuffer[idx] = 0;     // R
          maskBuffer[idx + 1] = 0; // G
          maskBuffer[idx + 2] = 0; // B
          maskBuffer[idx + 3] = 255; // A (opaque)
        } else {
          // Remove everything else - make transparent
          maskBuffer[idx] = 255;     // R
          maskBuffer[idx + 1] = 255; // G
          maskBuffer[idx + 2] = 255; // B
          maskBuffer[idx + 3] = 0;   // A (transparent)
        }
      }

      // Step 6: Apply noise removal if requested
      let finalMask = maskBuffer;
      if (removeNoise) {
        finalMask = await this.removeNoiseFromMask(maskBuffer, width, height);
      }

      // Step 7: Crop to signature area and resize
      const croppedImage = await sharp(finalMask, {
        raw: {
          width: width,
          height: height,
          channels: 4
        }
      })
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight
      })
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png({ quality: 100, compressionLevel: 0 })
      .toBuffer();

      // Step 8: Convert to base64
      const base64 = croppedImage.toString('base64');
      
      console.log('✅ Pure signature extracted successfully');
      
      return {
        base64: base64,
        originalSize: { width: metadata.width, height: metadata.height },
        processedSize: { width: maxWidth, height: maxHeight },
        penPixelCount: penPixels.length,
        bounds: bounds,
        cropArea: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight },
        success: true
      };

    } catch (error) {
      console.error('❌ Error in pure signature extraction:', error);
      throw new Error(`Signature extraction failed: ${error.message}`);
    }
  }

  // Calculate tight bounding box around pen pixels
  calculateSignatureBounds(penPixels) {
    if (penPixels.length === 0) {
      throw new Error('No pen pixels found for bounds calculation');
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const pixel of penPixels) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    }

    return { minX, maxX, minY, maxY };
  }

  // Remove noise (small isolated pixels) from mask
  async removeNoiseFromMask(maskBuffer, width, height, minClusterSize = 5) {
    console.log('🧹 Removing noise from signature...');
    
    const cleanMask = Buffer.from(maskBuffer);
    const visited = new Set();

    // Find connected components and remove small ones
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const key = `${x},${y}`;
        
        // If pixel is black (pen) and not visited
        if (cleanMask[idx + 3] === 255 && cleanMask[idx] === 0 && !visited.has(key)) {
          const cluster = this.floodFill(cleanMask, width, height, x, y, visited);
          
          // If cluster is too small, remove it (likely noise)
          if (cluster.length < minClusterSize) {
            for (const pixel of cluster) {
              const pixelIdx = (pixel.y * width + pixel.x) * 4;
              cleanMask[pixelIdx + 3] = 0; // Make transparent
            }
          }
        }
      }
    }

    return cleanMask;
  }

  // Flood fill to find connected pen pixels
  floodFill(maskBuffer, width, height, startX, startY, visited) {
    const stack = [{ x: startX, y: startY }];
    const cluster = [];
    const key = `${startX},${startY}`;
    
    if (visited.has(key)) return cluster;

    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }
      
      const idx = (y * width + x) * 4;
      
      // If pixel is black (pen writing)
      if (maskBuffer[idx + 3] === 255 && maskBuffer[idx] === 0) {
        visited.add(key);
        cluster.push({ x, y });
        
        // Add neighbors to stack
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }
    }

    return cluster;
  }

  // Alternative method: Extract signature using edge detection
  async extractSignatureByEdges(imageBuffer, options = {}) {
    try {
      console.log('🔍 Extracting signature using edge detection...');
      
      const {
        maxWidth = 200,
        maxHeight = 80,
        edgeThreshold = 50
      } = options;

      // Apply edge detection and morphological operations
      const processedImage = await sharp(imageBuffer)
        .greyscale()
        .normalise()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
        })
        .threshold(edgeThreshold)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();

      const base64 = processedImage.toString('base64');
      
      return {
        base64: base64,
        method: 'edge_detection',
        success: true
      };

    } catch (error) {
      console.error('❌ Error in edge-based signature extraction:', error);
      throw error;
    }
  }

  // Validate if extracted signature has sufficient content
  validateSignature(base64, minSize = 1000) {
    try {
      if (!base64 || base64.length < minSize) {
        return {
          valid: false,
          reason: `Signature too small (${base64?.length || 0} bytes). Minimum: ${minSize}`
        };
      }

      // Additional validation can be added here
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  // Enhanced signature extraction with multiple fallback methods
  async extractBestSignature(imageBuffer, options = {}) {
    console.log('🎯 Starting enhanced signature extraction with fallbacks...');
    
    try {
      // Method 1: Pure pen writing extraction (best quality)
      console.log('🔥 Trying pure pen writing extraction...');
      const pureResult = await this.extractPureSignature(imageBuffer, options);
      
      const validation = this.validateSignature(pureResult.base64);
      if (validation.valid) {
        console.log('✅ Pure signature extraction successful');
        return { ...pureResult, method: 'pure_pen_extraction' };
      } else {
        console.log('⚠️ Pure extraction result insufficient:', validation.reason);
      }
    } catch (error) {
      console.log('⚠️ Pure extraction failed:', error.message);
    }

    try {
      // Method 2: Edge detection fallback
      console.log('🔄 Trying edge detection method...');
      const edgeResult = await this.extractSignatureByEdges(imageBuffer, options);
      
      const validation = this.validateSignature(edgeResult.base64);
      if (validation.valid) {
        console.log('✅ Edge detection extraction successful');
        return edgeResult;
      }
    } catch (error) {
      console.log('⚠️ Edge detection failed:', error.message);
    }

    // Method 3: Simple processing fallback
    console.log('🔄 Using simple processing as last resort...');
    try {
      const simpleResult = await this.simpleSignatureExtraction(imageBuffer, options);
      return { ...simpleResult, method: 'simple_processing' };
    } catch (error) {
      throw new Error(`All signature extraction methods failed. Last error: ${error.message}`);
    }
  }

  // Simple fallback method
  async simpleSignatureExtraction(imageBuffer, options = {}) {
    const { maxWidth = 200, maxHeight = 80 } = options;
    
    const processedImage = await sharp(imageBuffer)
      .greyscale()
      .normalise()
      .threshold(128) // Simple threshold
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();

    return {
      base64: processedImage.toString('base64'),
      success: true
    };
  }
}

module.exports = new SignatureExtractionService();