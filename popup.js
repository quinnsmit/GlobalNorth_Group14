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

    function generateUniqueSelector(el) {
        if (el.id) {
            return `#${el.id}`;
        }
        
        if (el.classList.length > 0) {
            if (el.classList.length > 0) {
                const firstClass = el.classList[0];
                try {
                    if (document.querySelectorAll(`.${firstClass}`).length === 1) {
                        return `.${firstClass}`;
                    }
                } catch (e) {
                    console.log("Invalid class name:", firstClass);
                }
            }
        }
        
        const tagName = el.tagName.toLowerCase();

        if (el.getAttribute('href')) {
            return `${tagName}[href="${el.getAttribute('href')}"]`;
        }
        if (el.getAttribute('name')) {
            return `${tagName}[name="${el.getAttribute('name')}"]`;
        }
        if (el.getAttribute('role')) {
            return `${tagName}[role="${el.getAttribute('role')}"]`;
        }

        const text = el.textContent?.trim();
        if (text && text.length > 0 && text.length < 20) {
            return `${tagName}:contains("${text}")`;
        }
        return tagName;
    }
    
    const importantElements = [];
    
    try {
        const interactiveElements = document.querySelectorAll('button, a, input, select, [role="button"], [tabindex="0"]');
        
        const limitedElements = Array.from(interactiveElements).slice(0, 100);
        
        limitedElements.forEach(el => {
            try {
                const uniqueSelector = generateUniqueSelector(el);
                
                let text = el.textContent?.trim() || el.placeholder || el.value || '';
                if (text.length > 50) text = text.substring(0, 50) + '...';
                
                const type = el.tagName.toLowerCase();
                
                if (text) {
                    importantElements.push(`${uniqueSelector} | ${type} | "${text}"`);
                }
            } catch (e) {
                console.error("Error processing element:", e);
            }
        });
    } catch (e) {
        console.error("Error extracting elements:", e);
    }
    
    return importantElements;
}

async function generateGuideWithAI(elementsList) {
    const prompt = `Analyze this webpage and provide:

        PART 1: Create a general guide about this page for a non-technical user, explaining its purpose and main features.

        PART 2: Generate hover tooltips data in the following JSON format:
        \`\`\`json-tooltips
        {
        "#element-selector": "Explanation of what this element does",
        ".another-selector": "Another explanation"
        }
        \`\`\`

        IMPORTANT: Use ONLY the exact CSS selectors I'm providing below. Do not invent or guess selectors.
        Each line below contains "selector | element type | text" - use only the selector part (before the first |).

        Here are the available elements and their selectors:
        ${elementsList}
        `;
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
        throw new Error("API request failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "The AI didn't send back any instructions. Please try again.";

    console.log("AI response:", content);
    // Split the response into PART 1 and PART 2
    let part1 = "", part2 = "";
    const part1Match = content.match(/PART 1:(.*?)(PART 2:|$)/is);
    if (part1Match) {
        part1 = part1Match[1].trim();
    }
    const part2Match = content.match(/PART 2:(.*)$/is);
    if (part2Match) {
        part2 = part2Match[1].trim();
    }

    return { part1, part2, raw: content };
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

            const elementsList = elements.join('\n');

            try {
                const aiMessage = await generateGuideWithAI(elementsList);

                const tooltipData = extractTooltipData(aiMessage.part2);
                console.log("Extracted tooltip data:", tooltipData);

                const newGuide = {
                    id: generateId(),
                    title: `Guide for ${new URL(tab.url).hostname}`,
                    content: aiMessage.part1,
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

                guideBox.innerHTML = `<strong>${newGuide.title}</strong><br>` + marked.parse(aiMessage.part1);
                loadGuides();

                if (Object.keys(tooltipData).length > 0) {
                    try {
                        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        chrome.tabs.sendMessage(tab.id, {
                            action: "activateGuide", 
                            guideData: tooltipData
                        }, function(response) {
                            console.log("Tooltips automatically activated:", response);
                        });
                    } catch (err) {
                        console.error("Error activating tooltips:", err);
                    }
                }

            } catch (apiErr) {
                guideBox.innerText = "I'm having trouble reaching the AI service. Please check your internet connection and try again.";
            }
        });

    } catch (err) {
        guideBox.innerText = 'Something went wrong while preparing your guide. Please close and reopen this popup and try again.';
    }
});

function extractTooltipData(part2) {
    const jsonMatch = part2.match(/```json-tooltips\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.error("Error parsing tooltip JSON:", e);
            return {};
        }
    }
    return {};
}

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
                    showHowItWorksGuide();
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

// === Ask About This Element Feature ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ASK_ELEMENT_AI') {
        const { question, elemInfo } = request;
        const prompt = `You are helping an elderly user understand a webpage. Here is a description of a webpage element:\n\nElement HTML: ${elemInfo.html}\nElement text: ${elemInfo.text}\nElement tag: ${elemInfo.tag}\nElement type: ${elemInfo.type}\nAria-label: ${elemInfo.ariaLabel}\nPlaceholder: ${elemInfo.placeholder}\n\nThe user asks: '${question}'\n\nPlease provide a clear, simple, and concise answer in language that is easy for elderly people to understand. Avoid technical jargon. If the element is a button or input, explain what it does or what the user should enter. If the purpose is unclear, say so in a friendly way.`;
        fetch("https://router.huggingface.co/novita/v3/openai/chat/completions", {
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
        })
        .then(r => r.json())
        .then(data => {
            const answer = data.choices?.[0]?.message?.content || "Sorry, I couldn't get an answer.";
            sendResponse({ answer });
        })
        .catch(() => {
            sendResponse({ answer: "Sorry, I couldn't get an answer." });
        });
        return true; // Keep the message channel open for async response
    }
});

function showHowItWorksGuide() {
    const guideBox = document.getElementById('guideBox');
    const howItWorksContent = `**How Page Guide Assistant Works**

This extension helps you understand and navigate web pages more easily. Here's how to use its features:

**Generate Guide**
Click "Generate Guide" to create an AI-powered explanation of the current webpage. This will:
- Analyze the page's main features and purpose
- Create helpful tooltips for important elements
- Save the guide for future visits to this site

**Interactive Tooltips**
After generating a guide, you can:
- **Hover your mouse** over buttons, links, and input fields on the webpage
- See helpful explanations appear in small popup tooltips
- Get simple, clear descriptions of what each element does

**Accessible Mode**
Click "Enable Accessible Mode" to:
- Make the page more readable with enhanced visual features
- Improve contrast and text visibility
- Add extra navigation aids

**Saved Guides**
- Your generated guides are automatically saved
- Click on any guide in the sidebar to view it again
- Guides are organized by folder for easy browsing

**Getting Help**
- Right-click on any webpage element and select "Ask About This Element" to get specific help
- The AI will explain what that particular button, field, or link is for

**Getting Started:**
1. Visit any webpage you want to understand better
2. Open this extension popup
3. Click "Generate Guide" and wait a moment
4. Once generated, hover over elements on the page to see helpful tooltips!`;

    guideBox.innerHTML = marked.parse(howItWorksContent);
}

document.getElementById('howItWorks').addEventListener('click', () => {
    showHowItWorksGuide();
});