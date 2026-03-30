import fs from "fs";
import gstr1Data from "./gstr1.json" with { type: "json" };

const TARGET_FIELDS = ["txval", "iamt", "camt", "samt", "csamt", "rt"];

function escapeCSV(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function row(section, ...values) {
  return [escapeCSV(section), ...values.map(escapeCSV)].join(",");
}

function targetVals(obj = {}) {
  return TARGET_FIELDS.map((f) => escapeCSV(obj[f] ?? ""));
}

const rows = [];
const HEADER = ["section", ...TARGET_FIELDS];
rows.push(HEADER.join(","));

// ── Helper: build a base context object for a row ──
function base(overrides = {}) {
  return {
    ctin_pos: "",
    inv_num: "",
    inv_date: "",
    inv_val: "",
    pos: "",
    rchrg: "",
    inv_typ: "",
    etin: "",
    diff_percent: "",
    note_type: "",
    note_num: "",
    note_date: "",
    exp_type: "",
    sb_port: "",
    sb_num: "",
    sb_date: "",
    sply_ty: "",
    original_period: "",
    item_num: "",
    ...overrides,
  };
}

function writeRow(section, ctx, itm_det = {}) {
  rows.push([escapeCSV(section), ...targetVals(itm_det)].join(","));
}

// ── B2B / B2BA ──
for (const sec of ["b2b", "b2ba"]) {
  (gstr1Data[sec] ?? []).forEach((group, gi) => {
    (group.inv ?? []).forEach((inv, ii) => {
      const ctx = base({
        ctin_pos: group.ctin ?? "",
        inv_num: inv.inum ?? inv.oinum ?? "",
        inv_date: inv.idt ?? inv.oidt ?? "",
        inv_val: inv.val ?? "",
        pos: inv.pos ?? "",
        rchrg: inv.rchrg ?? "",
        inv_typ: inv.inv_typ ?? "",
        etin: inv.etin ?? "",
        diff_percent: inv.diff_percent ?? "",
      });
      if (!inv.itms?.length) {
        writeRow(`${sec}[${gi}][${ii}]`, ctx);
      } else {
        inv.itms.forEach((itm) => {
          writeRow(
            `${sec}[${gi}][${ii}]`,
            { ...ctx, item_num: itm.num ?? "" },
            itm.itm_det,
          );
        });
      }
    });
  });
}

// ── B2CL / B2CLA ──
for (const sec of ["b2cl", "b2cla"]) {
  (gstr1Data[sec] ?? []).forEach((group, gi) => {
    (group.inv ?? []).forEach((inv, ii) => {
      const ctx = base({
        ctin_pos: group.pos ?? "",
        inv_num: inv.inum ?? inv.oinum ?? "",
        inv_date: inv.idt ?? inv.oidt ?? "",
        inv_val: inv.val ?? "",
        pos: group.pos ?? "",
        etin: inv.etin ?? "",
        diff_percent: inv.diff_percent ?? "",
      });
      if (!inv.itms?.length) {
        writeRow(`${sec}[${gi}][${ii}]`, ctx);
      } else {
        inv.itms.forEach((itm) => {
          writeRow(
            `${sec}[${gi}][${ii}]`,
            { ...ctx, item_num: itm.num ?? "" },
            itm.itm_det,
          );
        });
      }
    });
  });
}

// ── B2CS / B2CSA ──
for (const sec of ["b2cs", "b2csa"]) {
  (gstr1Data[sec] ?? []).forEach((entry, i) => {
    const ctx = base({
      pos: entry.pos ?? "",
      sply_ty: entry.sply_ty ?? "",
      etin: entry.etin ?? "",
      diff_percent: entry.diff_percent ?? "",
      original_period: entry.of ?? "",
    });
    writeRow(`${sec}[${i}]`, ctx, entry);
  });
}

// ── CDNR / CDNRA ──
for (const sec of ["cdnr", "cdnra"]) {
  (gstr1Data[sec] ?? []).forEach((group, gi) => {
    (group.nt ?? []).forEach((nt, ni) => {
      const ctx = base({
        ctin_pos: group.ctin ?? "",
        pos: nt.pos ?? "",
        rchrg: nt.rchrg ?? "",
        inv_typ: nt.inv_typ ?? "",
        diff_percent: nt.diff_percent ?? "",
        note_type: nt.ntty ?? "",
        note_num: nt.nt_num ?? nt.ont_num ?? "",
        note_date: nt.nt_dt ?? nt.ont_dt ?? "",
        inv_val: nt.val ?? "",
      });
      if (!nt.itms?.length) {
        writeRow(`${sec}[${gi}][${ni}]`, ctx);
      } else {
        nt.itms.forEach((itm) => {
          writeRow(
            `${sec}[${gi}][${ni}]`,
            { ...ctx, item_num: itm.num ?? "" },
            itm.itm_det,
          );
        });
      }
    });
  });
}

// ── CDNUR / CDNURA ──
for (const sec of ["cdnur", "cdnura"]) {
  (gstr1Data[sec] ?? []).forEach((nt, ni) => {
    const ctx = base({
      pos: nt.pos ?? "",
      diff_percent: nt.diff_percent ?? "",
      note_type: nt.ntty ?? "",
      note_num: nt.nt_num ?? nt.ont_num ?? "",
      note_date: nt.nt_dt ?? nt.ont_dt ?? "",
      inv_val: nt.val ?? "",
      inv_typ: nt.typ ?? "",
    });
    if (!nt.itms?.length) {
      writeRow(`${sec}[${ni}]`, ctx);
    } else {
      nt.itms.forEach((itm) => {
        writeRow(
          `${sec}[${ni}]`,
          { ...ctx, item_num: itm.num ?? "" },
          itm.itm_det,
        );
      });
    }
  });
}

// ── EXP / EXPA ──
for (const sec of ["exp", "expa"]) {
  (gstr1Data[sec] ?? []).forEach((group, gi) => {
    (group.inv ?? []).forEach((inv, ii) => {
      const ctx = base({
        inv_num: inv.inum ?? inv.oinum ?? "",
        inv_date: inv.idt ?? inv.oidt ?? "",
        inv_val: inv.val ?? "",
        exp_type: group.exp_typ ?? "",
        sb_port: inv.sbpcode ?? "",
        sb_num: inv.sbnum ?? "",
        sb_date: inv.sbdt ?? "",
      });
      if (!inv.itms?.length) {
        writeRow(`${sec}[${gi}][${ii}]`, ctx);
      } else {
        inv.itms.forEach((itm, ti) => {
          writeRow(`${sec}[${gi}][${ii}]`, { ...ctx, item_num: ti }, itm);
        });
      }
    });
  });
}

// ── AT / ATA / TXPD / TXPDA ──
for (const sec of ["at", "ata", "txpd", "txpda"]) {
  (gstr1Data[sec] ?? []).forEach((entry, i) => {
    const ctx = base({
      pos: entry.pos ?? "",
      sply_ty: entry.sply_ty ?? "",
      diff_percent: entry.diff_percent ?? "",
      original_period: entry.of ?? "",
    });
    (entry.itms ?? []).forEach((itm, ti) => {
      writeRow(`${sec}[${i}][${ti}]`, { ...ctx, item_num: ti }, itm);
    });
  });
}

// ── HSN B2B / B2C ──
for (const hsnKey of ["hsn_b2b", "hsn_b2c"]) {
  (gstr1Data.hsn?.[hsnKey] ?? []).forEach((entry, i) => {
    writeRow(`hsn.${hsnKey}[${i}]`, base({ item_num: entry.num ?? "" }), entry);
  });
}

// ── NIL ──
(gstr1Data.nil?.inv ?? []).forEach((entry, i) => {
  rows.push(
    [escapeCSV(`nil[${i}]`), ...Array(TARGET_FIELDS.length).fill("")].join(","),
  );
});

// ── Write CSV ──
fs.writeFileSync("gstr1.csv", rows.join("\n"), "utf8");
console.log("✅ CSV written to gstr1.csv");
