"use strict";

import { marked } from "https://cdn.jsdelivr.net/npm/marked@15.0.7/+esm";

const dayListEl = document.getElementById("day-list");
const contentEl = document.getElementById("content");
const toolbarTitleEl = document.getElementById("toolbar-title");
const sidebarEl = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const overlayEl = document.getElementById("overlay");

let manifest = { days: [] };
let currentDay = null;

const CHARACTERS = [
  { id: "misaki", name: "美咲" },
  { id: "ren", name: "渡邊蓮" },
  { id: "yui", name: "結衣" },
];

const CHARACTERS_BY_NAME = [...CHARACTERS].sort((a, b) => b.name.length - a.name.length);

const CHARACTER_NAME_PATTERN = CHARACTERS_BY_NAME.map((c) => c.name).join("|");
const CHARACTER_LINE_START_RE = new RegExp(`^(?:${CHARACTER_NAME_PATTERN})(?:[：:]|\\s*→)`);

const CHARACTER_SECTIONS = new Set(["角色內心動機", "說話", "告知對方重要的線索"]);
const WHITE_SECTIONS = new Set(["說話", "告知對方重要的線索"]);
const TIME_HEADING = /^現在時間\s+\d{1,2}:\d{2}\s*$/;

marked.setOptions({ gfm: true, breaks: false });

function isTimeHeading(text) {
  return TIME_HEADING.test((text || "").trim());
}

function resolveCharacter(name) {
  const trimmed = (name || "").trim();
  return CHARACTERS.find((c) => c.name === trimmed) || null;
}

/** 讓 marked 把每位角色的每一行都變成獨立段落；不修改原文內容。 */
function prepareMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^### /.test(trimmed)) {
      inSection = CHARACTER_SECTIONS.has(trimmed.slice(4).trim());
      out.push(line);
      continue;
    }
    if (/^## /.test(trimmed)) {
      inSection = false;
      out.push(line);
      continue;
    }
    if (inSection && CHARACTER_LINE_START_RE.test(trimmed)) {
      if (out.length > 0 && out[out.length - 1] !== "") {
        out.push("");
      }
      out.push(line);
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}

function charTag(character) {
  const span = document.createElement("span");
  span.className = `char-tag char-tag--${character.id}`;
  span.textContent = character.name;
  return span;
}

function makeCharLine(headNodes, bodyText) {
  const row = document.createElement("p");
  row.className = "char-line";

  const head = document.createElement("span");
  head.className = "char-line-head";
  for (const node of headNodes) {
    head.appendChild(node);
  }

  const body = document.createElement("span");
  body.className = "char-line-body";
  body.textContent = bodyText;

  row.appendChild(head);
  row.appendChild(body);
  return row;
}

function buildCharacterLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  for (const speaker of CHARACTERS_BY_NAME) {
    const clueRe = new RegExp(`^${speaker.name}\\s*→\\s*(.+?)[：:]([\\s\\S]*)$`);
    const clueMatch = trimmed.match(clueRe);
    if (clueMatch) {
      const target = resolveCharacter(clueMatch[1]);
      const headNodes = [charTag(speaker), document.createTextNode(" → ")];
      if (target) {
        headNodes.push(charTag(target));
      } else {
        headNodes.push(document.createTextNode(clueMatch[1].trim()));
      }
      headNodes.push(document.createTextNode("："));
      return makeCharLine(headNodes, clueMatch[2]);
    }

    const talkRe = new RegExp(`^${speaker.name}[：:]([\\s\\S]*)$`);
    const talkMatch = trimmed.match(talkRe);
    if (talkMatch) {
      return makeCharLine([charTag(speaker), document.createTextNode("：")], talkMatch[1]);
    }
  }

  const row = document.createElement("p");
  row.className = "char-line";
  row.textContent = trimmed;
  return row;
}

function paragraphText(node) {
  return (node.textContent || "").replace(/\r/g, "").trim();
}

function colorCharacterLines(doc) {
  for (const h3 of doc.querySelectorAll("h3")) {
    const section = (h3.textContent || "").trim();
    if (!CHARACTER_SECTIONS.has(section)) {
      continue;
    }
    let node = h3.nextElementSibling;
    while (node && node.tagName !== "H2" && node.tagName !== "H3") {
      const next = node.nextElementSibling;
      if (node.tagName === "P") {
        const text = paragraphText(node);
        const row = buildCharacterLine(text);
        if (row) {
          node.parentNode.insertBefore(row, node);
        }
        node.parentNode.removeChild(node);
      }
      node = next;
    }
  }
}

function insertSectionDividers(doc) {
  for (const timeH2 of doc.querySelectorAll("h2.time-heading")) {
    const sectionH3s = [];
    let node = timeH2.nextElementSibling;
    while (node && node.tagName !== "H2") {
      if (node.tagName === "H3") {
        const title = (node.textContent || "").trim();
        if (CHARACTER_SECTIONS.has(title)) {
          sectionH3s.push(node);
        }
      }
      node = node.nextElementSibling;
    }
    for (let i = 1; i < sectionH3s.length; i += 1) {
      const divider = document.createElement("div");
      divider.className = "char-section-divider";
      divider.setAttribute("role", "separator");
      sectionH3s[i].parentNode.insertBefore(divider, sectionH3s[i]);
    }
  }
}

function wrapWhiteSectionBlocks(doc) {
  for (const h3 of doc.querySelectorAll("h3")) {
    const title = (h3.textContent || "").trim();
    if (!WHITE_SECTIONS.has(title)) {
      continue;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "char-section-block";

    let node = h3.nextElementSibling;
    while (node && node.tagName !== "H2" && node.tagName !== "H3") {
      if (node.classList?.contains("char-section-divider")) {
        break;
      }
      const next = node.nextElementSibling;
      wrapper.appendChild(node);
      node = next;
    }

    if (wrapper.childNodes.length) {
      h3.parentNode.insertBefore(wrapper, h3.nextElementSibling);
    }
  }
}

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
  document.body.classList.remove("sidebar-open");
  menuBtn.setAttribute("aria-expanded", "false");
  overlayEl.hidden = true;
}

function openSidebar() {
  sidebarEl.classList.add("open");
  document.body.classList.add("sidebar-open");
  menuBtn.setAttribute("aria-expanded", "true");
  overlayEl.hidden = false;
}

function slugTimeHeading(headingText) {
  return headingText
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function enhanceHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const h2 of doc.querySelectorAll("h2")) {
    const text = h2.textContent || "";
    if (isTimeHeading(text)) {
      const id = slugTimeHeading(text);
      if (id) {
        h2.id = id;
      }
      h2.classList.add("time-heading");
    }
  }

  const firstH2 = doc.querySelector("h2");
  if (firstH2 && /^世界日記/.test(firstH2.textContent || "")) {
    const wrapper = document.createElement("div");
    wrapper.className = "diary-block";
    const parent = firstH2.parentNode;
    let stopAt = null;
    let node = firstH2;
    while (node) {
      const next = node.nextElementSibling;
      if (node.tagName === "H2" && node !== firstH2 && isTimeHeading(node.textContent || "")) {
        stopAt = node;
        break;
      }
      wrapper.appendChild(node);
      node = next;
    }
    parent.insertBefore(wrapper, stopAt);
  }

  colorCharacterLines(doc);
  insertSectionDividers(doc);
  wrapWhiteSectionBlocks(doc);

  return doc.body.innerHTML;
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
  const md = prepareMarkdown(await res.text());
  const rawHtml = marked.parse(md);
  contentEl.innerHTML = enhanceHtml(rawHtml);
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
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });
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
