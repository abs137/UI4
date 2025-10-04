function renderGroupedLocations(locations) {
  const outputDiv = document.createElement("div");

  let currentGroup = null;
  let colorIndex = -1;
  const colors = ["#f0f8ff", "#ffdddd", "#ddffdd"]; // Light Blue, Light Red, Light Green

  locations.forEach((loc, index) => {
    const groupKey = loc.substring(0, 8);

    if (groupKey !== currentGroup) {
      currentGroup = groupKey;
      colorIndex = (colorIndex + 1) % colors.length;  // cycle through 0,1,2
    }

    const locDiv = document.createElement("div");
    locDiv.textContent = loc;
    locDiv.style.backgroundColor = colors[colorIndex];
    locDiv.style.padding = "6px 10px";
    locDiv.style.borderRadius = "6px";
    locDiv.style.marginBottom = "2px";

    outputDiv.appendChild(locDiv);
  });

  return outputDiv;
}
