import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode nicht erlaubt.' });
  }

  try {
    const { prompt, rotationAngle, images } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('API-Schlüssel fehlt. Bitte setze die Umgebungsvariable "GEMINI_API_KEY".');
    }

    const payload = {
      contents: [{
        parts: [{
          text: `Generate a professional-style model photo of the subject(s) in the images. The model should have a white background with a very soft, subtle shadow. The model must be rotated by ${rotationAngle} degrees, to the left if negative and to the right if positive. Additional context: ${prompt}.`
        }, ...images.map(dataUrl => {
          const mimeType = dataUrl.split(';')[0].split(':')[1];
          const base64Data = dataUrl.split(',')[1];
          return {
            inlineData: {
              mimeType,
              data: base64Data
            }
          };
        })]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      },
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await apiResponse.json();
    const generatedBase64 = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    const mimeType = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.mimeType;

    if (!generatedBase64) {
      throw new Error('Fehler bei der API-Antwort: Es wurde kein Bild generiert.');
    }

    const imageUrl = `data:${mimeType};base64,${generatedBase64}`;
    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('API-Fehler:', error);
    res.status(500).json({ error: error.message || 'Interner Serverfehler' });
  }
}
