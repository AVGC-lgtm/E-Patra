import { Mistral } from '@mistralai/mistralai';

const apiKey = "B7X86kZ2MwX7Bfv3SsDn9FqAjSXKhOYW"; 
const client = new Mistral({ apiKey: apiKey });

async function processOCR() {
    try {
        const ocrResponse = await client.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "document_url",
                documentUrl: "https://e-patra-ocr.s3.us-east-1.amazonaws.com/files/1752075029618-Ahilyanagar%2C%20Police%20adhikshak%20karyalay%20%28Shevgaon%29%20%282%29.pdf"
            },
            includeImageBase64: true
        });

        console.log("OCR Response:", ocrResponse);
    } catch (error) {
        console.error("Error processing OCR:", error);
    }
}

// Call the function
processOCR();
