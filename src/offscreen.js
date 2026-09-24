chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "get-device-resolution") {
    sendResponse({
      width: Math.round(screen.width * devicePixelRatio),
      height: Math.round(screen.height * devicePixelRatio),
    });
  }
});
