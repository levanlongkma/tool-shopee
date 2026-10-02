"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  Download,
  GripVertical,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import type { AnalyzeResult, Preset, ProductImage } from "@/types/product";
import { checkBrowserBridge, readBrowserGallery } from "@/lib/browser-bridge";

type Status = "queued" | "downloading" | "processing" | "completed" | "failed";
type Result = { status: Status; blob?: Blob; preview?: string; error?: string };

const presets: Array<{
  id: Preset;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    id: "mimitoys-standard",
    title: "MimiToys Standard",
    description: "Bối cảnh tươi sáng, chừa chỗ cho logo và tiêu đề.",
    icon: "✦",
  },
  {
    id: "mimitoys-no-text",
    title: "MimiToys No Text",
    description: "Ảnh sạch, không chữ. Phù hợp để hoàn thiện sau.",
    icon: "◈",
  },
  {
    id: "shopee-plain",
    title: "Shopee Plain Background",
    description: "Nền trắng gọn gàng, tập trung vào sản phẩm.",
    icon: "□",
  },
];

const labels: Record<Status, string> = {
  queued: "Đang chờ",
  downloading: "Đang tải ảnh",
  processing: "Gemini đang xử lý",
  completed: "Hoàn tất",
  failed: "Có lỗi",
};

function imageSrc(url: string) {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeStatus, setAnalyzeStatus] = useState("");
  const [chromeConnected, setChromeConnected] = useState(false);
  const [product, setProduct] = useState<AnalyzeResult | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preset, setPreset] = useState<Preset>("mimitoys-no-text");
  const [instruction, setInstruction] = useState("");
  const [results, setResults] = useState<Record<string, Result>>({});
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const dragId = useRef<string | null>(null);
  const running = useRef(false);
  const resultsRef = useRef<Record<string, Result>>({});
  useEffect(() => {
    void checkBrowserBridge().then(setChromeConnected);
  }, []);
  const selectedImages = useMemo(
    () => images.filter((image) => selected.includes(image.id)),
    [images, selected],
  );
  const completed = selectedImages.filter(
    (image) => results[image.id]?.status === "completed",
  ).length;
  const settled = selectedImages.filter((image) =>
    ["completed", "failed"].includes(results[image.id]?.status),
  ).length;
  const progress = selectedImages.length
    ? Math.round((settled / selectedImages.length) * 100)
    : 0;

  function updateResult(id: string, patch: Result) {
    resultsRef.current = { ...resultsRef.current, [id]: patch };
    setResults(resultsRef.current);
  }

  async function analyze() {
    setAnalyzeError("");
    setNotice("");
    setAnalyzing(true);
    setAnalyzeStatus("");
    try {
      const input = url.trim();
      const shopee = new URL(input).hostname === "shopee.vn";
      const connected = shopee && (await checkBrowserBridge());
      if (shopee) setChromeConnected(connected);
      const gallery = connected
        ? await readBrowserGallery(input, setAnalyzeStatus)
        : undefined;
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input, gallery }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Không thể phân tích URL.");
      const found = data as AnalyzeResult;
      setProduct(found);
      setImages(found.images);
      setSelected(found.images.slice(0, 10).map((image) => image.id));
      setResults({});
      resultsRef.current = {};
    } catch (error) {
      setAnalyzeError(
        error instanceof Error ? error.message : "Không thể phân tích URL.",
      );
    } finally {
      setAnalyzing(false);
      setAnalyzeStatus("");
    }
  }

  function toggle(id: string) {
    if (generating) return;
    if (selected.includes(id))
      setSelected((old) => old.filter((item) => item !== id));
    else if (selected.length < 10) setSelected((old) => [...old, id]);
    else setNotice("Chọn tối đa 10 ảnh cho mỗi lần tạo.");
  }

  function move(id: string, direction: -1 | 1) {
    setImages((old) => {
      const next = [...old];
      const index = next.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return old;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropOn(targetId: string) {
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) return;
    setImages((old) => {
      const next = [...old];
      const source = next.findIndex((item) => item.id === sourceId);
      const target = next.findIndex((item) => item.id === targetId);
      if (source < 0 || target < 0) return old;
      next.splice(target, 0, next.splice(source, 1)[0]);
      return next;
    });
    dragId.current = null;
  }

  async function processOne(image: ProductImage) {
    updateResult(image.id, { status: "downloading" });
    try {
      const source = await fetch(imageSrc(image.url));
      if (!source.ok) throw new Error("Không tải được ảnh gốc.");
      const sourceBlob = await source.blob();
      updateResult(image.id, { status: "processing" });
      const form = new FormData();
      form.append("image", sourceBlob, "source.jpg");
      form.append("preset", preset);
      form.append("instruction", instruction);
      const response = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Gemini xử lý thất bại.");
      }
      const blob = await response.blob();
      const previous = resultsRef.current[image.id];
      if (previous?.preview) URL.revokeObjectURL(previous.preview);
      updateResult(image.id, {
        status: "completed",
        blob,
        preview: URL.createObjectURL(blob),
      });
    } catch (error) {
      updateResult(image.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Không thể xử lý ảnh.",
      });
    }
  }

  async function generate(onlyFailed = false) {
    if (running.current || selectedImages.length === 0) return;
    running.current = true;
    setGenerating(true);
    setNotice("");
    const queue = selectedImages.filter(
      (image) =>
        !onlyFailed || resultsRef.current[image.id]?.status === "failed",
    );
    for (const image of queue) updateResult(image.id, { status: "queued" });
    for (const image of queue) await processOne(image);
    running.current = false;
    setGenerating(false);
  }

  async function retryOne(image: ProductImage) {
    if (running.current) return;
    running.current = true;
    setGenerating(true);
    try {
      await processOne(image);
    } finally {
      running.current = false;
      setGenerating(false);
    }
  }

  async function exportZip() {
    const ready = selectedImages.filter(
      (image) => resultsRef.current[image.id]?.blob,
    );
    if (!ready.length) return;
    setExporting(true);
    setNotice("");
    try {
      const form = new FormData();
      form.append("sourceUrl", url);
      form.append("preset", preset);
      ready.forEach((image) => {
        form.append("images", resultsRef.current[image.id].blob!, "image.png");
        form.append("sources", image.url);
      });
      const response = await fetch("/api/export", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error("Không thể tạo ZIP.");
      saveBlob(await response.blob(), "mimitoys-product-images.zip");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tạo ZIP.");
    } finally {
      setExporting(false);
    }
  }

  const hasFailed = selectedImages.some(
    (image) => results[image.id]?.status === "failed",
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} strokeWidth={2.5} />
          </div>
          <div>
            <strong>MimiToys</strong>
            <span>IMAGE STUDIO</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="top-status">
            <span /> LOCAL WORKSPACE
          </span>
          <span className="top-avatar">M</span>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <div className="eyebrow">
            <WandSparkles size={14} /> AI PRODUCT CONTENT STUDIO
          </div>
          <h1>
            Biến ảnh sản phẩm thành
            <br />
            <em>hình ảnh chuẩn MimiToys.</em>
          </h1>
          <p>
            Dán liên kết sản phẩm, chọn ảnh bạn thích và để AI tạo nên bộ ảnh
            thương mại đồng nhất.
          </p>
        </section>

        <div className="workspace-grid">
          <div className="left-column">
            <section className="panel url-panel">
              <div className="section-heading">
                <div className="step">01</div>
                <div>
                  <h2>Nhập liên kết sản phẩm</h2>
                  <p>Bắt đầu với một URL sản phẩm công khai</p>
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void analyze();
                }}
                className="url-form"
              >
                <div className="url-field">
                  <Link2 size={19} />
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://shopee.vn/ten-san-pham..."
                    required
                    disabled={analyzing || generating}
                  />
                </div>
                <button
                  className="button primary"
                  disabled={analyzing || generating || !url.trim()}
                >
                  {analyzing ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}{" "}
                  {analyzing ? "Đang phân tích" : "Phân tích"}
                </button>
              </form>
              {analyzeError && (
                <div className="message error">{analyzeError}</div>
              )}
              {analyzeStatus && <div className="message">{analyzeStatus}</div>}
              <div className="url-hint">
                {chromeConnected ? (
                  "Chrome đã kết nối · Shopee sẽ mở trong phiên duyệt của bạn"
                ) : (
                  <>
                    Để lấy ảnh Shopee bằng Chrome đang dùng:{" "}
                    <a
                      href="/chrome-helper.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      cài MimiToys Chrome Helper
                    </a>{" "}
                    và mở ứng dụng trong Chrome.
                  </>
                )}
              </div>
            </section>

            <section className="panel gallery-panel">
              <div className="section-heading gallery-heading">
                <div className="step">02</div>
                <div>
                  <h2>Chọn ảnh sản phẩm</h2>
                  <p>
                    {product
                      ? product.title || `${images.length} ảnh được tìm thấy`
                      : "Ảnh được phát hiện sẽ xuất hiện tại đây"}
                  </p>
                </div>
                {product && (
                  <span className="count-badge">
                    {selected.length} / 10 đã chọn
                  </span>
                )}
              </div>
              {product ? (
                <>
                  <div className="gallery-actions">
                    <button
                      onClick={() =>
                        setSelected(
                          images.slice(0, 10).map((image) => image.id),
                        )
                      }
                      disabled={generating}
                    >
                      <CheckCheck size={15} /> Chọn tối đa 10
                    </button>
                    <button
                      onClick={() => setSelected([])}
                      disabled={generating}
                    >
                      <X size={15} /> Bỏ chọn
                    </button>
                    <button
                      onClick={() => {
                        const seen = new Set<string>();
                        setImages((old) =>
                          old.filter((image) => {
                            const key = image.url.split("?")[0];
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                          }),
                        );
                      }}
                      disabled={generating}
                    >
                      <Trash2 size={15} /> Lọc trùng
                    </button>
                  </div>
                  <div className="image-grid">
                    {images.map((image, index) => (
                      <div
                        className={`image-card ${selected.includes(image.id) ? "chosen" : ""}`}
                        key={image.id}
                        draggable={!generating}
                        onDragStart={() => {
                          dragId.current = image.id;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => dropOn(image.id)}
                      >
                        <div
                          className="image-frame"
                          onClick={() => toggle(image.id)}
                        >
                          <img
                            src={imageSrc(image.url)}
                            alt={`Ảnh sản phẩm ${index + 1}`}
                          />
                          <span className="image-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="check-box">
                            {selected.includes(image.id) && (
                              <Check size={14} strokeWidth={3} />
                            )}
                          </span>
                        </div>
                        <div className="image-footer">
                          <span>
                            <GripVertical size={15} />{" "}
                            {image.width && image.height
                              ? `${image.width} × ${image.height}`
                              : "Ảnh sản phẩm"}
                          </span>
                          <div>
                            <button
                              aria-label="Chuyển lên"
                              onClick={() => move(image.id, -1)}
                              disabled={index === 0 || generating}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              aria-label="Chuyển xuống"
                              onClick={() => move(image.id, 1)}
                              disabled={
                                index === images.length - 1 || generating
                              }
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              aria-label="Xóa ảnh"
                              onClick={() => {
                                setImages((old) =>
                                  old.filter((item) => item.id !== image.id),
                                );
                                setSelected((old) =>
                                  old.filter((id) => id !== image.id),
                                );
                              }}
                              disabled={generating}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-gallery">
                  <div className="empty-icon">
                    <ImageIcon size={30} />
                  </div>
                  <strong>Chưa có ảnh sản phẩm</strong>
                  <p>Nhập URL sản phẩm ở trên để tự động tìm bộ ảnh.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="right-column">
            <section className="panel settings-panel">
              <div className="section-heading">
                <div className="step">03</div>
                <div>
                  <h2>Thiết lập hình ảnh</h2>
                  <p>Chọn phong cách cho bộ ảnh của bạn</p>
                </div>
              </div>
              <div className="field-title">PRESET HÌNH ẢNH</div>
              <div className="preset-list">
                {presets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreset(item.id)}
                    disabled={generating}
                    className={`preset-card ${preset === item.id ? "active" : ""}`}
                  >
                    <span className="preset-icon">{item.icon}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="radio">
                      {preset === item.id && <span />}
                    </span>
                  </button>
                ))}
              </div>
              <label className="field-title custom-label" htmlFor="instruction">
                HƯỚNG DẪN THÊM <span>TÙY CHỌN</span>
              </label>
              <textarea
                id="instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={500}
                disabled={generating}
                placeholder="Ví dụ: Dùng bối cảnh phòng trẻ em sáng, giữ nguyên tất cả phụ kiện..."
              />
              <div className="textarea-hint">
                AI sẽ ưu tiên giữ sản phẩm giống ảnh gốc.
              </div>
            </section>
            <section className="generate-panel">
              <div className="generate-top">
                <div className="generate-icon">
                  <Sparkles size={23} />
                </div>
                <div>
                  <strong>Sẵn sàng tạo ảnh?</strong>
                  <span>
                    {selected.length} ảnh đã chọn · Xuất 1200 × 1200 PNG
                  </span>
                </div>
              </div>
              <button
                className="button generate-button"
                onClick={() => void generate()}
                disabled={generating || !selected.length}
              >
                {generating ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <WandSparkles size={19} />
                )}
                {generating ? "Đang tạo ảnh..." : "Tạo bộ ảnh"}
                <ArrowRight size={18} />
              </button>
              <p>Ảnh được xử lý lần lượt để đảm bảo ổn định.</p>
            </section>
          </aside>
        </div>

        {selectedImages.length > 0 && Object.keys(results).length > 0 && (
          <section className="panel results-panel">
            <div className="results-head">
              <div className="section-heading">
                <div className="step">04</div>
                <div>
                  <h2>Kết quả</h2>
                  <p>Xem trước, thử lại hoặc tải ảnh đã hoàn tất</p>
                </div>
              </div>
              <span className="result-count">
                {completed}/{selectedImages.length} hoàn tất
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="result-grid">
              {selectedImages.map((image, index) => {
                const result = results[image.id];
                if (!result) return null;
                return (
                  <div className="result-card" key={image.id}>
                    <div className="result-preview">
                      {result.preview ? (
                        <img
                          src={result.preview}
                          alt={`Ảnh MimiToys ${index + 1}`}
                        />
                      ) : (
                        <img
                          className="dimmed"
                          src={imageSrc(image.url)}
                          alt="Ảnh gốc"
                        />
                      )}
                      {["queued", "downloading", "processing"].includes(
                        result.status,
                      ) && (
                        <div className="result-overlay">
                          <LoaderCircle className="spin" size={27} />
                        </div>
                      )}
                    </div>
                    <div className="result-info">
                      <div>
                        <strong>
                          Ảnh {String(index + 1).padStart(2, "0")}
                        </strong>
                        <span className={`status ${result.status}`}>
                          {labels[result.status]}
                        </span>
                      </div>
                      {result.error && (
                        <p className="result-error" title={result.error}>
                          {result.error}
                        </p>
                      )}
                      <div className="result-actions">
                        {result.blob && (
                          <button
                            onClick={() =>
                              saveBlob(
                                result.blob!,
                                `${String(index + 1).padStart(2, "0")}-mimitoys.png`,
                              )
                            }
                          >
                            <Download size={15} /> Tải ảnh
                          </button>
                        )}
                        {result.status === "failed" && (
                          <button
                            onClick={() => void retryOne(image)}
                            disabled={generating}
                          >
                            <RotateCcw size={15} /> Thử lại
                          </button>
                        )}
                        {result.status === "completed" && (
                          <button
                            onClick={() => void retryOne(image)}
                            disabled={generating}
                          >
                            <RotateCcw size={15} /> Tạo lại
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="results-bottom">
              <div>
                {hasFailed && (
                  <button
                    className="button secondary"
                    onClick={() => void generate(true)}
                    disabled={generating}
                  >
                    <RotateCcw size={16} /> Thử lại ảnh lỗi
                  </button>
                )}
              </div>
              <button
                className="button primary"
                onClick={() => void exportZip()}
                disabled={!completed || generating || exporting}
              >
                {exporting ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <PackageCheck size={17} />
                )}{" "}
                Tải tất cả dạng ZIP
              </button>
            </div>
          </section>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Đóng">
              <X size={15} />
            </button>
          </div>
        )}
      </main>
      <footer className="footer">
        <span>© MimiToys Image Studio</span>
        <span>Made for better product images.</span>
      </footer>
    </div>
  );
}
