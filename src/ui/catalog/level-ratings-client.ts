export function downloadLevelRatings(): void {
  const link = document.createElement("a");
  link.href = "/api/level-ratings/export";
  link.download = "";
  link.click();
}
