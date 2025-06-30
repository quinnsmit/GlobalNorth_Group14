console.log("Hello")

let accessibleModeEnabled = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_ACCESSIBLE_MODE') {
    accessibleModeEnabled = message.enabled;
    if (accessibleModeEnabled) {
      enableAccessibleMode();
    } else {
      disableAccessibleMode();
    }
  }
});

function enableAccessibleMode() {
  const MIN_FONT_SIZE_PX = 20 * (96 / 72); // ≈26.66px

  document.querySelectorAll('body, body *').forEach(el => {
    const style = window.getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    if (!isNaN(fontSize) && fontSize < MIN_FONT_SIZE_PX) {
      el.style.fontSize = `${MIN_FONT_SIZE_PX}px`;
    }

    // Increase contrast and spacing
    el.style.color = '#000000';
    el.style.backgroundColor = '#FFFFFF';
    el.style.filter = 'none';
    el.style.lineHeight = '2.0';
    el.style.fontFamily = 'Arial, sans-serif';
  });

  // Increase size of buttons
  document.querySelectorAll('button, a, input[type="button"], input[type="submit"], label, [role="button"]').forEach(el => {
    el.style.minHeight = '48px';
    el.style.minWidth = '48px';
    el.style.padding = '12px';
    el.style.fontSize = '1.2em';
    el.style.border = '2px solid #000'; // Optional: better visibility
    el.style.borderRadius = '6px'; // Optional: rounded corners
  });

  // Body base style
  document.body.style.backgroundColor = '#FFFFFF';
  document.body.style.color = '#000000';
}


function disableAccessibleMode() {
  document.querySelectorAll('body, body *').forEach(el => {
    el.style.fontSize = '';
    el.style.color = '';
    el.style.backgroundColor = '';
    el.style.filter = '';
    el.style.lineHeight = '';
    el.style.fontFamily = '';
  });

  document.querySelectorAll('button, a, input[type="button"], input[type="submit"], label, [role="button"]').forEach(el => {
    el.style.minHeight = '';
    el.style.minWidth = '';
    el.style.padding = '';
    el.style.fontSize = '';
    el.style.border = '';
    el.style.borderRadius = '';
  });

  document.body.style.backgroundColor = '';
  document.body.style.color = '';
  document.body.style.fontFamily = '';

}

console.log("%c CONTENT SCRIPT LOADED ", "background: #4CAF50; color: white; font-size: 20px");

let tooltipsActive = true;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);
    
    if (request.action === "activateGuide") {
        applyTooltips(request.guideData);
        tooltipsActive = true;
        sendResponse({status: "Tooltips activated"});
    }
    
    if (request.action === "deactivateGuide") {
        removeTooltips();
        tooltipsActive = false;
        sendResponse({status: "Tooltips removed"});
    }
    
    return true;
});

function applyTooltips(guideData) {
    injectTooltipStyles();
    let successCount = 0;
    
    Object.entries(guideData).forEach(([selector, explanation]) => {
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`Found ${elements.length} elements for selector: ${selector}`);
            
            if (elements.length === 0) {
                const fallbackElements = tryFallbackSelectors(selector);
                if (fallbackElements.length > 0) {
                    console.log(`Found ${fallbackElements.length} elements using fallback for: ${selector}`);
                    fallbackElements.forEach(el => addTooltipToElement(el, explanation));
                    successCount++;
                }
            } else {
                elements.forEach(element => addTooltipToElement(element, explanation));
                successCount++;
            }
        } catch (e) {
            console.error(`Error adding tooltip for selector ${selector}:`, e);
        }
    });
    
    console.log(`Successfully added tooltips to ${successCount} out of ${Object.keys(guideData).length} elements`);
}

function addTooltipToElement(element, explanation) {
    element.dataset.hasGuide = "true";

    const tooltip = document.createElement('div');
    tooltip.className = 'page-guide-tooltip';
    tooltip.textContent = explanation;
    
    element.style.position = element.style.position === 'static' ? 'relative' : element.style.position;
    
    element.addEventListener('mouseenter', () => {
        element.classList.add('page-guide-highlight');
        tooltip.style.display = 'block';
    });
    
    element.addEventListener('mouseleave', () => {
        element.classList.remove('page-guide-highlight');
        tooltip.style.display = 'none';
    });
    
    element.appendChild(tooltip);
}

function tryFallbackSelectors(selector) {    
    if (selector.startsWith('#')) {
        // Try finding by text content similar to ID
        const idText = selector.substring(1).replace(/-/g, ' ');
        return Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.toLowerCase().includes(idText.toLowerCase())
        );
    }
    
    if (selector.startsWith('.')) {
        // Try finding elements with similar class name
        const className = selector.substring(1);
        return Array.from(document.querySelectorAll('*')).filter(el => 
            Array.from(el.classList).some(cls => cls.includes(className) || className.includes(cls))
        );
    }
    
    return [];
}

function removeTooltips() {
    // Remove all tooltips from the page
    document.querySelectorAll('.page-guide-tooltip').forEach(tooltip => tooltip.remove());
    document.querySelectorAll('[data-has-guide="true"]').forEach(element => {
        element.classList.remove('page-guide-highlight');
        delete element.dataset.hasGuide;
    });
}

function injectTooltipStyles() {
    // Create stylesheet for tooltips if it doesn't exist
    if (!document.getElementById('page-guide-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'page-guide-styles';
        styleEl.textContent = `
            .page-guide-tooltip {
                display: none;
                position: absolute;
                background: #3f51b5;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                z-index: 10000;
                max-width: 250px;
                box-shadow: 0 3px 8px rgba(0,0,0,0.2);
                top: 100%;
                left: 0;
                margin-top: 5px;
                pointer-events: none;
            }
            
            .page-guide-highlight {
                outline: 2px solid #3f51b5 !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

// === Ask About This Element Feature ===
(function() {
    let askOverlay = null;
    let lastTarget = null;
    
    function createAskOverlay(target) {
        removeAskOverlay();
        lastTarget = target;
        const rect = target.getBoundingClientRect();
        askOverlay = document.createElement('div');
        askOverlay.style.position = 'fixed';
        askOverlay.style.left = (rect.left + window.scrollX) + 'px';
        askOverlay.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        askOverlay.style.zIndex = 2147483647;
        askOverlay.style.background = '#fff';
        askOverlay.style.border = '2px solid #3f51b5';
        askOverlay.style.borderRadius = '8px';
        askOverlay.style.padding = '12px';
        askOverlay.style.boxShadow = '0 2px 12px #0002';
        askOverlay.style.fontSize = '16px';
        askOverlay.style.maxWidth = '320px';
        askOverlay.style.minWidth = '220px';
        askOverlay.style.display = 'flex';
        askOverlay.style.flexDirection = 'column';
        askOverlay.style.gap = '8px';
        askOverlay.style.userSelect = 'auto';
        askOverlay.innerHTML = `
            <label style="font-weight:600;">Ask a question about this element; Answer will be provided in the box</label>
            <input id="askElemInput" type="text" placeholder="e.g. What does this do?" style="font-size:16px;padding:6px;border-radius:4px;border:1px solid #bbb;outline:none;" />
            <button id="askElemBtn" style="background:#3f51b5;color:#fff;border:none;padding:7px 0;border-radius:4px;font-size:16px;cursor:pointer;">Ask</button>
            <button id="closeAskElem" style="background:#eee;color:#333;border:none;padding:4px 0;border-radius:4px;font-size:13px;cursor:pointer;">Close</button>
            <div id="askElemAnswer" style="margin-top:6px;font-size:15px;color:#222;"></div>
        `;
        document.body.appendChild(askOverlay);
        document.getElementById('askElemInput').focus();
        document.getElementById('closeAskElem').onclick = removeAskOverlay;
        document.getElementById('askElemBtn').onclick = async function() {
            const question = document.getElementById('askElemInput').value.trim();
            if (!question) return;
            document.getElementById('askElemAnswer').innerHTML = '<em>Thinking...</em>';
            const elemInfo = {
                html: lastTarget.outerHTML,
                text: lastTarget.innerText || lastTarget.value || lastTarget.placeholder || '',
                tag: lastTarget.tagName,
                type: lastTarget.type || '',
                ariaLabel: lastTarget.getAttribute('aria-label') || '',
                placeholder: lastTarget.getAttribute('placeholder') || ''
            };
            chrome.runtime.sendMessage({
                action: 'ASK_ELEMENT_AI',
                question,
                elemInfo
            }, function(response) {
                if (response && response.answer) {
                    document.getElementById('askElemAnswer').innerText = response.answer;
                } else {
                    document.getElementById('askElemAnswer').innerText = 'Sorry, I could not get an answer.';
                }
            });
        };
    }
    function removeAskOverlay() {
        if (askOverlay) {
            askOverlay.remove();
            askOverlay = null;
            lastTarget = null;
        }
    }
    // Right-click context menu
    document.addEventListener('contextmenu', function(e) {
        if (!e.target.closest('body')) return;
        setTimeout(() => {
            if (askOverlay) removeAskOverlay();
            if (e.target && e.target !== document.body && e.target.nodeType === 1) {
                createAskOverlay(e.target);
            }
        }, 10);
    });
    // Remove overlay on page scroll or navigation
    window.addEventListener('scroll', removeAskOverlay, true);
    window.addEventListener('resize', removeAskOverlay, true);
    window.addEventListener('blur', removeAskOverlay, true);
})();