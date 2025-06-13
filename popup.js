// Load stored guide based on the URL on popup open
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const urlKey = new URL(tab.url).origin;
    chrome.storage.local.get([urlKey], (data) => {
        if (data[urlKey]) {
            const guideBox = document.getElementById('guideBox');
            guideBox.innerHTML = `<strong>AI Guide:</strong>` + marked.parse(data[urlKey]);
        }
    });
});

document.getElementById('generateGuide').addEventListener('click', async () => {
    const guideBox = document.getElementById('guideBox');
    guideBox.innerHTML = '<em>Extracting page elements...</em>';

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const urlKey = new URL(tab.url).origin;

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

            guideBox.innerHTML = '<em>Generating guide with AI...</em>';

            const prompt = `You are a helpful assistant. Generate a clear, step-by-step usage guide for a webpage that includes these elements:\n${elements.join('\n')}`;

            try {
                const response = await fetch("https://router.huggingface.co/novita/v3/openai/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer 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",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        provider: "novita",
                        model: "deepseek/deepseek-v3-0324",
                        messages: [
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    guideBox.innerText = `API Error ${response.status}: ${errorText}`;
                    return;
                }

                const data = await response.json();
                const aiMessage = data.choices?.[0]?.message?.content || 'No response from AI.';
                chrome.storage.local.set({ [urlKey]: aiMessage });
                guideBox.innerHTML = `<strong>AI Guide:</strong>` + marked.parse(aiMessage);

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