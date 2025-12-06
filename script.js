let html5QrCode = null;
let isScanning = false;
let videoTrack = null;
let torchOn = false;

// All scanned barcodes go here (unique, toggle add/remove)
const scannedSet = new Set();

/* ---------- Helpers ---------- */
function cleanId(text) {
  if (!text) return "";
  return String(text)
    .replace(/^\][A-Z0-9]{2}/i, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

/* ---------- Rendering ---------- */
function renderScanned() {
  const grid = document.getElementById("binsGrid");
  const msg = document.getElementById("message");

  grid.innerHTML = "";
  msg.innerHTML = "";

  if (!scannedSet.size) {
    msg.innerHTML = `<p class="muted">No barcodes scanned yet.</p>`;
    return;
  }

  [...scannedSet]
    .sort()
    .forEach(code => {
      const div = document.createElement("div");
      div.className = "bin-card";
      div.textContent = code;

      div.addEventListener("click", () => {
        scannedSet.delete(code);
        renderScanned();
      });

      grid.appendChild(div);
    });
}

/* ---------- Add / Remove scan ---------- */
function toggleBarcode(code) {
  if (!code) return;

  if (scannedSet.has(code)) {
    scannedSet.delete(code);
  } else {
    scannedSet.add(code);
  }

  renderScanned();
}

/* ---------- Form input ---------- */
document.getElementById("searchForm").addEventListener("submit", e => {
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
    if (!cameras.length) {
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
      decodedText => {
        toggleBarcode(cleanId(decodedText));
      }
    );

    const video = document.querySelector("#qr-reader video");
    if (video?.srcObject) {
      videoTrack = video.srcObject.getVideoTracks()[0];
    }

  } catch (err) {
    console.error(err);
    alert("Camera failed to start.");
  }
}

async function stopScanner() {
  if (html5QrCode && isScanning) await html5QrCode.stop();
  isScanning = false;

  document.getElementById("scannerWrap").style.display = "none";
  document.getElementById("torchControls").style.display = "none";

  enableTorch(false);
}

/* ---------- Torch ---------- */
async function enableTorch(on) {
  if (!videoTrack) return;

  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
    torchOn = on;

    document.getElementById("torchToggleBtn").textContent =
      on ? "🔦 Turn OFF Flashlight" : "💡 Turn ON Flashlight";

  } catch (err) {
    console.warn("Torch not supported.");
  }
}

/* ---------- EXPORT TO PDF ---------- */
function downloadScannedPDF() {

  if (!scannedSet.size) {
    alert("No barcodes scanned.");
    return;
  }

  const JsPDF =
    (window.jspdf && window.jspdf.jsPDF) ||
    window.jsPDF;

  if (!JsPDF) {
    alert("jsPDF not loaded.");
    return;
  }

  const doc = new JsPDF({ unit: "pt", format: "a4" });

  let y = 40;
  const lh = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Scanned Barcodes", 40, y);
  y += 25;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    40,
    y
  );

  y += 25;
  doc.setFontSize(11);

  [...scannedSet]
    .sort()
    .forEach(code => {
      if (y > 800) {
        doc.addPage();
        y = 40;
      }
      doc.text(code, 40, y);
      y += lh;
    });

  const ts = new Date().toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 12);

  doc.save(`scanned_barcodes_${ts}.pdf`);
}

/* ---------- Buttons ---------- */
document.getElementById("scanBtn").addEventListener("click", startScanner);
document.getElementById("stopScanBtn").addEventListener("click", stopScanner);
document.getElementById("torchToggleBtn").addEventListener("click", () => {
  enableTorch(!torchOn);
});
document.getElementById("downloadMissingBtn").addEventListener(
  "click",
  downloadScannedPDF
);

/* ---------- Initial ---------- */
renderScanned();
