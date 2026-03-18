import { ToolCall, AppServer, AppSession } from '@mentra/sdk';
import path from 'path';
import { setupExpressRoutes } from './webview';
import { handleToolCall } from './tools';
import { clearScans } from './scan-history';

const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.evri.innovation.barcodescanner';
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY || '1fe8b070005f74dee0ed1373df732b6c20bd3866e463fce2dcf5821a36269d22';
const PORT = parseInt(process.env.PORT || '3000');

class ExampleMentraOSApp extends AppServer {
  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
      publicDir: path.join(__dirname, '../public'),
    });

    // Set up Express routes
    setupExpressRoutes(this, (userId) => this.userSessionsMap.get(userId));
  }

  /** Map to store active user sessions */
  private userSessionsMap = new Map<string, AppSession>();

  /**
   * Handles tool calls from the MentraOS system
   * @param toolCall - The tool call request
   * @returns Promise resolving to the tool call response or undefined
   */
  protected async onToolCall(toolCall: ToolCall): Promise<string | undefined> {
    return handleToolCall(toolCall, toolCall.userId, this.userSessionsMap.get(toolCall.userId));
  }

  /**
   * Handles new user sessions
   * Sets up event listeners and displays welcome message
   * @param session - The app session instance
   * @param sessionId - Unique session identifier
   * @param userId - User identifier
   */
	protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
	  console.log(`🟢 Session started - userId: ${userId}, sessionId: ${sessionId}`);
	  try {
	    this.userSessionsMap.set(userId, session);

	    console.log('📺 Showing welcome message...');
	    session.layouts.showTextWall("Barcode App loaded");
	    console.log('✅ Welcome message shown');

	    const displayTranscription = (text: string): void => {
	      const showLiveTranscription = session.settings.get<boolean>('show_live_transcription', true);
	      if (showLiveTranscription) {
		console.log("Transcript received:", text);
		session.layouts.showTextWall("You said: " + text);
	      }
	    };

	    session.events.onTranscription((data) => {
	      if (data.isFinal) {
		displayTranscription(data.text);
	      }
	    });

	    session.settings.onValueChange('show_live_transcription', (newValue: boolean, oldValue: boolean) => {
	      console.log(`Live transcription setting changed from ${oldValue} to ${newValue}`);
	    });

	    this.addCleanupHandler(() => {
	      console.log(`🔴 Session ended - userId: ${userId}`);
	      clearScans(userId);
	      this.userSessionsMap.delete(userId);
	    });

	    console.log('✅ onSession setup complete');
	  } catch (err) {
	    console.error('❌ Error in onSession:', err);
	  }
	}
}

// Start the server
const app = new ExampleMentraOSApp();

console.log(`📦 Package: ${PACKAGE_NAME}`);
console.log(`🔑 API key set: ${!!MENTRAOS_API_KEY}`);
console.log(`🚪 Port: ${PORT}`);

app.start()
  .then(() => console.log('✅ Connected to Mentra cloud successfully'))
  .catch((err) => {
    console.error('❌ Failed to connect to Mentra cloud:', err);
    process.exit(1);
  });
