console.log("idk why but without this log statement it doesnt work");

// Premade guides hardcoded
const premadeGuides = [
    {
        id: "p1",
        title: "How to Log In",
        content: "1. Type your username in the first box.\n2. Type your password in the second box.\n3. Click the 'Log In' button.",
        folder: "Ready-Made Guides",
        isPremade: true,
    },
    {
        id: "p2",
        title: "How to Buy Something Online",
        content: "1. Add items to your shopping cart.\n2. Fill in your address for delivery.\n3. Choose how you want to pay.\n4. Click to complete your order.",
        folder: "Ready-Made Guides",
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
        foldersDiv.innerText = "I couldn't load your saved guides. Please close and reopen the helper and try again.";
    }
}

 // Group by folder
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
    const prompt = `Look at this webpage and help me understand it better:

        PART 1: Write a simple guide about what this webpage is for and how to use it. Write it like you're explaining to someone who doesn't know much about computers. Use simple words and short sentences.

        PART 2: Create helpful tips that will pop up when someone points their mouse at buttons and links on the page. Use this format:
        \`\`\`json-tooltips
        {
        "#element-selector": "Simple explanation of what this button or link does",
        ".another-selector": "Another simple explanation"
        }
        \`\`\`

        IMPORTANT: Only use the exact button and link names I'm giving you below. Don't make up new ones.
        Each line below shows "selector | type | text" - only use the selector part (before the first |).

        Here are the buttons and links I found on this page:
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
        throw new Error("The helper service isn't working right now");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "The helper didn't create any instructions. Please try again.";

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

// Create guide button click handler
document.getElementById('generateGuide').addEventListener('click', async () => {
    const guideBox = document.getElementById('guideBox');
    guideBox.innerHTML = '<em>Looking at what\'s on this page...</em>';

    try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPageElements,
        }, async (results) => {
            if (chrome.runtime.lastError) {
                guideBox.innerText = "I couldn't read this page. Please refresh the page and try again. If this doesn't work, this page might not be compatible with the helper.";
                return;
            }

            const elements = results?.[0]?.result;
            if (!elements || !elements.length) {
                guideBox.innerText = "I can't create a guide for this page. Try visiting a different website.";
                return;
            }

            guideBox.innerHTML = '<em>Creating a helpful guide for this page... This might take up to a minute.</em>';

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
                    folder: "My Website Guides",
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
                    errorNote.innerText = "Your guide was created but couldn't be saved. Please try again.";
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
                            console.log("Help tips automatically turned on:", response);
                        });
                    } catch (err) {
                        console.error("Error activating tooltips:", err);
                    }
                }

            } catch (apiErr) {
                guideBox.innerText = "I'm having trouble connecting to the helper service. Please check your internet connection and try again.";
            }
        });

    } catch (err) {
        guideBox.innerText = 'Something went wrong. Please close and reopen this helper window and try again.';
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
                    guideBox.innerHTML = `<strong>Helper Guide:</strong>` + marked.parse(data[urlKey]);
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

        accessibleBtn.textContent = accessibleModeOn ? 'Turn Off Easy Reading Mode' : 'Turn On Easy Reading Mode';
    });
}

// === Ask About This Element Feature ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ASK_ELEMENT_AI') {
        const { question, elemInfo } = request;
        const prompt = `You are helping someone who doesn't know much about computers understand a webpage. Here is information about something they clicked on:

What it looks like: ${elemInfo.html}
What it says: ${elemInfo.text}
What type it is: ${elemInfo.tag}
What it's for: ${elemInfo.type}
Label: ${elemInfo.ariaLabel}
Hint text: ${elemInfo.placeholder}

The person asks: '${question}'

Please give a clear, simple answer that's easy to understand. Don't use computer words. If it's a button, explain what happens when you click it. If it's a box to fill in, explain what to type. If you're not sure what it does, just say so in a friendly way.`;
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
    const howItWorksContent = `**How the Page Guide Helper Works**

This helper makes websites easier to understand and use. Here's what it can do for you:

**Create a Guide**
Click "Create Guide" to get help with the current website. This will:
- Look at the page and explain what it's for
- Create helpful tips that pop up when you point at buttons and links
- Save the guide so you can use it again later

**Helpful Pop-up Tips**
After creating a guide, you can:
- **Point your mouse** at any button, link, or text box on the website
- See small pop-up messages that explain what each thing does
- Get simple, clear explanations in everyday language

**Easy Reading Mode**
Click "Turn On Easy Reading Mode" to:
- Make the page easier to read with better colors and bigger text
- Improve how clear things look on the screen

**Saved Guides**
- Your guides are automatically saved for next time
- Click on any created guide in the list to read it again
- Click on ready-made guides for extra information on common actions

**Getting Help with Specific Things**
- Right-click on any button, link, or box on a webpage
- Select "Ask About This Part of the Page" to get specific help
- The helper will explain exactly what that particular thing is for

**How to Get Started:**
1. Go to any website you want help with
2. Open this helper window
3. Click "Create Guide" and wait a moment
4. Once it's ready, point your mouse at things on the page to see helpful tips!

The helper is designed to make the internet easier and less confusing for everyone.`;

    guideBox.innerHTML = marked.parse(howItWorksContent);
}

document.getElementById('howItWorks').addEventListener('click', () => {
    showHowItWorksGuide();
});