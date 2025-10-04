<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Search from Excel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- SheetJS (read Excel) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <!-- html5-qrcode (camera scanning) -->
  <script src="https://unpkg.com/html5-qrcode" defer></script>

  <style>
    :root {
      --bg: #f8f9fa; --card: #ffffff; --text: #1f2937; --muted: #6b7280;
      --primary: #0d6efd; --primary-hover: #0b5ed7; --radius: 10px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--text); background: var(--bg); }
    .card { max-width: 900px; margin: 0 auto; background: var(--card); border-radius: var(--radius); box-shadow: 0 2px 8px rgba(0,0,0,.06); padding: 16px; }
    form { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; margin-bottom: 12px; }
    input[type="text"] { flex: 1 1 260px; min-width: 200px; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; }
    button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; font-size: 1rem; background: var(--primary); color: #fff; }
    button:hover { background: var(--primary-hover); }
    #scannerWrap { display: none; margin-top: 12px; text-align: center; }
    #qr-reader { width: 100%; max-width: 360px; margin: 0 auto; }
    .muted { color: var(--muted); font-size: .92rem; }
    #output { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .bin-card {
      font-size: 1.2rem;
      font-weight: 600;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0,0,0,.1);
    }
    @media (max-width: 480px) { button { flex: 1 1 100%; } }
  </style>
</head>
<body>

  <div class="card">
    <form id="searchForm">
      <input type="text" id="id" name="id" required placeholder="Enter or scan ID" autocomplete="off" />
      <button type="submit">Search</button>
      <button type="button" id="scanBtn">📷 Scan</button>
    </form>

    <div id="scannerWrap">
      <div id="qr-reader"></div>
      <p class="muted">Tip: allow camera permission (HTTPS). Rear camera is used on phones.</p>
      <button type="button" id="stopScanBtn">Stop camera</button>
    </div>

    <div id="output"></div>
  </div>

  <script>
    const EMPTY_COUNT = 20;
    let rowsRaw = [];

    async function loadExcel() {
      try {
        const res = await fetch("./book1.xlsx");
        if (!res.ok) throw new Error(`Could not fetch Excel: ${res.status} ${res.statusText}`);
        const data = await res.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const all = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false });

        const first = all[0] || [];
        const a0 = (first[0] ?? "").toString().trim().toUpperCase();
        const b0 = (first[1] ?? "").toString().trim().toUpperCase();
        const hasHeader = (a0 === "ID") || (b0 === "DETAILS") || (b0 === "STATUS");

        rowsRaw = all.slice(hasHeader ? 1 : 0).map(r => [
          (r[0] ?? "").toString().trim(),
          (r[1] ?? "").toString().trim()
        ]);

        console.log("Excel loaded. Number of rows:", rowsRaw.length);
      } catch (err) {
        console.error(err);
        document.getElementById("output").textContent =
          "⚠️ Could not load Excel file. Check file name/path and that it sits next to index.html.";
      }
    }

    function isEMPTY(val) {
      const v = (val ?? "").toString().trim().toUpperCase();
      return v === "" || v === "Y" || v === "EMPTY";
    }

    // ===== UPDATED cleanId() function =====
    function cleanId(text) {
      if (!text) return "";
      let t = String(text);

      // Remove BOM or control chars at start
      t = t.replace(/^\uFEFF/, "").replace(/^[\u0000-\u001F\u007F]+/, "");

      // Remove ]C1 specifically at start
      t = t.replace(/^\]C1/, "");

      return t.trim();
    }

    function findNextEmptyLocations(startId, count = EMPTY_COUNT) {
      const idx = rowsRaw.findIndex(r => r[0] === startId);
      if (idx === -1) return { foundIndex: -1, locations: [] };

      const out = [];
      for (let i = idx + 1; i < rowsRaw.length && out.length < count; i++) {
        if (isEMPTY(rowsRaw[i][1])) out.push(rowsRaw[i][0]);
      }
      return { foundIndex: idx, locations: out };
    }

    function renderGroupedLocations(locations) {
      const outputDiv = document.createDocumentFragment();
      let currentGroup = null;
      let colorIndex = -1;
      const colors = ["#f0f8ff", "#ffdddd", "#ddffdd", "#fff3cd", "#e0bbff"];

      locations.forEach(loc => {
        const groupKey = loc.substring(0, 8);
        if (groupKey !== currentGroup) {
          currentGroup = groupKey;
          colorIndex = (colorIndex + 1) % colors.length;
        }

        const locDiv = document.createElement("div");
        locDiv.className = "bin-card";
        locDiv.textContent = loc;
        locDiv.style.backgroundColor = colors[colorIndex];

        outputDiv.appendChild(locDiv);
      });
      return outputDiv;
    }

    document.getElementById("searchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const searchId = cleanId(document.getElementById("id").value);
      const output = document.getElementById("output");
      output.innerHTML = "";

      if (!searchId) {
        output.innerHTML = `<p style="color:red">Please enter a valid ID.</p>`;
        return;
      }

      const { foundIndex, locations } = findNextEmptyLocations(searchId, EMPTY_COUNT);

      if (foundIndex === -1) {
        output.innerHTML = `<p style="color:red">ID not found in the first column.</p>`;
        return;
      }
      if (locations.length === 0) {
        output.innerHTML = `<p class="muted">No empty bins found after the given ID.</p>`;
        return;
      }
      output.appendChild(renderGroupedLocations(locations));
    });

    /* Camera scanning */
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
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            const clean = cleanId(decodedText);
            idInput.value = clean;
            stopScanning();
            document.getElementById("searchForm").requestSubmit();
          }
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

    loadExcel();
  </script>
</body>
</html>
