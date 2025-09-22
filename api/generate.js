import { GoogleAuth } from 'google-auth-library';

export const config = {
    runtime: 'edge',
};

export default async function (req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Nur POST-Anfragen sind erlaubt.' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // === 1. AUTHENTICATION ===
        // Get application default credentials and an access token
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const accessToken = (await client.getAccessToken()).token;

        if (!accessToken) {
             return new Response(JSON.stringify({ error: 'Fehler bei der Authentifizierung: Es konnte kein Zugriffstoken abgerufen werden.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // === 2. API ENDPOINT AND PROJECT DETAILS ===
        const projectId = 'alpine-ship-148620';
        const location = 'us-central1';
        const model = 'imagegeneration@006'; // A stable image generation model
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

        // === 3. REQUEST PAYLOAD CONSTRUCTION ===
        const body = await req.json();
        const { prompt, rotation, images } = body;

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Ein Prompt ist erforderlich.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // The Imagen API instance object
        const instance = {
            prompt: `${prompt}\n\nRotation: Das Model ist um ${rotation} Grad gedreht.`
        };

        // If reference images are provided, use the FIRST one.
        // The Imagen API (imagegeneration@006) supports one image for image-to-image tasks.
        if (images && images.length > 0) {
            instance.image = {
                bytesBase64Encoded: images[0].inlineData.data
            };
        }

        const payload = {
            instances: [instance],
            parameters: {
                sampleCount: 1,
                // You can add other parameters here, e.g., quality: 9, aspectRatio: "1:1"
            }
        };

        // === 4. API CALL ===
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API-Fehler: ${response.status} ${response.statusText}. Details: ${errorText}`);
        }

        const result = await response.json();

        // === 5. RESPONSE PARSING ===
        const generatedImageBase64 = result.predictions?.[0]?.bytesBase64Encoded;

        if (!generatedImageBase64) {
            console.error('Invalid API Response Structure:', result);
            return new Response(JSON.stringify({ error: 'Fehler bei der API-Antwort: Es wurde kein Bild generiert.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ image: generatedImageBase64 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Interner Serverfehler:', error);
        return new Response(JSON.stringify({ error: 'Interner Serverfehler', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
