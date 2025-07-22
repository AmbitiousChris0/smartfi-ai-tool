/**
 * This is a serverless function to act as a secure proxy.
 * It's designed to be deployed on a platform like Vercel or Netlify.
 *
 * How to deploy (example with Vercel):
 * 1. Create a new project on Vercel.
 * 2. Create a file named `generate.js` inside an `api` directory (i.e., `/api/generate.js`).
 * 3. Paste this code into the file.
 * 4. In your Vercel project settings, go to "Environment Variables".
 * 5. Create a new environment variable named `GEMINI_API_KEY` and paste your secret API key as the value.
 * 6. Deploy the project. Vercel will give you a URL.
 * 7. Copy that URL and paste it into the `backendUrl` variable in your main HTML file.
 */

// This is the main handler function for the serverless endpoint.
export default async function handler(request, response) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Get the secret API key from environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: 'API key not configured on the server.' });
    return;
  }

  try {
    const { prompt } = request.body;

    if (!prompt) {
      response.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    // Make the secure call to the Google AI API
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Google AI API Error:', errorText);
      response.status(apiResponse.status).json({ error: 'Failed to get a response from the AI.' });
      return;
    }

    const result = await apiResponse.json();

    // Helper function to safely parse the AI's text response
    const parseAIResponse = (text) => {
        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '').trim();
        try {
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error("Backend failed to parse JSON:", cleanedText);
            // If parsing fails, return an error structure
            return { error: "AI returned an invalid format." };
        }
    };

    if (result.candidates && result.candidates.length > 0) {
        const rawText = result.candidates[0].content.parts[0].text;
        const parsedData = parseAIResponse(rawText);

        if(parsedData.error) {
            response.status(500).json({ error: parsedData.error });
            return;
        }

        // Send the successful, parsed data back to the frontend
        response.status(200).json(parsedData);
    } else {
        response.status(500).json({ error: 'No content received from the AI.' });
    }

  } catch (error) {
    console.error('Internal Server Error:', error);
    response.status(500).json({ error: 'An unexpected error occurred on the server.' });
  }
}
