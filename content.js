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