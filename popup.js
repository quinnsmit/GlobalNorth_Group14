console.log("idk why but without this log statement it doesnt work");

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
    try {
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
    } catch (e) {
        const foldersDiv = document.getElementById('folders');
        foldersDiv.innerText = "I couldn't load your saved guides. Please restart the extension and try again.";
    }
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
        // Return an empty list so higher code shows friendly message
        console.error('Element extraction error:', e);
        return [];
    }
}

// Generate guide button click handler
document.getElementById('generateGuide').addEventListener('click', async () => {
    const guideBox = document.getElementById('guideBox');
    guideBox.innerHTML = '<em>Looking at the page contents...</em>';

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPageElements,
        }, async (results) => {
            if (chrome.runtime.lastError) {
                guideBox.innerText = "I couldn't read the page. Please refresh the page and try again. If this doesn't resolve the issue, then this is likely a page for which it is not possible to generate a guide.";
                return;
            }

            const elements = results?.[0]?.result;
            if (!elements || !elements.length) {
                guideBox.innerText = "It is not possible to generate a guide for this page. Try checking a different page.";
                return;
            }

            guideBox.innerHTML = '<em>Generating a guide for this webpage using AI... This process can take up to a minute.</em>';

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
                    guideBox.innerText = "I'm having trouble getting a guide right now. Please check your internet connection and try again later.";
                    return;
                }

                const data = await response.json();
                const aiMessage = data.choices?.[0]?.message?.content || "The AI didn't send back any instructions. Please try again.";

                // Save generated guide with current tab URL and title
                const newGuide = {
                    id: generateId(),
                    title: `Guide for ${new URL(tab.url).hostname}`,
                    content: aiMessage,
                    url: tab.url,
                    folder: "My Generated Guides",
                    isPremade: false,
                };

                try {
                    const storedData = await chrome.storage.local.get('guides');
                    const existingGuides = storedData.guides || [];

                    // Replace any existing guide for same URL
                    const filteredGuides = existingGuides.filter(g => g.url !== newGuide.url);

                    filteredGuides.push(newGuide);
                    await chrome.storage.local.set({ guides: filteredGuides });
                } catch (e) {
                    console.error('Storage save error:', e);
                    // Inform user but continue to display guide
                    const errorNote = document.createElement('div');
                    errorNote.innerText = "Your guide was generated but couldn't be saved. Please try again.";
                    guideBox.appendChild(errorNote);
                }

                // Update UI
                guideBox.innerHTML = `<strong>${newGuide.title}</strong><br>` + marked.parse(aiMessage);
                loadGuides();

            } catch (apiErr) {
                guideBox.innerText = "I'm having trouble reaching the AI service. Please check your internet connection and try again.";
            }
        });

    } catch (err) {
        guideBox.innerText = 'Something went wrong while preparing your guide. Please close and reopen this popup and try again.';
    }
});

// On popup load, load guides and if any match current tab URL, show that guide
async function init() {
    await loadGuides();

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) return;

        const storedData = await chrome.storage.local.get('guides');
        const existingGuides = storedData.guides || [];

        const currentGuide = existingGuides.find(g => g.url === tab.url || new URL(g.url).origin === new URL(tab.url).origin);
        if (currentGuide) {
            showGuideContent(currentGuide);
        } else {
            // Try checking chrome.storage.local for origin-based guide (older format)
            const urlKey = new URL(tab.url).origin;
            chrome.storage.local.get([urlKey], (data) => {
                if (data[urlKey]) {
                    const guideBox = document.getElementById('guideBox');
                    guideBox.innerHTML = `<strong>AI Guide:</strong>` + marked.parse(data[urlKey]);
                } else {
                    // Show a premade guide as fallback
                    showGuideContent(premadeGuides[0]);
                }
            });
        }
    } catch (e) {
        console.error('Init error:', e);
    }
}

init();

// Toggle Accessible Mode
let accessibleModeOn = false;

const accessibleBtn = document.getElementById('accessibleMode');
if (accessibleBtn) {
    accessibleBtn.addEventListener('click', async () => {
        accessibleModeOn = !accessibleModeOn;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, {
            type: 'TOGGLE_ACCESSIBLE_MODE',
            enabled: accessibleModeOn
        });

        accessibleBtn.textContent = accessibleModeOn ? 'Disable Accessible Mode' : 'Enable Accessible Mode';
    });
}

