import { ToolCall, AppSession } from '@mentra/sdk';
import { decodeBarcode } from './barcode-decoder';
import { addScan } from './scan-history';
import axios from 'axios';

const SERVICE_URL = process.env.SERVICE_URL;
let lastCapturedImage: Buffer | null = null;

export function getLastCapturedImage(): Buffer | null {
  return lastCapturedImage;
}

/**
 * Handle a tool call
 * @param toolCall - The tool call from the server
 * @param userId - The user ID of the user who called the tool
 * @param session - The session object if the user has an active session
 * @returns A promise that resolves to the tool call result
 */
export async function handleToolCall(toolCall: ToolCall, userId: string, session: AppSession|undefined): Promise<string | undefined> {
  console.log(`Tool called: ${toolCall.toolId}`);
  console.log(`Tool call timestamp: ${toolCall.timestamp}`);
  console.log(`Tool call userId: ${toolCall.userId}`);
  if (toolCall.toolParameters && Object.keys(toolCall.toolParameters).length > 0) {
    console.log("Tool call parameter values:", toolCall.toolParameters);
  }

  if (toolCall.toolId === "my_tool_name") {
    // handle it here
  }

  if (toolCall.toolId === "scan_barcode") {
    return handleScanBarcode(userId, session);
  }

  return undefined;
}

/**
 * Handle the scan_barcode tool call.
 * Captures a photo, decodes barcodes, stores results, and displays on glasses.
 */
async function handleScanBarcode(userId: string, session: AppSession | undefined): Promise<string> {
  if (!session) {
    return "Error: No active session";
  }

  const enabled = session.settings.get<boolean>('enable_barcode_scanning', true);
  if (!enabled) {
    return "Barcode scanning is disabled";
  }

  let imageBuffer: Buffer;
  try {
	const photoData = await session.camera.requestPhoto();
	imageBuffer = photoData.buffer;
	lastCapturedImage = imageBuffer;
  } catch (error) {
	const msg = "Scan failed: could not capture image";
	session.layouts.showTextWall(msg);
	console.error("Camera capture error:", error);
	return msg;
  }

  let results;
  try {
    results = await decodeBarcode(imageBuffer);
  } catch (error) {
    const msg = "Error decoding barcode";
    session.layouts.showTextWall(msg);
    console.error("Barcode decode error:", error);
    return msg;
  }

  if (results.length === 0) {
    const msg = "No barcode found";
    session.layouts.showTextWall(msg);
    return msg;
  }

  const now = new Date();
  for (const result of results) {
    addScan(userId, { text: result.text, format: result.format, timestamp: now });
  }

  const resultText = results.map(r => `${r.format}: ${r.text}`).join('\n');
  session.layouts.showTextWall(resultText);

  for (const result of results) {
    try {
    const response = await axios.get(
      `${SERVICE_URL}?barcode=${result.text}`
    );
    console.log(response.data);
    const clientName = response.data?.clientName;
    const customerName = response.data?.customerName;
    const addLine1 = response.data?.address?.line1;
    const speakText = clientName
      ? `Hello ${customerName}, your ${clientName} parcel is coming to ${addLine1}`
      : `Barcode ${result.text}, no parcel information found`;

    session.layouts.showTextWall(speakText);
    await session.audio.speak(speakText);
  } catch (error) {
    console.error('API lookup failed:', error);
    await session.audio.speak(`Barcode detected: ${result.text}`);
  }
  
  }
return resultText;
}
