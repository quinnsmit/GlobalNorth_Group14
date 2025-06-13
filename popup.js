// Premade guides hardcoded
const premadeGuides = [
    {
        id: "p1",
        title: "Common Login Guide",
        content: "1. Enter your username.\n2. Enter your password.\n3. Click the 'Login' button.",
        folder: "Premade Guides",
        isPremade: true,
    },
    {
        id: "p2",
        title: "Checkout Steps",
        content: "1. Add items to your cart.\n2. Enter shipping information.\n3. Select payment method.\n4. Confirm your order.",
        folder: "Premade Guides",
        isPremade: true,
    },
];

// Utility: generate random ID for new guides
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

// Load guides from storage, merge premade, and display
async function loadGuides() {
    const data = await chrome.storage.local.get('guides');
    let guides = data.guides || [];

    // Merge premade guides, avoiding duplicates by id
    const allGuidesMap = {};
    guides.forEach(g => allGuidesMap[g.id] = g);
    premadeGuides.forEach(pg => {
        if (!allGuidesMap[pg.id]) allGuidesMap[pg.id] = pg;
    });

    const allGuides = Object.values(allGuidesMap);
    displayFoldersAndGuides(allGuides);
}

// Display guides grouped by folder
function displayFoldersAndGuides(guides) {
    const foldersDiv = document.getElementById('folders');
    foldersDiv.innerHTML = '';

    // Group by folder
    const grouped = guides.reduce((acc, g) => {
        acc[g.folder] = acc[g.folder] || [];
        acc[g.folder].push(g);
        return acc;
    }, {});

    for (const folder in grouped) {
        const folderEl = document.createElement('div');
        folderEl.style.marginBottom = '16px';

        const folderTitle = document.createElement('strong');
        folderTitle.textContent = folder;
        folderEl.appendChild(folderTitle);

        grouped[folder].forEach(guide => {
            const guideEl = document.createElement('div');
            guideEl.textContent = guide.title;
            guideEl.title = guide.title;
            guideEl.style.cursor = 'pointer';
            guideEl.style.padding = '5px 8px';
            guideEl.style.borderRadius = '5px';
            guideEl.style.userSelect = 'none';

            guideEl.addEventListener('click', () => showGuideContent(guide));
            guideEl.addEventListener('mouseenter', () => guideEl.style.backgroundColor = '#c5cae9');
            guideEl.addEventListener('mouseleave', () => guideEl.style.backgroundColor = 'transparent');

            folderEl.appendChild(guideEl);
        });

        foldersDiv.appendChild(folderEl);
    }
}

// Show guide content in main content area
function showGuideContent(guide) {
    const guideBox = document.getElementById('guideBox');
    guideBox.innerHTML = `<strong>${guide.title}</strong><br>` + marked.parse(guide.content);
}

// Extract page elements from current tab
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

// Generate guide button click handler
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

                // Save generated guide with current tab URL and title
                const newGuide = {
                    id: generateId(),
                    title: `Guide for ${new URL(tab.url).hostname}`,
                    content: aiMessage,
                    url: tab.url,
                    folder: "My Generated",
                    isPremade: false,
                };

                // Save to storage
                const storedData = await chrome.storage.local.get('guides');
                const existingGuides = storedData.guides || [];

                // Replace any existing guide for same URL
                const filteredGuides = existingGuides.filter(g => g.url !== newGuide.url);

                filteredGuides.push(newGuide);
                await chrome.storage.local.set({ guides: filteredGuides });

                // Update UI
                guideBox.innerHTML = `<strong>${newGuide.title}</strong><br>` + marked.parse(aiMessage);
                loadGuides();

            } catch (apiErr) {
                guideBox.innerText = 'Failed to contact AI service: ' + apiErr.message;
            }
        });

    } catch (err) {
        guideBox.innerText = 'Unexpected error: ' + err.message;
    }
});

// On popup load, load guides and if any match current tab URL, show that guide
async function init() {
    await loadGuides();

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const storedData = await chrome.storage.local.get('guides');
    const existingGuides = storedData.guides || [];

    const currentGuide = existingGuides.find(g => g.url === tab.url);
    if (currentGuide) {
        showGuideContent(currentGuide);
    } else {
        // Show first premade guide by default
        showGuideContent(premadeGuides[0]);
    }
}

init();
