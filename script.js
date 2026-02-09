const EMPTY_COUNT = 20;

let emptyBins = [];
let html5QrCode = null;
let isScanning = false;

/* ---------- Load Excel (Dictionary of EMPTY bins) ---------- */
async function loadExcel() {
  try {
    const res = await fetch("./book1.xlsx");
    if (!res.ok) throw new Error("Excel file not found");

    const data = await res.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const all = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const firstCell = (all[0]?.[0] || "").toString().toUpperCase();
    const hasHeader = firstCell === "LOCATION_ID";

    emptyBins = all
      .slice(hasHeader ? 1 : 0)
      .map(r => (r[0] ?? "").toString().trim().toUpperCase())
      .filter(Boolean);

    console.log("Empty bins loaded:", emptyBins.length);
  } catch (err) {
    console.error(err);
    document.getElementById("output").innerHTML =
      `<p class="muted">⚠️ Could not load empty bin file.</p>`;
  }
}

/* ---------- Core Dictionary Logic ---------- */
function findNextEmptyBins(scanId) {
  const scan = scanId.toUpperCase();
  const prefix = scan.substring(0, 5);

  const result = [];
  let started = false;

  for (const id of emptyBins) {
    if (started && id.substring(0, 5) !== prefix) break;
    if (id.substring(0, 5) !== prefix) continue;

    if (!started) {
      if (id < scan) continue;
      started = true;
    }

    result.push(id);
    if (result.length >= EMPTY_COUNT) break;
  }

  return result;
}

/* ---------- Render ---------- */
function renderBins(bins) {
  const grid = document.getElementById("binsGrid");
  grid.innerHTML = "";

  if (bins.length === 0) {
    grid.innerHTML = `<p class="muted">No empty bins found.</p>`;
    return;
  }

  bins.forEach(bin => {
    const div = document.createElement("div");
    div.className = "bin-card";
    div.textContent = bin;
    grid.appendChild(div);
  });
}

/* ---------- Search ---------- */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("id").value.trim();
  if (!input) return;

  const bins = findNextEmptyBins(input);
  renderBins(bins);
});

/* ---------- Scanner ---------- */
document.getElementById("scanBtn").addEventListener("click", async () => {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) return alert("No camera found");

    html5QrCode = new Html5Qrcode("qr-reader");
    isScanning = true;

    document.getElementById("scannerWrap").style.display = "block";

    await html5QrCode.start(
      cameras[0].id,
      { fps: 10, qrbox: 250 },
      decodedText => {
        document.getElementById("id").value = decodedText;
        stopScanner();
        document.getElementById("searchForm").requestSubmit();
      }
    );
  } catch (err) {
    console.error(err);
    alert("Camera error");
  }
});

async function stopScanner() {
  if (html5QrCode && isScanning) {
    await html5QrCode.stop();
  }
  isScanning = false;
  document.getElementById("scannerWrap").style.display = "none";
}

document.getElementById("stopScanBtn").addEventListener("click", stopScanner);

/* ---------- Init ---------- */
loadExcel();
