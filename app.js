
"use strict";

/* NERACAOS — PROTOTIPE AKUNTANSI PEMBELAJARAN
   Data disimpan di localStorage browser, tanpa server.
*/

const STORAGE_KEY = "neracaos_data_v1";

const accounts = [
  { code: "101", name: "Kas", group: "Aset", normal: "Debit" },
  { code: "102", name: "Piutang Usaha", group: "Aset", normal: "Debit" },
  { code: "151", name: "Peralatan", group: "Aset", normal: "Debit" },
  { code: "201", name: "Utang Usaha", group: "Liabilitas", normal: "Kredit" },
  { code: "301", name: "Modal Pemilik", group: "Ekuitas", normal: "Kredit" },
  { code: "401", name: "Pendapatan Jasa", group: "Pendapatan", normal: "Kredit" },
  { code: "501", name: "Beban Operasional", group: "Beban", normal: "Debit" }
];

const accountByCode = Object.fromEntries(
  accounts.map(account => [account.code, account])
);

const transactionRules = {
  cash_sale: {
    label: "Penjualan tunai",
    category: "Pendapatan",
    lines: (amount) => [
      { code: "101", debit: amount, credit: 0 },
      { code: "401", debit: 0, credit: amount }
    ]
  },
  credit_sale: {
    label: "Penjualan kredit",
    category: "Pendapatan",
    lines: (amount) => [
      { code: "102", debit: amount, credit: 0 },
      { code: "401", debit: 0, credit: amount }
    ]
  },
  expense: {
    label: "Pembayaran beban",
    category: "Beban",
    lines: (amount) => [
      { code: "501", debit: amount, credit: 0 },
      { code: "101", debit: 0, credit: amount }
    ]
  },
  buy_equipment: {
    label: "Pembelian peralatan tunai",
    category: "Aset",
    lines: (amount) => [
      { code: "151", debit: amount, credit: 0 },
      { code: "101", debit: 0, credit: amount }
    ]
  },
  payable_payment: {
    label: "Pembayaran utang usaha",
    category: "Utang",
    lines: (amount) => [
      { code: "201", debit: amount, credit: 0 },
      { code: "101", debit: 0, credit: amount }
    ]
  },
  owner_investment: {
    label: "Setoran modal",
    category: "Modal",
    lines: (amount) => [
      { code: "101", debit: amount, credit: 0 },
      { code: "301", debit: 0, credit: amount }
    ]
  }
};

const rupiah = value =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value || 0);

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

function createTransaction(type, amount, description, date, reference = "") {
  const rule = transactionRules[type];
  if (!rule) throw new Error("Jenis transaksi tidak dikenali.");

  const value = Number(amount);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Jumlah harus berupa bilangan bulat positif.");
  }

  const lines = rule.lines(value);
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (debit !== credit) {
    throw new Error("Jurnal tidak seimbang. Transaksi dibatalkan.");
  }

  return {
    id: makeId(),
    journalNo: "",
    type,
    label: rule.label,
    category: rule.category,
    description: description.trim() || rule.label,
    date,
    reference: reference.trim(),
    amount: value,
    lines,
    createdAt: new Date().toISOString()
  };
}

function makeId() {
  return "tx_" + Date.now().toString(36) +
    "_" + Math.random().toString(36).slice(2, 8);
}

function makeDemoData() {
  const examples = [
    ["owner_investment", 10000000, "Setoran modal awal", "MOD-001"],
    ["cash_sale", 3500000, "Pendapatan jasa desain", "INV-001"],
    ["expense", 750000, "Pembayaran beban internet", "EXP-001"]
  ];

  const transactions = examples.map((item, index) => {
    const tx = createTransaction(
      item[0], item[1], item[2], today(), item[3]
    );
    tx.journalNo = "JU-" + String(index + 1).padStart(4, "0");
    return tx;
  });

  return { transactions, nextNumber: transactions.length + 1 };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.transactions) &&
          Number.isInteger(parsed.nextNumber)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Data tersimpan tidak bisa dibaca.", error);
  }

  const initial = makeDemoData();
  saveData(initial);
  return initial;
}

let state = loadData();

function saveData(data = state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast("Data tidak bisa disimpan. Periksa ruang penyimpanan browser.");
    console.error(error);
  }
}

function allLines() {
  return state.transactions.flatMap(tx =>
    tx.lines.map(line => ({ ...line, tx }))
  );
}

function accountBalance(code) {
  const account = accountByCode[code];
  const lines = allLines().filter(line => line.code === code);
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);

  return account.normal === "Debit" ? debit - credit : credit - debit;
}

function groupTotal(group) {
  return accounts
    .filter(account => account.group === group)
    .reduce((sum, account) => sum + accountBalance(account.code), 0);
}

function financialTotals() {
  const assets = groupTotal("Aset");
  const liabilities = groupTotal("Liabilitas");
  const capital = groupTotal("Ekuitas");
  const revenue = groupTotal("Pendapatan");
  const expenses = groupTotal("Beban");
  const profit = revenue - expenses;

  return {
    assets, liabilities, capital, revenue, expenses, profit,
    equity: capital + profit,
    left: assets,
    right: liabilities + capital + profit
  };
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function cell(value) {
  return `<td>${escapeHTML(value)}</td>`;
}

function emptyRow(columns, message = "Belum ada data.") {
  return `<tr><td colspan="${columns}" class="empty">${message}</td></tr>`;
}

function renderDashboard() {
  const totals = financialTotals();

  document.getElementById("assets").textContent = rupiah(totals.assets);
  document.getElementById("revenue").textContent = rupiah(totals.revenue);
  document.getElementById("expenses").textContent = rupiah(totals.expenses);
  document.getElementById("profit").textContent = rupiah(totals.profit);
  document.getElementById("eqAssets").textContent = rupiah(totals.left);
  document.getElementById("eqLE").textContent = rupiah(totals.right);

  const balanced = Math.abs(totals.left - totals.right) < 0.01;
  const status = document.getElementById("balanceStatus");
  status.textContent = balanced
    ? "● Seimbang"
    : "● Belum seimbang — periksa jurnal";
  status.className = balanced ? "success" : "";

  const lines = allLines();
  document.getElementById("txTotal").textContent = state.transactions.length;
  document.getElementById("debitTotal").textContent =
    rupiah(lines.reduce((sum, line) => sum + line.debit, 0));
  document.getElementById("creditTotal").textContent =
    rupiah(lines.reduce((sum, line) => sum + line.credit, 0));

  const recent = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  document.getElementById("recentRows").innerHTML = recent.length
    ? recent.map(tx => `<tr>
        ${cell(tx.date)}
        ${cell(tx.description)}
        ${cell(tx.category)}
        ${cell(rupiah(tx.amount))}
      </tr>`).join("")
    : emptyRow(4);
}

function renderTransactions() {
  const search = (
    document.getElementById("txSearch")?.value || ""
  ).toLowerCase();

  const list = [...state.transactions]
    .filter(tx =>
      tx.description.toLowerCase().includes(search) ||
      tx.reference.toLowerCase().includes(search) ||
      tx.label.toLowerCase().includes(search)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById("transactionsRows").innerHTML = list.length
    ? list.map(tx => `<tr>
        ${cell(tx.date)}
        ${cell(tx.description)}
        ${cell(tx.category)}
        ${cell(tx.reference || "—")}
        ${cell(rupiah(tx.amount))}
      </tr>`).join("")
    : emptyRow(5);
}

function renderJournal() {
  const rows = [];

  [...state.transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(tx => {
      tx.lines.forEach(line => {
        rows.push(`<tr>
          ${cell(tx.date)}
          ${cell(tx.journalNo)}
          ${cell(accountByCode[line.code].name)}
          ${cell(tx.description)}
          ${cell(line.debit ? rupiah(line.debit) : "—")}
          ${cell(line.credit ? rupiah(line.credit) : "—")}
        </tr>`);
      });
    });

  document.getElementById("journalRows").innerHTML =
    rows.length ? rows.reverse().join("") : emptyRow(6);
}

function renderAccounts() {
  document.getElementById("accountRows").innerHTML = accounts.map(account => `
    <tr>
      ${cell(account.code)}
      ${cell(account.name)}
      ${cell(account.group)}
      ${cell(account.normal)}
      ${cell(rupiah(accountBalance(account.code)))}
    </tr>
  `).join("");
}

function renderLedger() {
  const select = document.getElementById("ledgerAccount");
  const previous = select.value;

  select.innerHTML = accounts.map(account =>
    `<option value="${account.code}">${account.code} — ${escapeHTML(account.name)}</option>`
  ).join("");

  if (accounts.some(account => account.code === previous)) {
    select.value = previous;
  }

  const code = select.value || accounts[0].code;
  const account = accountByCode[code];
  const rows = [];
  let balance = 0;

  const transactions = [...state.transactions]
    .sort((a, b) => a.date.localeCompare(b.date));

  transactions.forEach(tx => {
    tx.lines.filter(line => line.code === code).forEach(line => {
      balance += account.normal === "Debit"
        ? line.debit - line.credit
        : line.credit - line.debit;

      rows.push(`<tr>
        ${cell(tx.date)}
        ${cell(tx.description)}
        ${cell(rupiah(line.debit))}
        ${cell(rupiah(line.credit))}
        ${cell(rupiah(balance))}
      </tr>`);
    });
  });

  document.getElementById("ledgerRows").innerHTML =
    rows.length ? rows.reverse().join("") : emptyRow(5);

  const heading = document.querySelector("#ledger h1");
  if (heading) heading.textContent = `Buku besar — ${account.name}`;
}

let currentReport = "income";

function renderReport(type = currentReport) {
  currentReport = type;
  const totals = financialTotals();
  let title = "";
  let html = "";

  if (type === "income") {
    title = "Laporan laba rugi";
    html = `
      <div class="report-line"><span>Pendapatan</span><b>${rupiah(totals.revenue)}</b></div>
      <div class="report-line"><span>Beban operasional</span><b>${rupiah(totals.expenses)}</b></div>
      <div class="report-line total"><span>Laba / (rugi) bersih</span><b>${rupiah(totals.profit)}</b></div>
    `;
  } else if (type === "balance") {
    title = "Laporan posisi keuangan";
    html = `
      <div class="report-line"><span>Total aset</span><b>${rupiah(totals.assets)}</b></div>
      <div class="report-line"><span>Total liabilitas</span><b>${rupiah(totals.liabilities)}</b></div>
      <div class="report-line"><span>Modal pemilik</span><b>${rupiah(totals.capital)}</b></div>
      <div class="report-line"><span>Laba / (rugi) berjalan</span><b>${rupiah(totals.profit)}</b></div>
      <div class="report-line total"><span>Liabilitas + ekuitas</span><b>${rupiah(totals.right)}</b></div>
    `;
  } else {
    title = "Neraca saldo";
    const rows = accounts.map(account => {
      const balance = accountBalance(account.code);
      const debit = account.normal === "Debit" ? Math.max(balance, 0) :
        Math.max(-balance, 0);
      const credit = account.normal === "Kredit" ? Math.max(balance, 0) :
        Math.max(-balance, 0);

      return `<tr>
        ${cell(account.code)}
        ${cell(account.name)}
        ${cell(debit ? rupiah(debit) : "—")}
        ${cell(credit ? rupiah(credit) : "—")}
      </tr>`;
    }).join("");

    const lines = allLines();
    const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
    const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);

    html = `<div class="table-wrap"><table>
      <thead><tr><th>Kode</th><th>Akun</th><th>Debit</th><th>Kredit</th></tr></thead>
      <tbody>${rows}
      <tr><td colspan="2"><b>Total</b></td>
      <td><b>${rupiah(debitTotal)}</b></td>
      <td><b>${rupiah(creditTotal)}</b></td></tr>
      </tbody></table></div>`;
  }

  document.getElementById("reportHeading").textContent = title;
  document.getElementById("reportContent").innerHTML = html;

  document.querySelectorAll("[data-report]").forEach(button => {
    button.classList.toggle("active", button.dataset.report === type);
  });
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderJournal();
  renderAccounts();
  renderLedger();
  renderReport(currentReport);
}

function showPage(pageName) {
  const page = document.getElementById(pageName);
  if (!page) return;

  document.querySelectorAll(".page").forEach(section =>
    section.classList.toggle("active", section.id === pageName)
  );

  document.querySelectorAll(".nav").forEach(button =>
    button.classList.toggle("active", button.dataset.page === pageName)
  );

  const title = page.querySelector("h1")?.textContent || pageName;
  document.getElementById("pageTitle").textContent = title;

  if (pageName === "ledger") renderLedger();
  if (pageName === "reports") renderReport(currentReport);
}

function postTransaction(event) {
  event.preventDefault();

  try {
    const type = document.getElementById("txType").value;
    const date = document.getElementById("txDate").value;
    const description = document.getElementById("txDescription").value;
    const amount = Number(document.getElementById("txAmount").value);
    const reference = document.getElementById("txReference").value;

    if (!date) throw new Error("Tanggal transaksi wajib diisi.");

    const tx = createTransaction(type, amount, description, date, reference);
    tx.journalNo = "JU-" + String(state.nextNumber).padStart(4, "0");

    state.transactions.push(tx);
    state.nextNumber += 1;
    saveData();
    renderAll();

    document.getElementById("transactionForm").reset();
    document.getElementById("txDate").value = today();
    showToast(`Jurnal ${tx.journalNo} berhasil diposting.`);
    showPage("transactions");
  } catch (error) {
    showToast(error.message || "Transaksi gagal diproses.");
  }
}

function testRule(event) {
  event.preventDefault();

  try {
    const type = document.getElementById("testType").value;
    const amount = Number(document.getElementById("testAmount").value);
    const rule = transactionRules[type];
    const tx = createTransaction(type, amount, rule.label, today());
    const debit = tx.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = tx.lines.reduce((sum, line) => sum + line.credit, 0);

    const rows = tx.lines.map(line => `
      <div class="report-line">
        <span>${escapeHTML(accountByCode[line.code].name)}</span>
        <b>${line.debit ? "D " + rupiah(line.debit) :
          "K " + rupiah(line.credit)}</b>
      </div>
    `).join("");

    document.getElementById("ruleTestResult").innerHTML = `
      <b>${escapeHTML(rule.label)}</b>
      ${rows}
      <p><b>Total debit:</b> ${rupiah(debit)}</p>
      <p><b>Total kredit:</b> ${rupiah(credit)}</p>
      <p class="success">${debit === credit ? "✓ Jurnal seimbang" : "Jurnal tidak seimbang"}</p>
      <small>Simulasi ini tidak menyimpan transaksi.</small>
    `;
  } catch (error) {
    showToast(error.message || "Simulasi gagal.");
  }
}

function downloadCSV(filename, rows) {
  const csv = rows.map(row =>
    row.map(value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"'
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportJournal() {
  const rows = [["Tanggal", "No Jurnal", "Kode Akun", "Nama Akun",
    "Deskripsi", "Debit", "Kredit"]];

  state.transactions.forEach(tx => {
    tx.lines.forEach(line => {
      rows.push([
        tx.date, tx.journalNo, line.code, accountByCode[line.code].name,
        tx.description, line.debit, line.credit
      ]);
    });
  });

  downloadCSV("neracaos-jurnal.csv", rows);
}

function exportReport() {
  const rows = [["Kode", "Nama akun", "Kelompok", "Saldo"]];
  accounts.forEach(account => {
    rows.push([
      account.code, account.name, account.group, accountBalance(account.code)
    ]);
  });
  downloadCSV("neracaos-laporan.csv", rows);
}

function resetDemo() {
  const confirmed = window.confirm(
    "Reset seluruh transaksi dan kembalikan data contoh? Tindakan ini tidak bisa dibatalkan."
  );
  if (!confirmed) return;

  state = makeDemoData();
  saveData();
  renderAll();
  showToast("Data demo berhasil direset.");
}

// Navigasi sidebar dan tombol pintas.
document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.goto));
});

// Form transaksi dan pencarian.
document.getElementById("transactionForm")
  .addEventListener("submit", postTransaction);

document.getElementById("txSearch")
  .addEventListener("input", renderTransactions);

document.getElementById("ledgerAccount")
  .addEventListener("change", renderLedger);

// Rule engine.
document.getElementById("ruleTestForm")
  .addEventListener("submit", testRule);

// Tab laporan.
document.querySelectorAll("[data-report]").forEach(button => {
  button.addEventListener("click", () => renderReport(button.dataset.report));
});

// Ekspor data.
document.getElementById("exportCsv")
  .addEventListener("click", exportJournal);

document.getElementById("reportExport")
  .addEventListener("click", exportReport);

// Muat ulang data demo.
const resetButton = document.createElement("button");
resetButton.className = "secondary";
resetButton.textContent = "Reset data demo";
resetButton.style.marginBottom = "18px";
resetButton.addEventListener("click", resetDemo);

const accountsPage = document.getElementById("accounts");
const accountsHeading = accountsPage.querySelector(".heading");
accountsHeading.appendChild(resetButton);

// Atur tanggal awal dan tampilkan data.
document.getElementById("txDate").value = today();
renderAll();
