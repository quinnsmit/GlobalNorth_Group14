document.getElementById('generateGuide').addEventListener('click', async () => {
    const guideBox = document.getElementById('guideBox');
    guideBox.innerHTML = '<em>Extracting page elements...</em>';

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPageElements,
        }, async (results) => {
            if (chrome.runtime.lastError) {
                guideBox.innerText = 'Script Error: ' + chrome.runtime.lastError.message;
                return;
            }

            const elements = results?.[0]?.result;
            if (!elements || !elements.length) {
                guideBox.innerText = 'No usable elements found on the page.';
                return;
            }

            guideBox.innerHTML = '<em>Contacting AI service...</em>';

            const prompt = `Generate a helpful guide for a user based on these webpage elements:\n${elements.join('\n')}`;

            try {
                // Use Hugging Face Inference API (e.g. gpt2)
                const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer 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',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        inputs: prompt,
                        options: { wait_for_model: true }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    guideBox.innerText = `API Error ${response.status}: ${errorText}`;
                    return;
                }

                const data = await response.json();
                const generatedText = data[0]?.generated_text || 'No response from model.';
                guideBox.innerHTML = `<strong>AI Guide:</strong><p>${generatedText}</p>`;

            } catch (apiErr) {
                guideBox.innerText = 'Failed to contact AI service: ' + apiErr.message;
            }
        });

    } catch (err) {
        guideBox.innerText = 'Unexpected error: ' + err.message;
    }
});

function extractPageElements() {
    try {
        const elements = document.querySelectorAll('button, input, a');
        const output = [];
        elements.forEach((el, index) => {
            const label = el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName;
            output.push(`Element ${index + 1}: ${label}`);
        });
        return output;
    } catch (e) {
        return [`Error during element extraction: ${e.message}`];
    }
}
