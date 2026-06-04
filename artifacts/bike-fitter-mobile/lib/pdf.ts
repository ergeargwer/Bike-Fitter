import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { FittingRecord } from "@/context/AppContext";

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function scoreLabel(score: number) {
  if (score >= 90) return "極佳";
  if (score >= 75) return "良好";
  if (score >= 60) return "尚可";
  return "需調整";
}

function scoreHex(score: number) {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#3b82f6";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function statusHex(status: "符合" | "偏高" | "偏低") {
  if (status === "符合") return "#22c55e";
  if (status === "偏高") return "#f59e0b";
  return "#ef4444";
}

function buildHtml(record: FittingRecord): string {
  const date = formatDate(record.date);
  const bikeLabel = record.measurements.bikeType === "road" ? "公路車" : "三鐵車";
  const { height, inseam, armLength, torsoLength } = record.measurements;
  const { saddleHeight, saddleHeightMin, saddleHeightMax } = record.lemond;
  const goodCount = record.analyses.filter((a) => a.status === "符合").length;
  const totalCount = record.analyses.length;
  const sl = scoreLabel(record.fitScore);
  const sc = scoreHex(record.fitScore);

  const angleRows = record.analyses
    .map((a) => {
      const sc2 = statusHex(a.status);
      return `
      <tr>
        <td>${a.name}</td>
        <td style="text-align:center;font-weight:600;">${a.detected.toFixed(1)}${a.unit}</td>
        <td style="text-align:center;">${a.recommendedMin}–${a.recommendedMax}${a.unit}</td>
        <td style="text-align:center;">
          <span style="background:${sc2}22;color:${sc2};border:1px solid ${sc2}44;border-radius:4px;padding:2px 8px;font-weight:600;">${a.status}</span>
        </td>
        <td style="font-size:12px;color:#6b7280;">${a.status !== "符合" ? a.suggestion : "—"}</td>
      </tr>`;
    })
    .join("");

  const kopsSection = record.kops
    ? `
    <div class="section">
      <div class="section-title">KOPS 膝蓋對齊分析</div>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>狀態</th>
            <th>說明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>3 點鐘位置膝蓋對齊</td>
            <td style="text-align:center;">
              <span style="background:${record.kops.isOptimal ? "#22c55e22" : "#f59e0b22"};color:${record.kops.isOptimal ? "#22c55e" : "#f59e0b"};border:1px solid ${record.kops.isOptimal ? "#22c55e44" : "#f59e0b44"};border-radius:4px;padding:2px 8px;font-weight:600;">${record.kops.isOptimal ? "符合" : "需調整"}</span>
            </td>
            <td style="font-size:12px;color:#6b7280;">${record.kops.description}${!record.kops.isOptimal ? "　" + record.kops.suggestion : ""}</td>
          </tr>
        </tbody>
      </table>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>單車 Fitting 報告</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    color: #111827;
    background: #fff;
    padding: 32px 40px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .app-name { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
  .report-title { font-size: 22px; font-weight: 800; color: #111827; }
  .meta { text-align: right; font-size: 13px; color: #6b7280; line-height: 1.8; }
  .score-row {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  .score-card {
    border: 2px solid ${sc}44;
    border-radius: 10px;
    padding: 16px 24px;
    text-align: center;
    flex: 0 0 auto;
    min-width: 120px;
  }
  .score-num { font-size: 48px; font-weight: 800; color: ${sc}; line-height: 1; }
  .score-label { font-size: 18px; font-weight: 700; color: ${sc}; margin-top: 4px; }
  .score-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .summary-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .summary-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 14px;
  }
  .summary-item-label { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
  .summary-item-value { font-size: 16px; font-weight: 700; color: #111827; }
  .section { margin-bottom: 20px; }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #374151;
    border-left: 3px solid #3b82f6;
    padding-left: 8px;
    margin-bottom: 10px;
  }
  .measurements-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .meas-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 14px;
    text-align: center;
  }
  .meas-label { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
  .meas-value { font-size: 18px; font-weight: 700; color: #111827; }
  .meas-unit { font-size: 12px; color: #6b7280; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    background: #f3f4f6;
    text-align: left;
    padding: 8px 10px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  table { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .footer {
    margin-top: 32px;
    border-top: 1px solid #e5e7eb;
    padding-top: 12px;
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="app-name">Bike Fitter</div>
      <div class="report-title">單車 Fitting 報告</div>
    </div>
    <div class="meta">
      <div>${date}</div>
      <div>${bikeLabel}</div>
    </div>
  </div>

  <div class="score-row">
    <div class="score-card">
      <div class="score-num">${record.fitScore}</div>
      <div class="score-label">${sl}</div>
      <div class="score-sub">綜合評分</div>
    </div>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-item-label">符合項目</div>
        <div class="summary-item-value">${goodCount} / ${totalCount} 項</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">建議座高</div>
        <div class="summary-item-value">${saddleHeight} cm</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">座高範圍</div>
        <div class="summary-item-value">${saddleHeightMin}–${saddleHeightMax} cm</div>
      </div>
      <div class="summary-item">
        <div class="summary-item-label">車款</div>
        <div class="summary-item-value">${bikeLabel}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">身體測量數據</div>
    <div class="measurements-grid">
      <div class="meas-item">
        <div class="meas-label">身高</div>
        <div class="meas-value">${height} <span class="meas-unit">cm</span></div>
      </div>
      <div class="meas-item">
        <div class="meas-label">跨高</div>
        <div class="meas-value">${inseam} <span class="meas-unit">cm</span></div>
      </div>
      <div class="meas-item">
        <div class="meas-label">手臂長</div>
        <div class="meas-value">${armLength} <span class="meas-unit">cm</span></div>
      </div>
      <div class="meas-item">
        <div class="meas-label">軀幹長</div>
        <div class="meas-value">${torsoLength} <span class="meas-unit">cm</span></div>
      </div>
    </div>
  </div>

  ${totalCount > 0 ? `
  <div class="section">
    <div class="section-title">關節角度分析</div>
    <table>
      <thead>
        <tr>
          <th>項目</th>
          <th style="text-align:center;">偵測值</th>
          <th style="text-align:center;">建議範圍</th>
          <th style="text-align:center;">狀態</th>
          <th>建議</th>
        </tr>
      </thead>
      <tbody>
        ${angleRows}
      </tbody>
    </table>
  </div>` : ""}

  ${kopsSection}

  <div class="footer">
    由 Bike Fitter App 自動產生　·　${date}
  </div>
</body>
</html>`;
}

export async function exportPdf(record: FittingRecord): Promise<void> {
  const html = buildHtml(record);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const date = new Date(record.date);
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const filename = `bike-fitting-${stamp}.pdf`;

  if (Platform.OS === "ios" || Platform.OS === "android") {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "匯出 Fitting 報告",
        UTI: "com.adobe.pdf",
      });
      return;
    }
  }

  await Print.printAsync({ uri });
  void filename;
}
