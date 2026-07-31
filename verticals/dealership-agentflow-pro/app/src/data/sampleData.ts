export type ModuleStatus = "done" | "running" | "queued" | "error";

export interface ModuleRun {
  code: string;
  name: string;
  status: ModuleStatus;
  summary: string;
}

export const dealershipName = "Northgate Motors";

export const kpis = [
  { label: "Hot leads today", value: "19", delta: "+4 vs yesterday", trend: "up" as const },
  { label: "Units aging 60+", value: "6", delta: "tying up $438K", trend: "down" as const },
  { label: "Deals in desk", value: "9", delta: "$312K gross potential", trend: "flat" as const },
  { label: "Gross MTD", value: "$362K", delta: "+11% vs last month", trend: "up" as const },
];

export const moduleRuns: ModuleRun[] = [
  { code: "M1", name: "Social & Sales", status: "done", summary: "Posted 6 pieces of content, answered 84 comments/DMs" },
  { code: "M2", name: "Inventory & Pricing", status: "done", summary: "Flagged 4 units to reprice, 2 to buy more of at auction" },
  { code: "M3", name: "Finance & Deal Desk", status: "done", summary: "Structured 9 deals, matched each to its best lender" },
  { code: "M4", name: "Trade-In Appraisal", status: "done", summary: "Appraised 5 trades" },
  { code: "M5", name: "Service Retention", status: "running", summary: "17 recalls/reminders sent so far" },
  { code: "M6", name: "Reviews & Reputation", status: "queued", summary: "Waiting on M3 close events" },
  { code: "M7", name: "Lead Reactivation", status: "queued", summary: "Waiting on morning sweep" },
];

export const inventoryAging = [
  { bucket: "0-15", units: 11 },
  { bucket: "16-30", units: 14 },
  { bucket: "31-45", units: 6 },
  { bucket: "46-60", units: 3 },
  { bucket: "60+", units: 6 },
];

export const grossByMonth = [
  { month: "Feb", gross: 268 },
  { month: "Mar", gross: 291 },
  { month: "Apr", gross: 305 },
  { month: "May", gross: 334 },
  { month: "Jun", gross: 347 },
  { month: "Jul", gross: 362 },
];

export const hotLeads = [
  { lead: "Jordan Ellis", interest: "2024 BMW M4 · financing", score: 94 },
  { lead: "Priya Nathan", interest: "Porsche Taycan · test drive", score: 89 },
  { lead: "Marcus Cole", interest: "911 Turbo S · cash buyer", score: 87 },
  { lead: "Dana Wu", interest: "EQE 350 · trade-in inquiry", score: 81 },
];

export const agingAndReprice = [
  { unit: "Mercedes-Benz EQE 350", situation: "84 days on lot", action: "Wholesale" },
  { unit: "Mercedes-Benz EQE 350 (2)", situation: "91 days on lot", action: "Wholesale" },
  { unit: "BMW M4 Competition", situation: "$1.7K over market", action: "Reprice" },
  { unit: "Porsche 911 Carrera", situation: "sells fast, low stock", action: "Buy more at auction" },
];
