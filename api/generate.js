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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API-Schlüssel fehlt.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

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
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: finalParts }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API-Fehler: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const generatedImageBase64 = result.candidates[0]?.content?.parts[0]?.inlineData?.data;

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
        return new Response(JSON.stringify({ error: 'Interner Serverfehler', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
