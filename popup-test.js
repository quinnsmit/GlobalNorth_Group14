document.getElementById('generateGuide').addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: generateGuideOnPage,
    }, (results) => {
        if (chrome.runtime.lastError) {
            document.getElementById('guideBox').innerText = 'Error: ' + chrome.runtime.lastError.message;
        } else if (results && results[0] && results[0].result) {
            document.getElementById('guideBox').innerHTML = results[0].result;
        } else {
            document.getElementById('guideBox').innerText = 'No guide could be generated.';
        }
    });
});

function generateGuideOnPage() {
    const elements = document.querySelectorAll('button, input, a');
    let guideText = '<strong>Guide for this page:</strong><ul>';

    elements.forEach((el, index) => {
        let label = el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName;
        guideText += `<li>Element ${index + 1}: ${label}</li>`;
    });

    guideText += '</ul>';
    return guideText;
}