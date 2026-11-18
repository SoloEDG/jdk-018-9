export function demoImage(): string {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 720;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, "#202d4a");
  sky.addColorStop(0.6, "#cb866e");
  sky.addColorStop(1, "#f2c392");
  g.fillStyle = sky;
  g.fillRect(0, 0, 960, 720);
  g.fillStyle = "#fbd7a0";
  g.beginPath();
  g.arc(650, 220, 94, 0, Math.PI * 2);
  g.fill();
  for (let layer = 0; layer < 4; layer++) {
    g.fillStyle = ["#6a6378", "#4d5869", "#2f4554", "#152d36"][layer]!;
    g.beginPath();
    g.moveTo(0, 720);
    for (let x = 0; x <= 960; x += 30) {
      const y =
        420 +
        layer * 65 -
        Math.sin(x * 0.008 + layer * 2) * 85 -
        Math.sin(x * 0.017 + layer) * 42;
      g.lineTo(x, y);
    }
    g.lineTo(960, 720);
    g.fill();
  }
  g.fillStyle = "#10282c";
  for (let i = 0; i < 18; i++) {
    const x = i * 59;
    const h = 35 + Math.sin(i * 4) * 25;
    g.beginPath();
    g.moveTo(x, 640 - h);
    g.lineTo(x - 18, 665);
    g.lineTo(x + 18, 665);
    g.fill();
    g.fillRect(x - 2, 660, 4, 35);
  }
  return c.toDataURL("image/png");
}
