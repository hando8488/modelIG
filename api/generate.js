import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
    runtime: 'edge',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Nur POST-Anfragen sind erlaubt.' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API-Schlüssel fehlt.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro-vision' });

        const body = await req.json();
        const { prompt, rotation, images } = body;
        
        // Prepare the text parts
        const textPrompt = `Generate a realistic photo of a model based on the following instructions:

        Instructions: ${prompt}
        
        Rotation: Rotate the model ${rotation} degrees.
        `;

        const imageParts = images.map(image => ({
            inlineData: {
                data: image.inlineData.data,
                mimeType: image.inlineData.mimeType
            }
        }));

        const finalParts = [{ text: textPrompt }, ...imageParts];

        const result = await model.generateContent({ contents: [{ parts: finalParts }] });
        const response = await result.response;
        const generatedImageBase64 = response.candidates[0].content.parts[0].inlineData.data;

        if (!generatedImageBase64) {
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
        console.error('API-Fehler:', error);
        return new Response(JSON.stringify({ error: 'Interner Serverfehler' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
