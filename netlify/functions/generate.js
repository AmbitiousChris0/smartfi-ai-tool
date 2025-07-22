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
// It uses the standard Web API Request and Response objects.
export default async function handler(request, context) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get the secret API key from environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // The request body is a stream, so we need to parse it as JSON
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Failed to get a response from the AI.' }), {
        status: apiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
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
            return new Response(JSON.stringify({ error: parsedData.error }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
        }

        // Send the successful, parsed data back to the frontend
        return new Response(JSON.stringify(parsedData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
    } else {
        return new Response(JSON.stringify({ error: 'No content received from the AI.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Internal Server Error:', error);
    if (error instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return new Response(JSON.stringify({ error: 'An unexpected error occurred on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
