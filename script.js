let rowsRaw = [];   // full sheet rows (array of arrays) to preserve order
const EMPTY_COUNT = 20; // <-- how many EMPTY bins to return

/* ------------ Excel loading (keep order) ------------ */
async function loadExcel() {
  try {
    const res = await fetch("./book1.xlsx");
    if (!res.ok) throw new Error(`Could not fetch Excel: ${res.status} ${res.statusText}`);

    const data = await res.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];

    // header:1 -> arrays; raw:false -> keep as strings
    const all = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Expect: first row = header, then data
    rowsRaw = all.slice(1).map(r => [
      (r[0] ?? "").toString().trim(),   // Column A (ID / location)
      (r[1] ?? "").toString().trim()    // Column B (Details / EMPTY or a code)
    ]);

    console.log("Loaded rows:", rowsRaw.length);
  } catch (err) {
    console.error(err);
    document.getElementById("output").textContent =
      "⚠️ Could not load Excel file. Check file name/path.";
  }
}

/* ------------ Utility ------------ */
function isEMPTY(val) {
  return val.trim().toUpperCase() === "EMPTY";
}

// Strip ]C1 prefix if present (scanner symbology identifier)
function stripC1Prefix(text) {
  return text.startsWith("]C1") ? text.substring(3) : text;
}

/**
 * Find next N locations (column A values) AFTER the row where column A === startId
 * such that column B === 'EMPTY' (case-insensitive).
 */
function findNextEmptyLocations(startId, count = EMPTY_COUNT) {
  const idx = rowsRaw.findIndex(r => r[0] === startId);
  if (idx === -1) return { foundIndex: -1, locations: [] };

  const out = [];
  for (let i = idx + 1; i < rowsRaw.length && out.length < count; i++) {
    const colA = rowsRaw[i][0];
    const colB = rowsRaw[i][1];
    if (isEMPTY(colB)) out.push(colA);
  }
  return { foundIndex: idx, locations: out };
}

/* ------------ Render helpers ------------ */
function renderList(title, items) {
  const li = items.map(x => `<li><code>${x}</code></li>`).join("");
  return `
    <h3>${title}</h3>
    ${items.length ? `<ol>${li}</ol>` : `<p class="muted">No results.</p>`}
  `;
}

/* ------------ Search form ------------ */
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  let searchId = document.getElementById("id").value.trim();
  searchId = stripC1Prefix(searchId); // remove ]C1 if present

  const output = document.getElementById("output");
  output.innerHTML = "";

  const { foundIndex, locations } = findNextEmptyLocations(searchId, EMPTY_COUNT);

  if (foundIndex === -1) {
    output.innerHTML = `<p style="color:red">ID not found in the first column.</p>`;
    return;
  }

  output.innerHTML = `
    <p><strong>Start ID:</strong> <code>${searchId}</code></p>
    ${renderList(\`Next ${EMPTY_COUNT} locations with EMPTY in column 2\`, locations)}
  `;
});

/* ------------ Camera scanning (html5-qrcode) ------------ */
let html5QrCode = null;
let isScanning = false;

const scanBtn = document.getElementById("scanBtn");
const stopScanBtn = document.getElementById("stopScanBtn");
const scannerWrap = document.getElementById("scannerWrap");
const idInput = document.getElementById("id");

scanBtn.addEventListener("click", async () => {
  if (isScanning) return;
  try {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");
    scannerWrap.style.display = "block";
    isScanning = true;

    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF
        ]
      },
      (decodedText) => {
        const clean = stripC1Prefix(decodedText).trim();
        idInput.value = clean;
        stopScanning();
        document.getElementById("searchForm").requestSubmit();
      },
      () => { /* ignore per-frame scan errors */ }
    );
  } catch (err) {
    isScanning = false;
    console.error(err);
    alert("Could not start camera. Ensure permission is allowed and you're on HTTPS.");
    scannerWrap.style.display = "none";
  }
});

stopScanBtn.addEventListener("click", stopScanning);

async function stopScanning() {
  if (html5QrCode && isScanning) {
    try { await html5QrCode.stop(); } catch (_) {}
  }
  isScanning = false;
  scannerWrap.style.display = "none";
}

/* ------------ Init ------------ */
loadExcel();
