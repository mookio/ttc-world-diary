"use strict";

import { marked } from "https://cdn.jsdelivr.net/npm/marked@15.0.7/+esm";

const dayListEl = document.getElementById("day-list");
const contentEl = document.getElementById("content");
const tickNavEl = document.getElementById("tick-nav");
const toolbarTitleEl = document.getElementById("toolbar-title");
const sidebarEl = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const overlayEl = document.getElementById("overlay");

let manifest = { days: [] };
let currentDay = null;

marked.setOptions({ gfm: true, breaks: true });

function dayFromHash() {
  const raw = location.hash.replace(/^#/, "");
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function setHash(day) {
  const next = `#${day}`;
  if (location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

function closeSidebar() {
  sidebarEl.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
  overlayEl.hidden = true;
}

function openSidebar() {
  sidebarEl.classList.add("open");
  menuBtn.setAttribute("aria-expanded", "true");
  overlayEl.hidden = false;
}

function slugTick(headingText) {
  return headingText
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function enhanceHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ticks = [];

  for (const h2 of doc.querySelectorAll("h2")) {
    const text = h2.textContent || "";
    if (/^tick\s+\d+/i.test(text)) {
      const id = slugTick(text) || `tick-${ticks.length + 1}`;
      h2.id = id;
      h2.classList.add("tick-heading");
      ticks.push({ id, label: text });
    }
  }

  const firstH2 = doc.querySelector("h2");
  if (firstH2 && /^世界日記/.test(firstH2.textContent || "")) {
    const wrapper = doc.createElement("div");
    wrapper.className = "diary-block";
    const parent = firstH2.parentNode;
    let stopAt = null;
    let node = firstH2;
    while (node) {
      const next = node.nextElementSibling;
      if (node.tagName === "H2" && node !== firstH2 && /^tick\s/i.test(node.textContent || "")) {
        stopAt = node;
        break;
      }
      wrapper.appendChild(node);
      node = next;
    }
    parent.insertBefore(wrapper, stopAt);
  }

  return { html: doc.body.innerHTML, ticks };
}

function renderTickNav(ticks) {
  tickNavEl.innerHTML = "";
  if (!ticks.length) {
    tickNavEl.hidden = true;
    return;
  }
  tickNavEl.hidden = false;
  const title = document.createElement("h2");
  title.textContent = "時間軸";
  tickNavEl.appendChild(title);
  for (const tick of ticks) {
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = tick.label.replace(/^tick\s+/i, "");
    a.addEventListener("click", (event) => {
      event.preventDefault();
      const target = contentEl.querySelector(`#${CSS.escape(tick.id)}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    tickNavEl.appendChild(a);
  }
}

function renderDayList() {
  dayListEl.innerHTML = "";
  for (const item of manifest.days) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-link";
    btn.dataset.day = String(item.day);
    btn.innerHTML = `<span class="day-link-num">世界日記 ${item.day}</span><span class="day-link-title">${item.title}</span>`;
    btn.addEventListener("click", () => {
      loadDay(item.day);
      closeSidebar();
    });
    dayListEl.appendChild(btn);
  }
}

function highlightDay(day) {
  for (const btn of dayListEl.querySelectorAll(".day-link")) {
    const active = Number(btn.dataset.day) === day;
    btn.setAttribute("aria-current", active ? "page" : "false");
  }
}

async function loadDay(day) {
  const item = manifest.days.find((d) => d.day === day);
  if (!item) {
    return;
  }
  currentDay = day;
  setHash(day);
  highlightDay(day);
  toolbarTitleEl.textContent = `世界日記 ${day} · ${item.title}`;
  contentEl.innerHTML = "<p>載入中…</p>";

  const res = await fetch(item.file);
  if (!res.ok) {
    contentEl.innerHTML = `<p>無法載入 ${item.file}</p>`;
    return;
  }
  const md = await res.text();
  const rawHtml = marked.parse(md);
  const { html, ticks } = enhanceHtml(rawHtml);
  contentEl.innerHTML = html;
  renderTickNav(ticks);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

async function init() {
  menuBtn.addEventListener("click", () => {
    if (sidebarEl.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
  overlayEl.addEventListener("click", closeSidebar);
  window.addEventListener("hashchange", () => {
    const day = dayFromHash();
    if (day && day !== currentDay) {
      loadDay(day);
    }
  });

  const res = await fetch("manifest.json");
  if (!res.ok) {
    contentEl.innerHTML = "<p>找不到 manifest.json，請先執行 novel/build.py --sync-web</p>";
    return;
  }
  manifest = await res.json();
  renderDayList();

  const requested = dayFromHash();
  const fallback = manifest.days[0]?.day ?? 1;
  await loadDay(requested ?? fallback);
}

init();
