// ---------------- Global state ----------------
let html5QrCode = null;
let isScanning = false;
let videoTrack = null;
let torchOn = false;

// All scanned barcodes (unique); behaves like a set
const scannedSet = new Set();

/* ---------- Helper: clean scanned / typed text ---------- */
function cleanId(text) {
  if (!text) return "";
  return String(text)
    .replace(/^\][A-Z0-9]{2}/i, "")          // strip leading ]XX from some scanners
    .replace(/[\u0000-\u001F\u007F]/g, "")   // remove control chars
    .trim();
}

/* ---------- Render scanned list + count ---------- */
function renderScanned() {
  const grid = document.getElementById("binsGrid");
  const msg = document.getElementById("message");

  if (!grid || !msg) return;

  grid.innerHTML = "";
  msg.innerHTML = "";

  const count = scannedSet.size;

  if (!count) {
    msg.innerHTML = `<p class="muted">No barcodes scanned yet.</p>`;
    return;
  }

  // Show count
  msg.innerHTML = `<p class="muted">Scanned barcodes: <strong>${count}</strong></p>`;

  // Show each scanned code as a card
  [...scannedSet]
    .sort()
    .forEach(code => {
      const div = document.createElement("div");
      div.className = "bin-card";
      div.textContent = code;

      // Click a card to remove, but ask first
      div.addEventListener("click", () => {
        const ok = confirm(
          `Remove this barcode from the list?\n\n${code}`
        );
        if (!ok) return;

        scannedSet.delete(code);
        renderScanned();
      });

      grid.appendChild(div);
    });
}

/* ---------- Toggle barcode (add or remove with confirm) ---------- */
function toggleBarcode(code) {
  if (!code) return;

  // Already scanned → ask confirmation before removing
  if (scannedSet.has(code)) {
    const ok = confirm(
      `This barcode is already in the list:\n\n${code}\n\nDo you want to REMOVE it?`
    );
    if (!ok) return;

    scannedSet.delete(code);
  } else {
    // New barcode → just add
    scannedSet.add(code);
  }

  renderScanned();
}

/* ---------- Form: manual entry + "Search" button ---------- */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const input = document.getElementById("id");
  const val = cleanId(input.value);
  input.value = "";

  if (!val) return;

  toggleBarcode(val);
});

/* ---------- QR / Barcode Scanner ---------- */
async function startScanner() {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || !cameras.length) {
      alert("No camera found!");
      return;
    }

    html5QrCode = new Html5Qrcode("qr-reader");
    isScanning = true;

    document.getElementById("scannerWrap").style.display = "block";
    document.getElementById("torchControls").style.display = "block";

    await html5QrCode.start(
      cameras[0].id,
      {
        fps: 10,
        qrbox: 250,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        videoConstraints: {
          facingMode: "environment",
          focusMode: "continuous"
        }
      },
      (decodedText) => {
        const cleaned = cleanId(decodedText);
        toggleBarcode(cleaned);
      }
    );

    const video = document.querySelector("#qr-reader video");
    if (video && video.srcObject) {
      videoTrack = video.srcObject.getVideoTracks()[0];
    }

  } catch (err) {
    console.error("Scanner error:", err);
    alert("Could not start camera. Check permissions and HTTPS.");
    stopScanner();
  }
}

async function stopScanner() {
  try {
    if (html5QrCode && isScanning) {
      await html5QrCode.stop();
    }
  } catch (e) {
    console.warn("Error stopping scanner:", e);
  }

  isScanning = false;
  document.getElementById("scannerWrap").style.display = "none";
  document.getElementById("torchControls").style.display = "none";
  enableTorch(false);
}

/* ---------- Torch / Flashlight ---------- */
async function enableTorch(on) {
  if (!videoTrack) return;

  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
    torchOn = on;
    const btn = document.getElementById("torchToggleBtn");
    if (btn) {
      btn.textContent = on ? "🔦 Turn OFF Flashlight" : "💡 Turn ON Flashlight";
    }
  } catch (err) {
    console.warn("Torch not supported:", err);
  }
}

/* ---------- Export scanned list to PDF ---------- */
function downloadScannedPDF() {
  if (!scannedSet.size) {
    alert("No barcodes scanned.");
    return;
  }

  const JsPDF =
    (window.jspdf && window.jspdf.jsPDF) ||
    window.jsPDF ||
    null;

  if (!JsPDF) {
    alert("PDF library (jsPDF) is not loaded. Please check script tag.");
    return;
  }

  const doc = new JsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const marginLeft = 40;
  let y = 40;
  const lineGap = 16;
  const pageHeight = doc.internal.pageSize.getHeight() - 40;

  const now = new Date();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Scanned Barcodes", marginLeft, y);
  y += 24;

  // Meta info: date/time + count
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${now.toLocaleString()}`, marginLeft, y);
  y += 16;
  doc.text(`Total scanned: ${scannedSet.size}`, marginLeft, y);
  y += 24;

  // Header label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BARCODE", marginLeft, y);
  y += 16;

  // Actual data
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const ids = [...scannedSet].sort();

  for (const code of ids) {
    if (y > pageHeight) {
      doc.addPage();
      y = 40;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("BARCODE (cont.)", marginLeft, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    }

    doc.text(String(code), marginLeft, y);
    y += lineGap;
  }

  const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const fileName = `scanned_barcodes_${ts}.pdf`;
  doc.save(fileName);
}

/* ---------- Wire buttons ---------- */
document.getElementById("scanBtn").addEventListener("click", startScanner);
document.getElementById("stopScanBtn").addEventListener("click", stopScanner);
document.getElementById("torchToggleBtn").addEventListener("click", () => {
  enableTorch(!torchOn);
});

// Reuse existing button for PDF download
document.getElementById("downloadMissingBtn").addEventListener("click", downloadScannedPDF);

/* ---------- Initial render ---------- */
renderScanned();
