(() => {
  const channel = "mimitoys-chrome-helper-v1";
  window.addEventListener("message", async (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      message?.channel !== channel ||
      message.direction !== "request" ||
      typeof message.id !== "string"
    )
      return;
    const reply = (payload) =>
      window.postMessage(
        { channel, direction: "response", id: message.id, ...payload },
        location.origin,
      );
    if (message.type === "ping") {
      reply({ type: "pong" });
      return;
    }
    if (message.type !== "gallery" || typeof message.url !== "string") return;
    try {
      const result = await chrome.runtime.sendMessage({
        type: "gallery",
        id: message.id,
        url: message.url,
      });
      reply(
        result || {
          type: "error",
          error: "Trợ lý Chrome không trả kết quả. Hãy tải lại trang.",
        },
      );
    } catch {
      reply({
        type: "error",
        error: "Trợ lý Chrome bị ngắt kết nối. Hãy tải lại trang và thử lại.",
      });
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "status" && typeof message.id === "string")
      window.postMessage(
        { channel, direction: "response", ...message },
        location.origin,
      );
  });
})();
