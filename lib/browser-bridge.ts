export type BrowserGallery = {
  sourceUrl: string;
  title?: string;
  images: string[];
};

const channel = "mimitoys-chrome-helper-v1";

function request(
  type: "ping" | "gallery",
  timeout: number,
  url?: string,
  onStatus?: (text: string) => void,
): Promise<BrowserGallery | boolean> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", listener);
    };
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        data?.channel !== channel ||
        data.direction !== "response" ||
        data.id !== id
      )
        return;
      if (data.type === "status") {
        onStatus?.(String(data.text));
        return;
      }
      cleanup();
      if (data.type === "pong") resolve(true);
      else if (data.type === "result") resolve(data.gallery as BrowserGallery);
      else reject(new Error(data.error || "Trợ lý Chrome không đọc được ảnh."));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      if (type === "ping") resolve(false);
      else
        reject(
          new Error(
            "Trợ lý Chrome chưa trả kết quả. Hãy kiểm tra tab Shopee và thử lại.",
          ),
        );
    }, timeout);
    window.addEventListener("message", listener);
    window.postMessage(
      { channel, direction: "request", id, type, url },
      location.origin,
    );
  });
}

export async function checkBrowserBridge(): Promise<boolean> {
  return (await request("ping", 800)) === true;
}

export async function readBrowserGallery(
  url: string,
  onStatus: (text: string) => void,
): Promise<BrowserGallery> {
  return (await request("gallery", 135000, url, onStatus)) as BrowserGallery;
}
