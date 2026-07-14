"use strict";

import { marked } from "https://cdn.jsdelivr.net/npm/marked@15.0.7/+esm";

const dom = {
  content: document.getElementById("content"),
  dayList: document.getElementById("day-list"),
  editionButtons: [...document.querySelectorAll("[data-edition]")],
  library: document.getElementById("library"),
  menuButton: document.getElementById("menu-button"),
  readerLabel: document.getElementById("reader-label"),
  scrim: document.getElementById("scrim"),
};

const characters = [
  { id: "misaki", name: "美咲" },
  { id: "ren", name: "渡邊蓮" },
  { id: "yui", name: "結衣" },
].sort((a, b) => b.name.length - a.name.length);

const characterSections = new Set(["角色內心動機", "說話", "告知對方重要的線索"]);
const characterNames = characters.map((character) => character.name).join("|");
const characterLineStart = new RegExp(`^(?:${characterNames})(?:[：:]|\\s*→)`);
const timeHeading = /^現在時間\s+(\d{1,2}:\d{2})\s*$/;

const state = {
  days: [],
  activeDay: null,
  edition: "novel",
  requestId: 0,
};

marked.setOptions({ gfm: true, breaks: false });

function setLibraryOpen(open) {
  dom.library.classList.toggle("is-open", open);
  dom.menuButton.setAttribute("aria-expanded", String(open));
  dom.scrim.hidden = !open;
  document.body.classList.toggle("library-open", open);
}

function selectedDayFromHash() {
  const day = Number.parseInt(location.hash.replace(/^#/, ""), 10);
  return Number.isInteger(day) && day > 0 ? day : null;
}

function setSelectedDay(day) {
  const hash = `#${day}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

function characterByName(name) {
  return characters.find((character) => character.name === name.trim()) || null;
}

function characterTag(character) {
  const tag = document.createElement("span");
  tag.className = `character-tag is-${character.id}`;
  tag.textContent = character.name;
  return tag;
}

function normalizeCharacterLines(markdown) {
  const output = [];
  let inCharacterSection = false;

  for (const line of markdown.split("\n")) {
    const text = line.trim();
    if (text.startsWith("### ")) {
      inCharacterSection = characterSections.has(text.slice(4).trim());
    } else if (text.startsWith("## ")) {
      inCharacterSection = false;
    }
    if (inCharacterSection && characterLineStart.test(text) && output.at(-1) !== "") {
      output.push("");
    }
    output.push(line);
  }
  return output.join("\n");
}

function parseCharacterLine(text) {
  const source = text.trim();
  for (const speaker of characters) {
    const directed = source.match(new RegExp(`^${speaker.name}\\s*→\\s*(.+?)[：:]([\\s\\S]*)$`));
    if (directed) {
      return {
        speaker,
        target: characterByName(directed[1]),
        targetLabel: directed[1].trim(),
        body: directed[2].trim(),
      };
    }
    const spoken = source.match(new RegExp(`^${speaker.name}[：:]([\\s\\S]*)$`));
    if (spoken) return { speaker, target: null, targetLabel: "", body: spoken[1].trim() };
  }
  return null;
}

function characterLine(parsed) {
  const row = document.createElement("p");
  row.className = "character-line";

  const label = document.createElement("span");
  label.className = "character-label";
  label.append(characterTag(parsed.speaker));
  if (parsed.targetLabel) {
    label.append(document.createTextNode(" → "));
    label.append(parsed.target ? characterTag(parsed.target) : document.createTextNode(parsed.targetLabel));
  }

  const body = document.createElement("span");
  body.className = "character-text";
  body.textContent = parsed.body;
  row.append(label, body);
  return row;
}

function renderMarkdown(markdown) {
  const template = document.createElement("template");
  template.innerHTML = marked.parse(normalizeCharacterLines(markdown));

  for (const heading of template.content.querySelectorAll("h2")) {
    const match = heading.textContent.trim().match(timeHeading);
    if (!match) continue;
    heading.classList.add("time-heading");
    heading.dataset.time = match[1];
  }

  for (const heading of template.content.querySelectorAll("h3")) {
    if (!characterSections.has(heading.textContent.trim())) continue;
    heading.classList.add("character-section-title");
    let sibling = heading.nextElementSibling;
    while (sibling && !/^H[23]$/.test(sibling.tagName)) {
      const next = sibling.nextElementSibling;
      if (sibling.tagName === "P") {
        const parsed = parseCharacterLine(sibling.textContent);
        if (parsed) sibling.replaceWith(characterLine(parsed));
      }
      sibling = next;
    }
  }

  dom.content.replaceChildren(template.content);
}

function renderDayList() {
  const fragment = document.createDocumentFragment();
  for (const day of state.days) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-button";
    button.dataset.day = String(day.day);
    button.append(
      Object.assign(document.createElement("span"), { className: "day-number", textContent: `DAY ${day.day}` }),
      Object.assign(document.createElement("span"), { className: "day-title", textContent: day.title })
    );
    button.addEventListener("click", () => {
      loadDay(day.day);
      setLibraryOpen(false);
    });
    fragment.append(button);
  }
  dom.dayList.replaceChildren(fragment);
}

function highlightDay(day) {
  for (const button of dom.dayList.querySelectorAll(".day-button")) {
    button.setAttribute("aria-current", Number(button.dataset.day) === day ? "page" : "false");
  }
}

function showMessage(message, isError = false) {
  const paragraph = document.createElement("p");
  paragraph.className = isError ? "error-message" : "loading-message";
  paragraph.textContent = message;
  dom.content.replaceChildren(paragraph);
}

function editionLabel() {
  return state.edition === "original" ? "原文版" : "小說版";
}

function updateEditionButtons(day = null) {
  for (const button of dom.editionButtons) {
    button.disabled = button.dataset.edition === "novel" && day !== null && !day.novel_file;
    button.setAttribute("aria-pressed", String(button.dataset.edition === state.edition));
  }
}

function dayFile(day) {
  if (state.edition === "original") return day.original_file || day.file;
  return day.novel_file || day.file;
}

async function loadDay(dayNumber) {
  const day = state.days.find((item) => item.day === dayNumber);
  if (!day) return;

  const requestId = ++state.requestId;
  state.activeDay = day.day;
  if (state.edition === "novel" && !day.novel_file) state.edition = "original";
  updateEditionButtons(day);
  setSelectedDay(day.day);
  highlightDay(day.day);
  dom.readerLabel.textContent = `${editionLabel()} ${day.day} · ${day.title}`;
  document.title = `${day.title}｜${editionLabel()}｜TTC 世界日記`;
  showMessage("正在翻開這一天…");

  try {
    const file = dayFile(day);
    const response = await fetch(file);
    if (!response.ok) throw new Error(`無法載入 ${file}`);
    const markdown = await response.text();
    if (requestId !== state.requestId) return;
    renderMarkdown(markdown);
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch (error) {
    if (requestId !== state.requestId) return;
    showMessage(error.message || "這篇日記暫時無法讀取。", true);
  }
}

async function init() {
  dom.menuButton.addEventListener("click", () => setLibraryOpen(!dom.library.classList.contains("is-open")));
  dom.scrim.addEventListener("click", () => setLibraryOpen(false));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLibraryOpen(false);
  });
  window.addEventListener("hashchange", () => {
    const requested = selectedDayFromHash();
    if (requested) loadDay(requested);
  });
  for (const button of dom.editionButtons) {
    button.addEventListener("click", () => {
      const edition = button.dataset.edition;
      if (edition === state.edition || !["novel", "original"].includes(edition)) return;
      state.edition = edition;
      updateEditionButtons();
      if (state.activeDay !== null) loadDay(state.activeDay);
    });
  }
  updateEditionButtons();

  try {
    const response = await fetch("manifest.json");
    if (!response.ok) throw new Error("找不到世界日記目錄。");
    const manifest = await response.json();
    state.days = Array.isArray(manifest.days) ? manifest.days : [];
    if (!state.days.length) throw new Error("目前沒有可以閱讀的日記。");
    renderDayList();
    const requested = selectedDayFromHash();
    await loadDay(state.days.some((day) => day.day === requested) ? requested : state.days[0].day);
  } catch (error) {
    dom.readerLabel.textContent = "世界日記";
    showMessage(error.message || "世界日記載入失敗。", true);
  }
}

init();
