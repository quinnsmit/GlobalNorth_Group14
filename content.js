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

