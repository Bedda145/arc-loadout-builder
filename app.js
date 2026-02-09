// ARC BUILDER - app.js (fix pack v4)
// All fixes from v3 + mk3 patch + attachments v1 retained.
// Fix pack v4 changes:
//  #1  Shield undo now resolves by ID (not raw object)
//  #3  Shield slot supports drag-and-drop
//  #4  No double render on startup with URL param
//  #5  resizeContainers extracted; no double changeSuit in load/preset/undo
//  #6  Preset names XSS-safe (DOM creation, no innerHTML)
//  #7  Share link payload validated after decode
//  #8  O(1) lookups via Maps
//  #9  Redundant normalizeWeaponAttsInState calls removed
//  #10 addItem split into addItemToSlot / autoAddItem (wrapper kept)
//  #11 Centralized commitState()
//  #12 resolveShield() safety net in commitState
//  #13 Toast when items lost on suit switch
//  #15 Shield value counted in total value
//  #16 Unknown magType handled explicitly
//  #17 Unused getHoverText / escapeAttr removed
//  #19 return showToast() patterns fixed
//  #20 Hold timer DOM guard + pointercancel

console.log("ARC Builder Loaded (fix pack v4)");
window.onerror = (m, s, l, c, e) => console.error("JS Error:", m, "at", (l || "?") + ":" + (c || "?"), e || "");

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// 0B) RICH HOVER TOOLTIP
// ------------------------------------------------------------
const TT = {
  wrap: null,
  card: null,
  visible: false,
  raf: 0,
  x: 0,
  y: 0,
};

function ensureRichTooltip() {
  if (TT.wrap) return;

  if (!document.getElementById("arc-tt-style")) {
    const style = document.createElement("style");
    style.id = "arc-tt-style";
    style.textContent = `
      #arc-tt {
        position: fixed;
        z-index: 200000;
        left: 0;
        top: 0;
        width: 1px;
        height: 1px;
        pointer-events: none;
        display: none;
      }
      #arc-tt.is-visible { display: block; }

      .arc-tt-card{
        width: 360px;
        max-width: min(360px, calc(100vw - 24px));
        background: linear-gradient(180deg, rgba(32,36,43,.96), rgba(22,25,30,.96));
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 18px;
        box-shadow: 0 24px 80px rgba(0,0,0,.55);
        overflow: hidden;
        color: rgba(255,255,255,.92);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      .arc-tt-pad{ padding: 14px; }

      .arc-tt-chips{ display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
      .arc-tt-chip{
        font-size: 11px;
        font-weight: 900;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.25);
        line-height: 1;
        letter-spacing: .3px;
        text-transform: uppercase;
      }
      .arc-tt-chip.cat{ border-color: rgba(102,252,241,.25); color: rgba(102,252,241,.95); }
      .arc-tt-chip.rarity-common{ color: rgba(255,255,255,.60); border-color: rgba(255,255,255,.10); }
      .arc-tt-chip.rarity-uncommon{ color: rgba(120,255,130,.90); border-color: rgba(120,255,130,.20); }
      .arc-tt-chip.rarity-rare{ color: rgba(93,152,255,.90); border-color: rgba(93,152,255,.20); }
      .arc-tt-chip.rarity-epic{ color: rgba(184,108,255,.90); border-color: rgba(184,108,255,.20); }
      .arc-tt-chip.rarity-legendary{ color: rgba(255,215,0,.90); border-color: rgba(255,215,0,.20); }

      .arc-tt-title{
        margin-top: 10px;
        font-size: 18px;
        font-weight: 950;
        letter-spacing: .6px;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .arc-tt-desc{
        margin-top: 6px;
        font-size: 12px;
        color: rgba(255,255,255,.65);
        line-height: 1.35;
      }

      .arc-tt-divider{ height:1px; background: rgba(255,255,255,.08); margin: 12px 0; }

      .arc-tt-stats{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px 10px;
        font-size: 12px;
      }
      .arc-tt-k{ color: rgba(255,255,255,.60); font-weight: 700; }
      .arc-tt-v{ color: rgba(255,255,255,.92); font-weight: 900; text-align:right; }

      .arc-tt-subtitle{
        font-size: 11px;
        color: rgba(255,255,255,.60);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .35px;
        margin-bottom: 8px;
      }

      .arc-tt-atts{
        display: grid;
        gap: 8px;
      }
      .arc-tt-att-row{
        display: grid;
        grid-template-columns: 24px 1fr;
        gap: 10px;
        align-items: center;
        padding: 8px 10px;
        background: rgba(0,0,0,.22);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
      }
      .arc-tt-att-icon{
        width: 24px;
        height: 24px;
        object-fit: contain;
        opacity: .95;
        filter: drop-shadow(0 6px 12px rgba(0,0,0,.45));
      }
      .arc-tt-att-text{ min-width:0; }
      .arc-tt-att-name{
        font-size: 12px;
        font-weight: 900;
        color: rgba(255,255,255,.90);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .arc-tt-att-sub{
        font-size: 11px;
        color: rgba(255,255,255,.55);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 2px;
      }

      .arc-r-common{ box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
      .arc-r-uncommon{ box-shadow: inset 0 0 0 1px rgba(120,255,130,.12); }
      .arc-r-rare{ box-shadow: inset 0 0 0 1px rgba(90,170,255,.14); }
      .arc-r-epic{ box-shadow: inset 0 0 0 1px rgba(190,90,255,.14); }
      .arc-r-legendary{ box-shadow: inset 0 0 0 1px rgba(255,210,90,.16); }
    `;
    document.head.appendChild(style);
  }

  const wrap = document.createElement("div");
  wrap.id = "arc-tt";
  wrap.innerHTML = `<div class="arc-tt-card" id="arc-tt-card"></div>`;
  document.body.appendChild(wrap);

  TT.wrap = wrap;
  TT.card = wrap.querySelector("#arc-tt-card");

  window.addEventListener("scroll", hideRichTooltip, true);
  document.addEventListener("dragstart", hideRichTooltip, true);
  window.addEventListener("blur", hideRichTooltip, true);
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rarityLabel(r) {
  const v = String(r || "").toLowerCase();
  if (!v) return "Common";
  return v[0].toUpperCase() + v.slice(1);
}
function rarityClass(r) {
  const v = String(r || "").toLowerCase();
  if (!v) return "arc-r-common";
  return `arc-r-${v}`;
}

function categoryLabel(item) {
  const c = (item?.category || "").toLowerCase();
  const t = (item?.type || "").toLowerCase();

  if (c === "equipment") return "Weapon";
  if (c === "shield") return "Shield";
  if (c === "ammo") return "Ammo";
  if (c === "quick") {
    if (t.includes("grenade") || t.includes("explosive")) return "Grenade";
    if (t.includes("gadget") || t.includes("utility")) return "Gadget";
    if (t.includes("trap")) return "Trap";
    if (t.includes("regen")) return "Recharger";
    if (t.includes("healing")) return "Healing";
    return "Item";
  }
  if (c === "integrated") return "Integrated";
  if (c === "trinket") return "Trinket";
  return "Item";
}

function autoDescription(item) {
  if (!item) return "";
  if (item.desc) return item.desc;

  const c = (item.category || "").toLowerCase();
  const t = item.type || "";

  if (c === "equipment") return `${t}. Right-click the weapon slot to edit attachments.`;
  if (c === "shield") return `Defense gear. Must match your suit's allowed shield tier.`;
  if (c === "ammo") return `Ammo stack. Drag into Quick Use or Backpack.`;
  if (c === "quick") return `${t}. Use in Quick Use slots or store in Backpack.`;
  if (c === "integrated") return `Built-in gear (locked to specific augments).`;
  if (c === "trinket") return `Valuable loot. Sell for credits or use in quests/crafting.`;
  return item.crafting ? `Crafting: ${item.crafting}` : "";
}

function formatMoney(v) {
  return `$${Number(v || 0).toLocaleString()}`;
}
function formatKg(v) {
  return `${Number(v || 0).toFixed(2)} kg`;
}

const ATT_EMPTY_ICON =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="7" fill="#000" fill-opacity="0.18" stroke="#fff" stroke-opacity="0.10"/>
      <path d="M8 12h8" stroke="#fff" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round"/>
    </svg>`.trim()
  );

function buildItemTooltipHTML(item, slotData) {
  if (!item) return "";

  const cat = categoryLabel(item);
  const rar = rarityLabel(item.rarity);
  const desc = autoDescription(item);
  const qty = slotData?.qty ? `x${slotData.qty}` : "";

  const weaponSlotDefs = item.category === "equipment" ? getWeaponAttachmentSlotDefs(item) : [];
  const hasAtts = item.category === "equipment" && !!slotData?.atts && weaponSlotDefs.length > 0;

  let statsRows = `
    <div class="arc-tt-k">Type</div><div class="arc-tt-v">${escHtml(item.type || "-")}</div>
    <div class="arc-tt-k">Weight</div><div class="arc-tt-v">${escHtml(formatKg(item.weight))}</div>
    <div class="arc-tt-k">Value</div><div class="arc-tt-v">${escHtml(formatMoney(item.value))}</div>
  `;

  if ((item.stackMax || 1) > 1) {
    statsRows += `<div class="arc-tt-k">Stack Max</div><div class="arc-tt-v">${escHtml(item.stackMax)}</div>`;
  }
  if (qty) {
    statsRows += `<div class="arc-tt-k">In Slot</div><div class="arc-tt-v">${escHtml(qty)}</div>`;
  }
  if (item.crafting) {
    statsRows += `<div class="arc-tt-k">Crafting</div><div class="arc-tt-v">${escHtml(item.crafting)}</div>`;
  }

  let attsHtml = "";

  if (hasAtts) {
    let rows = "";
    for (const s of weaponSlotDefs) {
      const aid = slotData.atts?.[s.key];
      const a = aid ? getAttachmentById(aid) : null;

      rows += `
        <div class="arc-tt-att-row">
          <img class="arc-tt-att-icon"
            src="${escHtml(getAttIconSrc(s.key, aid, item))}"
            style="opacity:${aid ? 1 : 0.35};"
            onerror="this.src='${ATT_EMPTY_ICON}'; this.style.opacity='0.25';">
          <div class="arc-tt-att-text">
            <div class="arc-tt-att-name">${escHtml(s.label)}: ${escHtml(a ? a.name : "None")}</div>
            <div class="arc-tt-att-sub">${escHtml(a ? (a.effect || a.crafting || "") : "")}</div>
          </div>
        </div>
      `;
    }

    attsHtml = `
      <div class="arc-tt-divider"></div>
      <div class="arc-tt-pad" style="padding-top:0;">
        <div class="arc-tt-subtitle">Attachments</div>
        <div class="arc-tt-atts">${rows}</div>
      </div>
    `;
  }

  return `
    <div class="arc-tt-pad ${rarityClass(item.rarity)}">
      <div class="arc-tt-chips">
        <span class="arc-tt-chip cat">${escHtml(cat)}</span>
        <span class="arc-tt-chip rarity-${(item.rarity || 'common').toLowerCase()}">${escHtml(rar)}</span>
      </div>
      <div class="arc-tt-title">${escHtml(item.name || "Item")}</div>
      <div class="arc-tt-desc">${escHtml(desc)}</div>
      <div class="arc-tt-divider"></div>
      <div class="arc-tt-stats">${statsRows}</div>
    </div>
    ${attsHtml}
  `;
}

function suitDescription(suit) {
  if (!suit) return "";
  const n = (suit.name || "").toLowerCase();
  if (n.includes("combat mk.1")) return "Basic combat augment. Supports stronger shields, but with limited backpack capacity and Quick Use slots.";
  if (n.includes("looting mk.1")) return "Basic looting augment. Good backpack space and low self weight.";
  if (n.includes("combat mk.2")) return "Combat-focused augment with a dedicated grenade slot.";
  if (n.includes("looting mk.2")) return "Looting-focused augment with trinket slots for extra utility.";
  if (n.includes("aggressive")) return "High weight limit with extra grenade capacity.";
  if (n.includes("flanking")) return "Mobile combat augment with extra quick slots and utility capacity.";
  if (n.includes("cautious")) return "Looting augment with a locked integrated binocular slot.";
  if (n.includes("safekeeper")) return "Looting augment with extra trinket capacity and strong shield support.";
  return "Augment stats and slot layout.";
}

function buildSuitTooltipHTML(suit) {
  if (!suit) return "";
  const st = suit.stats || {};

  const n = (suit.name || "").toLowerCase();
  let suitRarity = "common";
  if (n.includes("mk.3") || n.includes("mk3")) suitRarity = "epic";
  else if (n.includes("mk.2") || n.includes("mk2")) suitRarity = "rare";
  else if (n.includes("mk.1") || n.includes("mk1")) suitRarity = "uncommon";

  const statsRows = `
    <div class="arc-tt-k">Backpack Slots</div><div class="arc-tt-v">${escHtml(st.backpackSlots ?? "-")}</div>
    <div class="arc-tt-k">Quick Use Slots</div><div class="arc-tt-v">${escHtml(st.quickSlots ?? "-")}</div>
    <div class="arc-tt-k">Safe Pocket Slots</div><div class="arc-tt-v">${escHtml(st.safeSlots ?? "-")}</div>
    <div class="arc-tt-k">Weapon Slots</div><div class="arc-tt-v">2</div>
    <div class="arc-tt-k">Weight Limit</div><div class="arc-tt-v">${escHtml(st.maxWeight ?? "-")}</div>
  `;

  const allowed = Array.isArray(st.allowedShields) ? st.allowedShields.join(", ") : "-";
  const aug = (st.augmentedSlots || 0) > 0 ? `${st.augmentedLabel || "AUGMENTED"}: ${st.augmentedSlots}` : "None";

  return `
    <div class="arc-tt-pad arc-r-${suitRarity}">
      <div class="arc-tt-chips">
        <span class="arc-tt-chip cat">Augment</span>
        <span class="arc-tt-chip rarity-${suitRarity}">${escHtml(rarityLabel(suitRarity))}</span>
      </div>
      <div class="arc-tt-title">${escHtml(suit.name || "Augment")}</div>
      <div class="arc-tt-desc">${escHtml(suitDescription(suit))}</div>
      <div class="arc-tt-divider"></div>
      <div class="arc-tt-stats">${statsRows}</div>
      <div class="arc-tt-divider"></div>
      <div class="arc-tt-stats">
        <div class="arc-tt-k">Shields</div><div class="arc-tt-v">${escHtml(allowed)}</div>
        <div class="arc-tt-k">Augmented</div><div class="arc-tt-v">${escHtml(aug)}</div>
      </div>
    </div>
  `;
}

function showRichTooltip(html, x, y) {
  ensureRichTooltip();
  if (!TT.card) return;

  TT.card.innerHTML = html;
  TT.wrap.classList.add("is-visible");
  TT.visible = true;

  positionRichTooltip(x, y);
}

function hideRichTooltip() {
  if (!TT.wrap) return;
  TT.wrap.classList.remove("is-visible");
  TT.visible = false;
}

function positionRichTooltip(x, y) {
  if (!TT.wrap || !TT.card) return;

  const pad = 14;
  const ox = 16;
  const oy = 16;

  const rect = TT.card.getBoundingClientRect();
  const w = rect.width || 360;
  const h = rect.height || 240;

  let left = x + ox;
  let top = y + oy;

  const maxLeft = window.innerWidth - w - pad;
  const maxTop = window.innerHeight - h - pad;

  if (left > maxLeft) left = Math.max(pad, x - w - ox);
  if (top > maxTop) top = Math.max(pad, y - h - oy);

  TT.wrap.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function ttScheduleMove() {
  if (TT.raf) return;
  TT.raf = requestAnimationFrame(() => {
    TT.raf = 0;
    if (TT.visible) positionRichTooltip(TT.x, TT.y);
  });
}

function bindTooltipForItem(el, itemId) {
  if (!el) return;
  ensureRichTooltip();
  el.title = "";

  el.dataset.ttType = "item";
  el.dataset.ttItem = itemId;

  if (el._ttBound) return;
  el._ttBound = true;

  el.addEventListener("pointerenter", (ev) => {
    const id = el.dataset.ttItem;
    const item = getItemById(id);
    if (!item) return;
    TT.x = ev.clientX;
    TT.y = ev.clientY;
    showRichTooltip(buildItemTooltipHTML(item, null), TT.x, TT.y);
  });
  el.addEventListener("pointermove", (ev) => {
    TT.x = ev.clientX;
    TT.y = ev.clientY;
    ttScheduleMove();
  });
  el.addEventListener("pointerleave", () => hideRichTooltip());
}

function bindTooltipForSlot(el, cat, idx) {
  if (!el) return;
  ensureRichTooltip();
  el.title = "";

  el.dataset.ttType = "slot";
  el.dataset.ttCat = cat;
  el.dataset.ttIdx = String(idx);

  if (el._ttBound) return;
  el._ttBound = true;

  el.addEventListener("pointerenter", (ev) => {
    const c = el.dataset.ttCat;
    const i = parseInt(el.dataset.ttIdx || "0", 10);
    const cont = getContainer(c);
    const slotData = cont ? cont[i] : null;
    if (!slotData) return;

    const item = getItemById(slotData.id);
    if (!item) return;

    TT.x = ev.clientX;
    TT.y = ev.clientY;
    showRichTooltip(buildItemTooltipHTML(item, slotData), TT.x, TT.y);
  });
  el.addEventListener("pointermove", (ev) => {
    TT.x = ev.clientX;
    TT.y = ev.clientY;
    ttScheduleMove();
  });
  el.addEventListener("pointerleave", () => hideRichTooltip());
}

function bindTooltipForSuitIcon(el) {
  if (!el) return;
  ensureRichTooltip();
  el.title = "";

  if (el._ttSuitBound) return;
  el._ttSuitBound = true;

  el.addEventListener("pointerenter", (ev) => {
    TT.x = ev.clientX;
    TT.y = ev.clientY;
    showRichTooltip(buildSuitTooltipHTML(gameState.currentSuit), TT.x, TT.y);
  });
  el.addEventListener("pointermove", (ev) => {
    TT.x = ev.clientX;
    TT.y = ev.clientY;
    ttScheduleMove();
  });
  el.addEventListener("pointerleave", () => hideRichTooltip());
}



// ------------------------------------------------------------
// 0C) MODAL STYLES
// ------------------------------------------------------------
function ensureModalStyles() {
  if (document.getElementById("arc-modal-style")) return;

  const style = document.createElement("style");
  style.id = "arc-modal-style";
  style.textContent = `
    .arc-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(0,0,0,.60);
      backdrop-filter: blur(8px);
      display: none;
    }
    .arc-modal-backdrop.is-open { display: flex; align-items: flex-start; justify-content: center; padding-top: 8vh; }

    .arc-modal-card {
      width: 100%;
      background: linear-gradient(180deg, rgba(32,36,43,.97), rgba(20,22,28,.97));
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04);
      color: rgba(255,255,255,.92);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      overflow: hidden;
    }

    .arc-modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .arc-modal-icon-wrap {
      width: 48px; height: 48px;
      border-radius: 14px;
      background: rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.08);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .arc-modal-icon-wrap img {
      width: 36px; height: 36px;
      object-fit: contain;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,.4));
    }
    .arc-modal-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: .4px;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .arc-modal-sub {
      font-size: 11px;
      color: rgba(255,255,255,.45);
      margin-top: 2px;
    }
    .arc-modal-close {
      width: 36px; height: 36px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.30);
      color: rgba(255,255,255,.7);
      font-size: 16px;
      cursor: pointer;
      transition: all .15s;
      display: flex; align-items: center; justify-content: center;
      margin-left: auto;
      flex-shrink: 0;
    }
    .arc-modal-close:hover {
      background: rgba(255,80,80,.20);
      border-color: rgba(255,80,80,.30);
      color: rgba(255,120,120,.95);
    }

    .arc-modal-body { padding: 16px 18px; }
    .arc-modal-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 14px 18px;
      border-top: 1px solid rgba(255,255,255,.06);
    }

    .arc-btn {
      padding: 10px 20px;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .3px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all .15s;
      border: 1px solid transparent;
      background: transparent;
    }
    .arc-btn-ghost {
      border-color: rgba(255,255,255,.10);
      background: rgba(0,0,0,.25);
      color: rgba(255,255,255,.70);
    }
    .arc-btn-ghost:hover {
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.90);
    }
    .arc-btn-primary {
      border-color: rgba(102,252,241,.30);
      background: rgba(102,252,241,.08);
      color: rgba(102,252,241,.95);
    }
    .arc-btn-primary:hover {
      background: rgba(102,252,241,.18);
      box-shadow: 0 0 20px rgba(102,252,241,.12);
    }

    .arc-select {
      width: 100%;
      padding: 10px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.30);
      color: rgba(255,255,255,.90);
      font-size: 12px;
      font-weight: 700;
      outline: none;
      cursor: pointer;
      transition: all .15s;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 8l3-3.5' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    }
    .arc-select:hover {
      border-color: rgba(255,255,255,.18);
      background: rgba(0,0,0,.40);
    }
    .arc-select:focus {
      border-color: rgba(102,252,241,.35);
      box-shadow: 0 0 0 2px rgba(102,252,241,.08);
    }
    .arc-select option {
      background: #1a1d24;
      color: rgba(255,255,255,.90);
      padding: 8px;
    }

    .arc-range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      outline: none;
      cursor: pointer;
    }
    .arc-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #66FCF1, #45b8b0);
      border: 2px solid rgba(255,255,255,.15);
      box-shadow: 0 2px 10px rgba(102,252,241,.30);
      cursor: pointer;
      transition: box-shadow .15s;
    }
    .arc-range::-webkit-slider-thumb:hover {
      box-shadow: 0 2px 18px rgba(102,252,241,.50);
    }
    .arc-range::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #66FCF1, #45b8b0);
      border: 2px solid rgba(255,255,255,.15);
      box-shadow: 0 2px 10px rgba(102,252,241,.30);
      cursor: pointer;
    }
    .arc-range::-moz-range-track {
      height: 6px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
    }

    .arc-number {
      width: 80px;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.30);
      color: rgba(255,255,255,.92);
      font-size: 14px;
      font-weight: 800;
      text-align: center;
      outline: none;
      transition: all .15s;
    }
    .arc-number:focus {
      border-color: rgba(102,252,241,.35);
      box-shadow: 0 0 0 2px rgba(102,252,241,.08);
    }
    .arc-number::-webkit-inner-spin-button,
    .arc-number::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
      display: none;
    }
    .arc-number {
      appearance: textfield;
    }

    .arc-att-row {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      background: rgba(0,0,0,.20);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 16px;
      transition: all .15s;
    }
    .arc-att-row:hover {
      background: rgba(0,0,0,.30);
      border-color: rgba(255,255,255,.10);
    }
    .arc-att-icon {
      width: 36px; height: 36px;
      border-radius: 10px;
      background: rgba(0,0,0,.25);
      border: 1px solid rgba(255,255,255,.06);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .arc-att-icon img {
      width: 26px; height: 26px;
      object-fit: contain;
      opacity: .85;
    }
    .arc-att-label {
      font-size: 11px;
      font-weight: 800;
      color: rgba(255,255,255,.55);
      text-transform: uppercase;
      letter-spacing: .3px;
      margin-bottom: 6px;
    }
    .arc-att-hint {
      font-size: 10px;
      color: rgba(102,252,241,.55);
      margin-top: 6px;
      min-height: 14px;
      line-height: 1.3;
    }

    .arc-qty-display {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 16px 0;
    }
    .arc-qty-big {
      font-size: 36px;
      font-weight: 900;
      color: rgba(102,252,241,.95);
      font-variant-numeric: tabular-nums;
      min-width: 60px;
      text-align: center;
    }
    .arc-qty-max {
      font-size: 13px;
      color: rgba(255,255,255,.35);
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
}

// ------------------------------------------------------------
// 1) DATA
// ------------------------------------------------------------
const suitsDatabase = [
  {
    id: "aug_looting_mk1",
    name: "Looting Mk.1",
    stats: {
      selfWeight: 1.0,
      maxWeight: 50.0,
      backpackSlots: 18,
      quickSlots: 4,
      safeSlots: 1,
      allowedShields: ["Light"],
      augmentedSlots: 0,
      augmentedLabel: "AUGMENTED",
      augmentedRule: "any",
    },
    image: "assets/suit_looter.png",
  },
  {
    id: "aug_combat_mk1",
    name: "Combat Mk.1",
    stats: {
      selfWeight: 2.0,
      maxWeight: 45.0,
      backpackSlots: 16,
      quickSlots: 4,
      safeSlots: 1,
      allowedShields: ["Light", "Medium"],
      augmentedSlots: 0,
      augmentedLabel: "AUGMENTED",
      augmentedRule: "any",
    },
    image: "assets/suit_heavy.png",
  },
  {
    id: "aug_looting_mk2",
    name: "Looting Mk.2",
    stats: {
      selfWeight: 2.0,
      maxWeight: 60.0,
      backpackSlots: 22,
      quickSlots: 4,
      safeSlots: 2,
      allowedShields: ["Light"],
      augmentedSlots: 3,
      augmentedLabel: "TRINKETS",
      augmentedRule: "trinketOnly",
    },
    image: "assets/suit_looter.png",
  },
  {
    id: "aug_combat_mk2",
    name: "Combat Mk.2",
    stats: {
      selfWeight: 3.0,
      maxWeight: 55.0,
      backpackSlots: 18,
      quickSlots: 4,
      safeSlots: 1,
      allowedShields: ["Light", "Medium", "Heavy"],
      augmentedSlots: 1,
      augmentedLabel: "GRENADE",
      augmentedRule: "grenadeOnly",
    },
    image: "assets/suit_heavy.png",
  },
  {
    id: "aug_combat_mk3_aggressive",
    name: "Combat Mk.3 (Aggressive)",
    stats: {
      selfWeight: 5.0,
      maxWeight: 65.0,
      backpackSlots: 18,
      quickSlots: 4,
      safeSlots: 1,
      allowedShields: ["Light", "Medium", "Heavy"],
      augmentedSlots: 2,
      augmentedLabel: "GRENADES",
      augmentedRule: "grenadeOnly",
    },
    image: "assets/suit_combat_mk3_aggressive.png",
  },
  {
    id: "aug_combat_mk3_flanking",
    name: "Combat Mk.3 (Flanking)",
    stats: {
      selfWeight: 3.0,
      maxWeight: 60.0,
      backpackSlots: 20,
      quickSlots: 5,
      safeSlots: 2,
      allowedShields: ["Light"],
      augmentedSlots: 3,
      augmentedLabel: "UTILITY",
      augmentedRule: "utilityOnly",
    },
    image: "assets/suit_combat_mk3_flanking.png",
  },
  {
    id: "aug_looting_mk3_cautious",
    name: "Looting Mk.3 (Cautious)",
    stats: {
      selfWeight: 3.0,
      maxWeight: 70.0,
      backpackSlots: 24,
      quickSlots: 5,
      safeSlots: 2,
      allowedShields: ["Light"],
      augmentedSlots: 1,
      augmentedLabel: "INTEGRATED",
      augmentedRule: "integratedLocked",
      augmentedLockedItemId: "integrated_binocular",
    },
    image: "assets/suit_looting_mk3_cautious.png",
  },
  {
    id: "aug_looting_mk3_safekeeper",
    name: "Looting Mk.3 (Safekeeper)",
    stats: {
      selfWeight: 5.0,
      maxWeight: 65.0,
      backpackSlots: 18,
      quickSlots: 4,
      safeSlots: 1,
      allowedShields: ["Light", "Medium", "Heavy"],
      augmentedSlots: 2,
      augmentedLabel: "TRINKETS",
      augmentedRule: "trinketOnly",
    },
    image: "assets/suit_looting_mk3_safekeeper.png",
  },
    {
    id: "aug_looting_mk3_survivor",
    name: "Looting Mk.3 (Survivor)",
    stats: {
      selfWeight: 4.0,
      maxWeight: 80.0,
      backpackSlots: 20,
      quickSlots: 5,
      safeSlots: 3,
      allowedShields: ["Light", "Medium"],
      augmentedSlots: 1,
      augmentedLabel: "UTILITY",
      augmentedRule: "utilityOnly",
    },
    image: "assets/suit_looting_mk3_survivor.png",
  },
];

const itemsDatabase = [
  // WEAPONS
  { id: "wpn_anvil", name: "Anvil", category: "equipment", type: "Hand Cannon", rarity: "uncommon", weight: 5.0, value: 5000, stackMax: 1, crafting: "5x Mech Comp + 6x Simple Gun Parts", image: "assets/anvil.png", attSlots: ["muzzle", "tech"] },
  { id: "wpn_bobcat", name: "Bobcat", category: "equipment", type: "SMG", rarity: "epic", weight: 4.0, value: 9000, stackMax: 1, crafting: "1x Mag Acc + 3x Light Gun + 2x Exodus", image: "assets/bobcat.png", attSlots: ["muzzle", "underbarrel", "magazine", "stock"], magType: "light" },
  { id: "wpn_ferro", name: "Ferro Rifle", category: "equipment", type: "Battle Rifle", rarity: "common", weight: 8.0, value: 475, stackMax: 1, crafting: "5x Metal Parts + 2x Rubber Parts", image: "assets/ferro.png", attSlots: ["muzzle", "underbarrel", "stock"] },
  { id: "wpn_hullcracker", name: "Hullcracker", category: "equipment", type: "Launcher", rarity: "epic", weight: 7.0, value: 10000, stackMax: 1, crafting: "1x Mag Acc + 3x Heavy Gun", image: "assets/hullcracker.png", attSlots: ["underbarrel", "stock"] },
  { id: "wpn_osprey", name: "Osprey", category: "equipment", type: "Sniper", rarity: "epic", weight: 9.0, value: 4500, stackMax: 1, crafting: "2x Adv Mech + 3x Med Gun", image: "assets/osprey.png", attSlots: ["muzzle", "underbarrel", "magazine", "stock"], magType: "medium" },
  { id: "wpn_rattler", name: "Rattler", category: "equipment", type: "Assault Rifle", rarity: "uncommon", weight: 6.0, value: 1750, stackMax: 1, crafting: "16x Metal Parts + 12x Rubber Parts", image: "assets/rattler.png", attSlots: ["muzzle", "underbarrel", "stock"] },
  { id: "wpn_stitcher", name: "Stitcher", category: "equipment", type: "SMG", rarity: "common", weight: 5.0, value: 800, stackMax: 1, crafting: "8x Metal Parts + 4x Rubber Parts", image: "assets/stitcher.png", attSlots: ["muzzle", "underbarrel", "magazine", "stock"], magType: "light" },
  { id: "wpn_renegade", name: "Renegade", category: "equipment", type: "Heavy Lever-Action Rifle", rarity: "rare", weight: 10.0, value: 7000, stackMax: 1, crafting: "See wiki", image: "assets/renegade.png", attSlots: ["muzzle", "magazine", "stock"], magType: "medium" },
  { id: "wpn_kettle", name: "Kettle", category: "equipment", type: "Heavy Pipe Weapon", rarity: "common", weight: 7.0, value: 840, stackMax: 1, crafting: "See wiki", image: "assets/kettle.png", attSlots: ["muzzle", "underbarrel", "magazine", "stock"], magType: "light" },
  { id: "wpn_il_toro", name: "Il Toro", category: "equipment", type: "Shotgun", rarity: "uncommon", weight: 8.0, value: 5000, stackMax: 1, crafting: "5x Mech Comp + 6x Simple Gun Parts", image: "assets/il_toro.png", attSlots: ["muzzle", "underbarrel", "magazine", "stock"], magType: "shotgun" },
  { id: "wpn_venator", name: "Venator", category: "equipment", type: "Pistol", rarity: "rare", weight: 5.0, value: 7000, stackMax: 1, crafting: "2x Adv Mech Comp + 3x Med Gun Parts + 5x Magnet", image: "assets/venator.png", attSlots: ["underbarrel", "magazine"], magType: "medium" },

  // SHIELDS
  { id: "shd_light", name: "Light Shield", category: "shield", type: "Defense", tier: "Light", rarity: "uncommon", weight: 5.0, value: 640, stackMax: 1, crafting: "2x ARC Alloy + 4x Plastic Parts", image: "assets/shield_light.png" },
  { id: "shd_med", name: "Medium Shield", category: "shield", type: "Defense", tier: "Medium", rarity: "rare", weight: 7.0, value: 2000, stackMax: 1, crafting: "4x Battery + 1x ARC Circuitry", image: "assets/shield_med.png" },
  { id: "shd_heavy", name: "Heavy Shield", category: "shield", type: "Defense", tier: "Heavy", rarity: "epic", weight: 9.0, value: 5500, stackMax: 1, crafting: "1x Power Rod + 2x Voltage Converter", image: "assets/shield_heavy.png" },

  // AMMO
  { id: "ammo_light", name: "Light Ammo", category: "ammo", type: "Ammo", rarity: "common", weight: 0.01, value: 4, stackMax: 100, crafting: "Found in raid", image: "assets/ammo_light.png" },
  { id: "ammo_med", name: "Medium Ammo", category: "ammo", type: "Ammo", rarity: "common", weight: 0.025, value: 6, stackMax: 80, crafting: "Found in raid", image: "assets/ammo_med.png" },
  { id: "ammo_heavy", name: "Heavy Ammo", category: "ammo", type: "Ammo", rarity: "common", weight: 0.05, value: 12, stackMax: 40, crafting: "Found in raid", image: "assets/ammo_heavy.png" },
  { id: "ammo_shotgun", name: "Shotgun Ammo", category: "ammo", type: "Ammo", rarity: "common", weight: 0.085, value: 20, stackMax: 20, crafting: "Found in raid", image: "assets/ammo_shotgun.png" },
  { id: "ammo_launcher", name: "Launcher Ammo", category: "ammo", type: "Ammo", rarity: "rare", weight: 0.1, value: 250, stackMax: 24, crafting: "Found in raid", image: "assets/ammo_launcher.png" },
  { id: "ammo_energy", name: "Energy Clip", category: "ammo", type: "Ammo", rarity: "rare", weight: 0.3, value: 1000, stackMax: 5, crafting: "Found in raid", image: "assets/ammo_energy.png" },

  // CONSUMABLES
  { id: "med_bandage", name: "Bandage", category: "quick", type: "Healing", rarity: "common", weight: 0.15, value: 250, stackMax: 5, crafting: "5x Fabric", image: "assets/bandage.png" },
  { id: "med_herbal_bandage", name: "Herbal Bandage", category: "quick", type: "Healing", rarity: "uncommon", weight: 0.15, value: 900, stackMax: 5, crafting: "See wiki", image: "assets/herbal_bandage.png" },
  { id: "med_vita", name: "Vita Shot", category: "quick", type: "Healing", rarity: "uncommon", weight: 0.43, value: 2200, stackMax: 3, crafting: "1x Antiseptic + 1x Syringe", image: "assets/vitashot.png" },
  { id: "med_adrenaline", name: "Adrenaline Shot", category: "quick", type: "Healing", rarity: "common", weight: 0.2, value: 300, stackMax: 5, crafting: "3x Chemicals + 3x Plastic Parts", image: "assets/adrenaline.png" },
  { id: "util_shield_recharger", name: "Shield Recharger", category: "quick", type: "Utility", rarity: "uncommon", weight: 0.25, value: 800, stackMax: 5, crafting: "3x Chemicals + 3x Plastic Parts", image: "assets/shield_recharger.png" },

  // GADGETS / GRENADES
  { id: "gdt_defibrillator", name: "Defibrillator", category: "quick", type: "Gadget", rarity: "rare", weight: 1.50, value: 1000, stackMax: 3, crafting: "See wiki", image: "assets/defibrillator.png" },
  { id: "gdt_zipline", name: "Zipline", category: "quick", type: "Gadget", rarity: "uncommon", weight: 0.43, value: 1000, stackMax: 3, crafting: "1x Rope + 1x Mech Comp", image: "assets/zipline.png" },
  { id: "gdt_snaphook", name: "Snap Hook", category: "quick", type: "Gadget", rarity: "legendary", weight: 5.0, value: 14000, stackMax: 1, crafting: "2x Power Rod + 3x Rope", image: "assets/snaphook.png" },
  { id: "gdt_cloak", name: "Cloak", category: "quick", type: "Gadget", rarity: "epic", weight: 1.0, value: 15000, stackMax: 1, crafting: "2x Adv Elec + 4x Speaker Comp", image: "assets/cloak.png" },
  { id: "grn_smoke", name: "Smoke Grenade", category: "quick", type: "Grenade", rarity: "rare", weight: 0.25, value: 1000, stackMax: 5, crafting: "14x Chemicals + 1x Canister", image: "assets/smoke.png" },
  { id: "grn_frag", name: "Heavy Fuze", category: "quick", type: "Explosive", rarity: "rare", weight: 0.23, value: 1600, stackMax: 3, crafting: "1x Explosive + 2x Canister", image: "assets/grenade.png" },
  { id: "grn_lil_smoke", name: "Li'l Smoke Grenade", category: "quick", type: "Grenade", rarity: "common", weight: 0.15, value: 700, stackMax: 5, crafting: "See wiki", image: "assets/lil_smoke.png" },
  { id: "grn_snap_blast", name: "Snap Blast Grenade", category: "quick", type: "Grenade", rarity: "uncommon", weight: 0.20, value: 800, stackMax: 3, crafting: "See wiki", image: "assets/snap_blast.png" },
  { id: "grn_wolfpack", name: "Wolfpack", category: "quick", type: "Explosive", rarity: "epic", weight: 1.00, value: 5000, stackMax: 1, crafting: "See wiki", image: "assets/wolfpack.png" },
  { id: "grn_trigger_nade", name: "Trigger 'Nade", category: "quick", type: "Grenade", rarity: "rare", weight: 0.4, value: 1000, stackMax: 3, crafting: "2x Crude Explosives + 1x Processor", image: "assets/trigger_nade.png" },
  { id: "util_barricade_kit", name: "Barricade Kit", category: "quick", type: "Utility", rarity: "uncommon", weight: 0.4, value: 640, stackMax: 3, crafting: "1x Mechanical Components", image: "assets/barricade_kit.png" },
  { id: "grn_blaze_grenade", name: "Blaze Grenade", category: "quick", type: "Grenade", rarity: "rare", weight: 0.2, value: 1600, stackMax: 5, crafting: "1x Explosive Compound + 2x Oil", image: "assets/blaze_grenade.png" },
  { id: "trap_explosive_mine", name: "Explosive Mine", category: "quick", type: "Trap", rarity: "rare", weight: 0.4, value: 1500, stackMax: 3, crafting: "1x Explosive Compound + 1x Sensors", image: "assets/explosive_mine.png" },
  { id: "trap_jolt_mine", name: "Jolt Mine", category: "quick", type: "Trap", rarity: "rare", weight: 0.2, value: 850, stackMax: 3, crafting: "1x Electrical Comp + 1x Battery", image: "assets/jolt_mine.png" },
  { id: "util_surge_recharger", name: "Surge Shield Recharger", category: "quick", type: "Regen", rarity: "rare", weight: 0.2, value: 1200, stackMax: 5, crafting: "2x Electrical Comp + 1x Adv ARC Powercell", image: "assets/surge_recharger.png" },

  // INTEGRATED
  { id: "integrated_binocular", name: "Integrated Binoculars", category: "integrated", type: "Integrated", rarity: "epic", weight: 0.0, value: 0, stackMax: 1, crafting: "Built-in (Looting Mk.3 Cautious)", image: "assets/integrated_binocular.png", hiddenFromPool: true },

  // TRINKETS (add your trinket items here when ready)
];

// ------------------------------------------------------------
// 1B) WEAPON ATTACHMENTS
// ------------------------------------------------------------
const WEAPON_ATTACHMENT_SLOTS = [
  { key: "muzzle", label: "Muzzle" },
  { key: "underbarrel", label: "Underbarrel" },
  { key: "stock", label: "Stock" },
  { key: "magazine", label: "Magazine" },
  { key: "tech", label: "Tech Mod" },
];

function getWeaponAttachmentSlotDefs(weaponItem) {
  const keys = Array.isArray(weaponItem?.attSlots) && weaponItem.attSlots.length
    ? weaponItem.attSlots
    : WEAPON_ATTACHMENT_SLOTS.map((s) => s.key);

  return WEAPON_ATTACHMENT_SLOTS.filter((s) => keys.includes(s.key));
}

function defaultWeaponAttsForItem(weaponItem) {
  const atts = {};
  for (const s of getWeaponAttachmentSlotDefs(weaponItem)) atts[s.key] = null;
  return atts;
}

function ensureWeaponAtts(slotData) {
  if (!slotData) return slotData;

  const weapon = getItemById(slotData.id);
  if (!weapon || weapon.category !== "equipment") return slotData;

  const defs = getWeaponAttachmentSlotDefs(weapon);
  const allowedKeys = defs.map((d) => d.key);

  if (!slotData.atts || typeof slotData.atts !== "object") slotData.atts = {};

  for (const k of Object.keys(slotData.atts)) {
    if (!allowedKeys.includes(k)) delete slotData.atts[k];
  }

  for (const s of defs) {
    if (slotData.atts[s.key] === undefined) slotData.atts[s.key] = null;
  }

  return slotData;
}

const ATT_PLACEHOLDER_BY_SLOT = {
  muzzle: "att_compensator_1",
  underbarrel: "att_angled_grip_1",
  stock: "att_stable_stock_1",
  tech: "att_anvil_splitter",
};

// FIX #16: explicit magType handling
function placeholderForSlot(slotKey, weaponItem) {
  if (slotKey === "magazine") {
    const mt = (weaponItem?.magType || "").toLowerCase();
    if (mt === "medium") return "att_ext_med_mag_1";
    if (mt === "shotgun") return "att_ext_shotgun_mag_1";
    if (mt === "light" || mt === "") return "att_ext_light_mag_1";
    return "att_ext_light_mag_1"; // fallback
  }
  return ATT_PLACEHOLDER_BY_SLOT[slotKey] || null;
}

function getAttIconSrc(slotKey, attId, weaponItem) {
  if (attId) return getAttachmentById(attId)?.image || ATT_EMPTY_ICON;
  const placeholderId = placeholderForSlot(slotKey, weaponItem);
  return getAttachmentById(placeholderId)?.image || ATT_EMPTY_ICON;
}

const attachmentsDatabase = [
  // Underbarrel
  { id: "att_angled_grip_1", name: "Angled Grip I", slot: "underbarrel", effect: "20% reduced horizontal recoil", crafting: "Plastic Parts x6 + Duct Tape x1", image: "assets/att_angled_grip_1.png" },
  { id: "att_angled_grip_2", name: "Angled Grip II", slot: "underbarrel", effect: "30% reduced horizontal recoil", crafting: "Mechanical Components x2 + Duct Tape x3", image: "assets/att_angled_grip_2.png" },
  { id: "att_angled_grip_3", name: "Angled Grip III", slot: "underbarrel", effect: "40% reduced horizontal recoil, 30% reduced ADS speed", crafting: "Mod Components x2 + Duct Tape x5", image: "assets/att_angled_grip_3.png" },

  { id: "att_vertical_grip_1", name: "Vertical Grip I", slot: "underbarrel", effect: "20% reduced vertical recoil control", crafting: "Plastic Parts x6 + Duct Tape x1", image: "assets/att_vertical_grip_1.png" },
  { id: "att_vertical_grip_2", name: "Vertical Grip II", slot: "underbarrel", effect: "30% reduced vertical recoil", crafting: "Mechanical Components x2 + Duct Tape x3", image: "assets/att_vertical_grip_2.png" },
  { id: "att_vertical_grip_3", name: "Vertical Grip III", slot: "underbarrel", effect: "40% reduced vertical recoil, 30% reduced ADS speed", crafting: "Mod Components x2 + Duct Tape x5", image: "assets/att_vertical_grip_3.png" },

  { id: "att_horizontal_grip", name: "Horizontal Grip", slot: "underbarrel", effect: "30% reduced horizontal recoil, 30% reduced vertical recoil, 30% reduced ADS speed", crafting: "See wiki", image: "assets/att_horizontal_grip.png" },

  // Muzzle
  { id: "att_compensator_1", name: "Compensator I", slot: "muzzle", effect: "20% reduced per-shot dispersion, 10% reduced max shot dispersion", crafting: "Metal Parts x6 + Wires x1", image: "assets/att_compensator_1.png" },
  { id: "att_compensator_2", name: "Compensator II", slot: "muzzle", effect: "40% reduced per-shot dispersion, 20% reduced max shot dispersion", crafting: "Mechanical Components x2 + Wires x4", image: "assets/att_compensator_2.png" },
  { id: "att_compensator_3", name: "Compensator III", slot: "muzzle", effect: "60% reduced per-shot dispersion, 30% reduced max shot dispersion, +durability burn", crafting: "Mod Components x2 + Wires x8", image: "assets/att_compensator_3.png" },

  { id: "att_muzzle_brake_1", name: "Muzzle Brake I", slot: "muzzle", effect: "15% reduced horizontal recoil, 15% reduced vertical recoil", crafting: "Metal Parts x6 + Wires x1", image: "assets/att_muzzle_brake_1.png" },
  { id: "att_muzzle_brake_2", name: "Muzzle Brake II", slot: "muzzle", effect: "20% reduced horizontal recoil, 20% reduced vertical recoil", crafting: "Mechanical Components x2 + Wires x4", image: "assets/att_muzzle_brake_2.png" },
  { id: "att_muzzle_brake_3", name: "Muzzle Brake III", slot: "muzzle", effect: "25% reduced recoil control, +durability burn", crafting: "Mod Components x2 + Wires x8", image: "assets/att_muzzle_brake_3.png" },

  { id: "att_silencer_1", name: "Silencer I", slot: "muzzle", effect: "20% reduced noise", crafting: "Mechanical Components x2 + Wires x4", image: "assets/att_silencer_1.png" },
  { id: "att_silencer_2", name: "Silencer II", slot: "muzzle", effect: "40% reduced noise", crafting: "Mod Components x2 + Wires x8", image: "assets/att_silencer_2.png" },
  { id: "att_silencer_3", name: "Silencer III", slot: "muzzle", effect: "60% reduced noise, +durability burn", crafting: "See wiki", image: "assets/att_silencer_3.png" },

  { id: "att_extended_barrel", name: "Extended Barrel", slot: "muzzle", effect: "+bullet velocity, +vertical recoil", crafting: "Mod Components x2 + Wires x8", image: "assets/att_extended_barrel.png" },

  { id: "att_shotgun_choke_1", name: "Shotgun Choke I", slot: "muzzle", effect: "10% reduced base dispersion", crafting: "Metal Parts x6 + Wires x1", image: "assets/att_shotgun_choke_1.png" },
  { id: "att_shotgun_choke_2", name: "Shotgun Choke II", slot: "muzzle", effect: "20% reduced base dispersion", crafting: "Mechanical Components x2 + Wires x4", image: "assets/att_shotgun_choke_2.png" },
  { id: "att_shotgun_choke_3", name: "Shotgun Choke III", slot: "muzzle", effect: "30% reduced base dispersion, +durability burn", crafting: "Mod Components x2 + Wires x8", image: "assets/att_shotgun_choke_3.png" },

  { id: "att_shotgun_silencer", name: "Shotgun Silencer", slot: "muzzle", effect: "50% reduced noise", crafting: "Mod Components x2 + Wires x8", image: "assets/att_shotgun_silencer.png" },

  // Stock
  { id: "att_stable_stock_1", name: "Stable Stock I", slot: "stock", effect: "20% reduced recoil recovery duration, 20% reduced dispersion recovery time", crafting: "Rubber Parts x6 + Duct Tape x1", image: "assets/att_stable_stock_1.png" },
  { id: "att_stable_stock_2", name: "Stable Stock II", slot: "stock", effect: "35% reduced recovery duration/time", crafting: "Mechanical Components x2 + Duct Tape x3", image: "assets/att_stable_stock_2.png" },
  { id: "att_stable_stock_3", name: "Stable Stock III", slot: "stock", effect: "50% reduced recovery duration/time, +equip/unequip time", crafting: "Mod Components x2 + Duct Tape x5", image: "assets/att_stable_stock_3.png" },

  { id: "att_lightweight_stock", name: "Lightweight Stock", slot: "stock", effect: "200% increased ADS speed, faster equip/unequip, +recoil", crafting: "Mod Components x2 + Duct Tape x5", image: "assets/att_lightweight_stock.png" },
  { id: "att_padded_stock", name: "Padded Stock", slot: "stock", effect: "Reduced recoil/dispersion, slower equip/unequip, reduced ADS", crafting: "Mod Components x2 + Duct Tape x5", image: "assets/att_padded_stock.png" },
  { id: "att_kinetic_converter", name: "Kinetic Converter", slot: "stock", effect: "+fire rate, +recoil", crafting: "See wiki", image: "assets/att_kinetic_converter.png" },

  // Magazine
  { id: "att_ext_light_mag_1", name: "Extended Light Mag I", slot: "magazine", effect: "+5 magazine size", crafting: "Plastic Parts x6 + Steel Spring x1", image: "assets/att_ext_light_mag_1.png" },
  { id: "att_ext_light_mag_2", name: "Extended Light Mag II", slot: "magazine", effect: "+10 magazine size", crafting: "Mechanical Components x2 + Steel Spring x3", image: "assets/att_ext_light_mag_2.png" },
  { id: "att_ext_light_mag_3", name: "Extended Light Mag III", slot: "magazine", effect: "+15 magazine size", crafting: "Mod Components x2 + Steel Spring x5", image: "assets/att_ext_light_mag_3.png" },

  { id: "att_ext_med_mag_1", name: "Extended Medium Mag I", slot: "magazine", effect: "+4 magazine size", crafting: "Plastic Parts x6 + Steel Spring x1", image: "assets/att_ext_med_mag_1.png" },
  { id: "att_ext_med_mag_2", name: "Extended Medium Mag II", slot: "magazine", effect: "+8 magazine size", crafting: "Mechanical Components x2 + Steel Spring x3", image: "assets/att_ext_med_mag_2.png" },
  { id: "att_ext_med_mag_3", name: "Extended Medium Mag III", slot: "magazine", effect: "+12 magazine size", crafting: "Mod Components x2 + Steel Spring x5", image: "assets/att_ext_med_mag_3.png" },

  { id: "att_ext_shotgun_mag_1", name: "Extended Shotgun Mag I", slot: "magazine", effect: "+2 magazine size", crafting: "Plastic Parts x6 + Steel Spring x1", image: "assets/att_ext_shotgun_mag_1.png" },
  { id: "att_ext_shotgun_mag_2", name: "Extended Shotgun Mag II", slot: "magazine", effect: "+4 magazine size", crafting: "Mechanical Components x2 + Steel Spring x3", image: "assets/att_ext_shotgun_mag_2.png" },
  { id: "att_ext_shotgun_mag_3", name: "Extended Shotgun Mag III", slot: "magazine", effect: "+6 magazine size", crafting: "Mod Components x2 + Steel Spring x5", image: "assets/att_ext_shotgun_mag_3.png" },

  // Tech mod
  { id: "att_anvil_splitter", name: "Anvil Splitter", slot: "tech", effect: "+3 projectiles per shot, -projectile damage", crafting: "See wiki", image: "assets/att_anvil_splitter.png" },
];

// FIX #8: O(1) lookup maps
const _itemsMap = new Map(itemsDatabase.map((i) => [i.id, i]));
const _suitsMap = new Map(suitsDatabase.map((s) => [s.id, s]));
const _attsMap = new Map(attachmentsDatabase.map((a) => [a.id, a]));

function getItemById(id) {
  return _itemsMap.get(id) || null;
}
function getSuitById(id) {
  return _suitsMap.get(id) || null;
}
function getAttachmentById(id) {
  return _attsMap.get(id) || null;
}

function makeSlotData(item, qty, existing = null) {
  const d = { id: item.id, qty: qty };
  if (existing?.locked) d.locked = true;

  if (item?.category === "equipment") {
    const base = defaultWeaponAttsForItem(item);
    d.atts = existing?.atts ? { ...base, ...existing.atts } : base;
    for (const k of Object.keys(d.atts)) {
      if (!(k in base)) delete d.atts[k];
    }
  }
  return d;
}

function cloneSlotData(d) {
  if (!d) return null;
  const copy = { id: d.id, qty: d.qty };
  if (d.locked) copy.locked = true;
  if (d.atts) copy.atts = { ...d.atts };
  return copy;
}

function normalizeWeaponAttsInState() {
  const containers = [gameState.equipment, gameState.backpack, gameState.quickUse, gameState.safePocket, gameState.augmented];
  for (const cont of containers) {
    if (!Array.isArray(cont)) continue;
    for (let i = 0; i < cont.length; i++) {
      const d = cont[i];
      if (!d) continue;
      const item = getItemById(d.id);
      if (item?.category === "equipment") ensureWeaponAtts(d);
    }
  }
}

// FIX #12: ensure shield is always a proper DB reference
function resolveShield() {
  if (gameState.shield && typeof gameState.shield === "object" && gameState.shield.id) {
    gameState.shield = getItemById(gameState.shield.id) || null;
  }
}

// FIX #7: validate share link / preset slot data
function validateSlot(slot) {
  if (slot === null || slot === undefined) return null;
  if (typeof slot !== "object") return null;
  if (typeof slot.id !== "string" || !getItemById(slot.id)) return null;
  if (typeof slot.qty !== "number" || !Number.isFinite(slot.qty) || slot.qty < 1) {
    slot.qty = 1;
  }
  const item = getItemById(slot.id);
  if (slot.qty > (item.stackMax || 1)) slot.qty = item.stackMax || 1;
  if (slot.atts && typeof slot.atts === "object") {
    for (const key of Object.keys(slot.atts)) {
      if (slot.atts[key] !== null && !getAttachmentById(slot.atts[key])) {
        slot.atts[key] = null;
      }
    }
  }
  return slot;
}

function validateSlotArray(arr, maxLen) {
  if (!Array.isArray(arr)) return new Array(maxLen).fill(null);
  const result = [];
  for (let i = 0; i < maxLen; i++) {
    result.push(validateSlot(arr[i] ?? null));
  }
  return result;
}

// 
// ------------------------------------------------------------
// 2) STATE
// ------------------------------------------------------------
let gameState = {
  currentSuit: suitsDatabase[0],
  equipment: [null, null],
  shield: getItemById("shd_light"),
  backpack: [],
  quickUse: [],
  safePocket: [],
  augmented: [],
};

let undoStack = [];
let currentFilter = "all";
let selectedItemId = null;
let contextSlot = null;

// ------------------------------------------------------------
// FIX #11: centralized state commit
// ------------------------------------------------------------
function commitState() {
  resolveShield();
  applyLockedAugments();
  normalizeWeaponAttsInState();
  renderGrid();
  updateStats();
}

// ------------------------------------------------------------
// 3) INIT
// ------------------------------------------------------------
function init() {
  initSuitSelector();
  loadPresets();

  changeSuit(gameState.currentSuit?.id || suitsDatabase[0].id);

  const augIcon = $("augment-icon");
  if (augIcon && !augIcon._bound) {
    augIcon._bound = true;
    augIcon.onerror = () => (augIcon.src = "assets/suit_looter.png");
  }

  const searchEl = $("search-input");
  if (searchEl && !searchEl._bound) {
    searchEl._bound = true;
    searchEl.addEventListener("input", renderItemPool);
  }
  const sortEl = $("sort-select");
  if (sortEl && !sortEl._bound) {
    sortEl._bound = true;
    sortEl.addEventListener("change", renderItemPool);
  }

  const bs = $("skill-broad-shoulders");
  const la = $("skill-loaded-arms");
  if (bs && !bs._bound) {
    bs._bound = true;
    bs.addEventListener("change", updateStats);
  }
  if (la && !la._bound) {
    la._bound = true;
    la.addEventListener("change", updateStats);
  }

    ensureModalStyles();
    ensureQtyModal();
  ensureAttachmentsModal();
  ensureContextMenuAttachmentsButton();
  ensureRichTooltip();

  hideContextMenu();
  closeQtyPicker();
  closeAttachmentsModal();

  // FIX #4: no double render on URL load
  let loadedFromUrl = false;
  try {
    loadedFromUrl = loadFromUrl();
  } catch (e) {
    console.warn("loadFromUrl failed:", e);
  }

  if (!loadedFromUrl) {
    renderGrid();
    updateStats();
  }
  renderItemPool();
}

// ------------------------------------------------------------
// 4) MAKE FUNCTIONS AVAILABLE FOR HTML onclick
// ------------------------------------------------------------
window.changeSuit = changeSuit;
window.filterItems = filterItems;
window.clearLoadout = clearLoadout;
window.shareBuild = shareBuild;
window.hideToast = hideToast;

window.removeItem = removeItem;
window.removeShield = removeShield;

window.toggleLoadoutMenu = toggleLoadoutMenu;
window.handleGlobalClick = handleGlobalClick;

window.savePreset = savePreset;
window.applyPreset = applyPreset;
window.deletePreset = deletePreset;

window.openPublishModal = openPublishModal;
window.closePublishModal = closePublishModal;
window.submitBuild = submitBuild;

window.undoLastAction = undoLastAction;
window.undoClear = undoClear;

window.openDiscord = openDiscord;

window.contextAction = contextAction;

// ------------------------------------------------------------
// 5) SUIT SELECTOR / FILTERS
// ------------------------------------------------------------
function initSuitSelector() {
  const el = $("suit-selector");
  if (!el) return;
  el.innerHTML = suitsDatabase.map((s) => `<option value="${s.id}">${escHtml(s.name)}</option>`).join("");
}

function filterItems(cat) {
  currentFilter = cat;

  const on = "flex-1 py-2 text-[10px] font-bold uppercase text-white border-b-2 border-[#66FCF1]";
  const off = "flex-1 py-2 text-[10px] font-bold uppercase text-gray-500 hover:text-white";

  const btnAll = $("btn-all");
  const btnWpn = $("btn-wpn");
  const btnItem = $("btn-item");

  if (btnAll) btnAll.className = cat === "all" ? on : off;
  if (btnWpn) btnWpn.className = cat === "equipment" ? on : off;
  if (btnItem) btnItem.className = cat === "quick" ? on : off;

  renderItemPool();
}

// ------------------------------------------------------------
// 6) STACKING + VALIDATION
// ------------------------------------------------------------
function addStackable(container, item, qty) {
  const max = item.stackMax || 1;
  let remaining = qty;

  for (let i = 0; i < container.length; i++) {
    const slot = container[i];
    if (slot && slot.id === item.id && slot.qty < max) {
      const space = max - slot.qty;
      const add = Math.min(space, remaining);
      slot.qty += add;
      remaining -= add;
      if (remaining === 0) return 0;
    }
  }

  for (let i = 0; i < container.length; i++) {
    if (!container[i]) {
      const add = Math.min(max, remaining);
      container[i] = { id: item.id, qty: add };
      remaining -= add;
      if (remaining === 0) return 0;
    }
  }

  return remaining;
}

function validateTarget(item, targetCat) {
  if (targetCat === "equipment" && item.category !== "equipment") {
    showToast("Weapons only!");
    return false;
  }
  if (targetCat === "shield" && item.category !== "shield") {
    showToast("Shields only!");
    return false;
  }
  if (targetCat === "shield") {
    const allowed = gameState.currentSuit.stats.allowedShields || [];
    if (!allowed.includes(item.tier)) {
      showToast("Incompatible Shield!");
      return false;
    }
  }

  if (targetCat === "augmented") {
    const rule = gameState.currentSuit.stats.augmentedRule || "any";
    const t = (item.type || "").toLowerCase();
    const c = (item.category || "").toLowerCase();

    if (rule === "integratedLocked") {
      showToast("Integrated slot (locked)");
      return false;
    }
    if (rule === "grenadeOnly") {
      if (!(t.includes("grenade") || t.includes("explosive"))) {
        showToast("Grenades only!");
        return false;
      }
    }
    if (rule === "utilityOnly") {
      if (!(t.includes("utility") || t.includes("gadget") || t.includes("trap") || t.includes("regen"))) {
        showToast("Utility only!");
        return false;
      }
    }
    if (rule === "trinketOnly") {
      if (!(c === "trinket" || t.includes("trinket"))) {
        showToast("Trinkets only!");
        return false;
      }
    }
  }

  return true;
}

// FIX #10: split into addItemToSlot / autoAddItem with backward-compatible wrapper
function addItemToSlot(item, targetCat, targetIdx, qty = 1) {
  if (!item) return false;
  qty = Math.floor(qty);
  if (!Number.isFinite(qty) || qty <= 0) return false;

  if (!validateTarget(item, targetCat)) return false;

  saveState();

  if (targetCat === "shield") {
    gameState.shield = item;
    commitState();
    return true;
  }

  if (targetCat === "augmented") {
    const existing = gameState.augmented[targetIdx];
    if (existing && existing.locked) {
      showToast("Slot is locked");
      return false;
    }
  }

  const slotData = makeSlotData(item, Math.min(qty, item.stackMax || 1));

  if (targetCat === "equipment") gameState.equipment[targetIdx] = slotData;
  else if (targetCat === "backpack") gameState.backpack[targetIdx] = slotData;
  else if (targetCat === "quick") gameState.quickUse[targetIdx] = slotData;
  else if (targetCat === "safe") gameState.safePocket[targetIdx] = slotData;
  else if (targetCat === "augmented") gameState.augmented[targetIdx] = slotData;

  commitState();
  return true;
}

function autoAddItem(item, qty = 1) {
  if (!item) return false;
  qty = Math.floor(qty);
  if (!Number.isFinite(qty) || qty <= 0) return false;

  saveState();

  if (item.category === "equipment") {
    if (!gameState.equipment[0]) gameState.equipment[0] = makeSlotData(item, 1);
    else if (!gameState.equipment[1]) gameState.equipment[1] = makeSlotData(item, 1);
    else addToBackpack(item, qty);
  } else if (item.category === "shield") {
    if (!validateTarget(item, "shield")) return false;
    gameState.shield = item;
  } else if (item.category === "quick") {
    let left = addStackable(gameState.quickUse, item, qty);
    if (left > 0) left = addStackable(gameState.backpack, item, left);
    if (left > 0) showToast(`No space for ${left}`);
  } else {
    addToBackpack(item, qty);
  }

  commitState();
  return true;
}

function addItem(item, targetCat, targetIdx, qty = 1) {
  if (targetCat && targetIdx !== undefined) {
    return addItemToSlot(item, targetCat, targetIdx, qty);
  }
  return autoAddItem(item, qty);
}

function addToBackpack(item, qty) {
  const left = addStackable(gameState.backpack, item, qty);
  if (left > 0) showToast("Backpack Full!");
}

function removeShield() {
  saveState();
  gameState.shield = null;
  commitState();
}

// ------------------------------------------------------------
// 7) DRAG + DROP (POOL + SLOT->SLOT)
// ------------------------------------------------------------
function dragFromPool(ev, itemId) {
  ev.dataTransfer.clearData();
  ev.dataTransfer.effectAllowed = "copy";
  ev.dataTransfer.setData("text/plain", itemId);
  ev.dataTransfer.setData("application/json", JSON.stringify({ source: "pool" }));
}

function dragFromSlot(ev, cat, idx) {
  const cont = getContainer(cat);
  const d = cont ? cont[idx] : null;
  if (d && d.locked) {
    ev.preventDefault();
    return;
  }

  ev.dataTransfer.clearData();
  ev.dataTransfer.effectAllowed = "move";
  ev.dataTransfer.setData("application/json", JSON.stringify({ source: "slot", cat, idx }));
}

function allowDrop(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add("slot-hover");
}
function leaveDrop(ev) {
  ev.currentTarget.classList.remove("slot-hover");
}

function getContainer(cat) {
  if (cat === "equipment") return gameState.equipment;
  if (cat === "backpack") return gameState.backpack;
  if (cat === "quick") return gameState.quickUse;
  if (cat === "safe") return gameState.safePocket;
  if (cat === "augmented") return gameState.augmented;
  if (cat === "shield") return null;
  return null;
}

function applyLockedAugments() {
  const suit = gameState.currentSuit;
  const st = suit?.stats || {};
  const rule = st.augmentedRule || "any";

  if (Array.isArray(gameState.augmented)) {
    for (let i = 0; i < gameState.augmented.length; i++) {
      if (gameState.augmented[i]?.locked) gameState.augmented[i] = null;
    }
  }

  if (rule === "integratedLocked") {
    const id = st.augmentedLockedItemId;
    if (!id) return;

    if (!gameState.augmented || gameState.augmented.length === 0) gameState.augmented = [null];
    gameState.augmented[0] = { id, qty: 1, locked: true };
  }
}

function moveSlotToSlot(fromCat, fromIdx, toCat, toIdx) {
  const fromContainer = getContainer(fromCat);
  const toContainer = getContainer(toCat);

  if (!fromContainer || !toContainer) return false;

  const fromData = fromContainer[fromIdx];
  if (!fromData) return false;
  if (fromData.locked) return false;

  const item = getItemById(fromData.id);
  if (!item) return false;

  if (!validateTarget(item, toCat)) return false;
  if (toCat === "equipment" && item.category !== "equipment") return false;

  const toData = toContainer[toIdx] || null;
  if (toData && toData.locked) return false;

  const max = item.stackMax || 1;

  if (!toData) {
    toContainer[toIdx] = cloneSlotData(fromData);
    fromContainer[fromIdx] = null;
    return true;
  }

  if (toData.id === fromData.id && max > 1) {
    const space = max - (toData.qty || 0);
    if (space > 0) {
      const moved = Math.min(space, fromData.qty);
      toData.qty += moved;
      fromData.qty -= moved;
      if (fromData.qty <= 0) fromContainer[fromIdx] = null;
      return true;
    }
  }

  toContainer[toIdx] = cloneSlotData(fromData);
  fromContainer[fromIdx] = cloneSlotData(toData);
  return true;
}

// FIX #3: shield drag source handling
function drop(ev, category, index) {
  ev.preventDefault();
  ev.currentTarget.classList.remove("slot-hover");

  if (category === "augmented") {
    const d = gameState.augmented[index];
    if (d && d.locked) {
      showToast("Slot is locked");
      return;
    }
  }

  const json = ev.dataTransfer.getData("application/json");
  if (json) {
    try {
      const data = JSON.parse(json);

      if (data.source === "shield") {
        if (category === "shield") return;
        if (!gameState.shield) return;

        if (category === "backpack") {
          saveState();
          const shieldItem = gameState.shield;
          const empty = gameState.backpack.findIndex((s) => !s);
          if (empty === -1) { showToast("Backpack Full!"); return; }
          gameState.backpack[empty] = { id: shieldItem.id, qty: 1 };
          gameState.shield = null;
          commitState();
        } else {
          showToast("Shield can only move to backpack");
        }
        return;
      }

      if (data.source === "slot") {
        saveState();
        const ok = moveSlotToSlot(data.cat, data.idx, category, index);
        if (ok) commitState();
        return;
      }
    } catch {}
  }

  const itemId = ev.dataTransfer.getData("text/plain");
  const item = getItemById(itemId);
  if (item) addItem(item, category, index, 1);
}

// ------------------------------------------------------------
// 8) RENDER GRID
// ------------------------------------------------------------
function renderGrid() {
  // Shield slot
  const shieldEl = $("slot-shield");
  if (shieldEl) {
    shieldEl.innerHTML = "";
    shieldEl.ondragover = allowDrop;
    shieldEl.ondragleave = leaveDrop;
    shieldEl.ondrop = (e) => drop(e, "shield", 0);

    shieldEl.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (gameState.shield) removeShield();
    };

    if (gameState.shield) {
      const rc = gameState.shield.rarity ? `rarity-${gameState.shield.rarity}` : "";
      shieldEl.className = `aspect-[2/1] bg-black/40 border rounded hover:bg-white/5 relative group flex items-center justify-center ${rc}`;
      bindTooltipForItem(shieldEl, gameState.shield.id);

      shieldEl.innerHTML = `
        <img src="${gameState.shield.image}" class="w-[80%] h-[80%] object-contain" onerror="this.src='assets/shield_light.png'">
        <button onclick="removeShield()" class="slot-remove">×</button>
      `;

      // FIX #3: shield draggable
      shieldEl.draggable = true;
      shieldEl.ondragstart = (e) => {
        e.dataTransfer.clearData();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/json", JSON.stringify({ source: "shield" }));
      };
    } else {
      shieldEl.className = "aspect-[2/1] bg-black/40 border border-white/10 rounded hover:bg-white/5 relative group flex items-center justify-center";
      shieldEl.title = "";
      shieldEl.innerHTML = `<span class="text-white/10 text-xl font-hud">🛡️</span>`;
      shieldEl.draggable = false;
      shieldEl.ondragstart = null;
    }
  }

  // Weapon slots
  for (let i = 0; i < 2; i++) {
    const slot = $(`slot-equip-${i}`);
    if (!slot) continue;

    slot.ondragover = allowDrop;
    slot.ondragleave = leaveDrop;
    slot.ondrop = (e) => drop(e, "equipment", i);

    slot.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, "equipment", i);
    };

    const data = gameState.equipment[i];
    if (data) {
      const item = getItemById(data.id);
      const rc = item?.rarity ? `rarity-${item.rarity}` : "";
      slot.className = `aspect-[2/1] bg-black/40 border rounded hover:bg-white/5 relative group flex items-center justify-center ${rc}`;
      slot.innerHTML = renderSlotContent(item, data.qty, "equipment", i, !!data.locked);

      bindTooltipForSlot(slot, "equipment", i);

      slot.draggable = !data.locked;
      slot.ondragstart = data.locked ? null : (e) => dragFromSlot(e, "equipment", i);
    } else {
      slot.title = "";
      slot.draggable = false;
      slot.ondragstart = null;
      slot.className = "aspect-[2/1] bg-black/40 border border-white/10 rounded hover:bg-white/5 relative group flex items-center justify-center";
      slot.innerHTML = `<span class="text-white/10 text-xs font-hud select-none uppercase tracking-widest">+</span>`;
    }
  }

  renderContainer("backpack-grid", gameState.backpack, "backpack");
  renderContainer("quick-grid", gameState.quickUse, "quick");
  renderContainer("safe-grid", gameState.safePocket, "safe");

  const augWrap = $("augmented-container");
  const augGrid = $("augmented-grid");
  const augTitle = $("augmented-title");
  const augSlots = gameState.currentSuit.stats.augmentedSlots || 0;

  if (augWrap && augGrid) {
    if (augSlots > 0) {
      augWrap.classList.remove("hidden");
      if (augTitle) augTitle.innerText = gameState.currentSuit.stats.augmentedLabel || "AUGMENTED";
      renderContainer("augmented-grid", gameState.augmented, "augmented");
    } else {
      augWrap.classList.add("hidden");
    }
  }

  const count = $("backpack-count");
  if (count) count.innerText = `${gameState.backpack.filter(Boolean).length}/${gameState.currentSuit.stats.backpackSlots}`;
}

function renderContainer(elId, container, cat) {
  const el = $(elId);
  if (!el) return;
  el.innerHTML = "";

  for (let i = 0; i < container.length; i++) {
    const slotData = container[i];
    const div = document.createElement("div");

    div.ondragover = allowDrop;
    div.ondragleave = leaveDrop;
    div.ondrop = (e) => drop(e, cat, i);

    div.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (container[i] && container[i].locked) return;
      showContextMenu(e, cat, i);
    };

    if (slotData) {
      const item = getItemById(slotData.id);
      const rc = item?.rarity ? `rarity-${item.rarity}` : "";
      div.className = `aspect-square bg-black/40 border rounded hover:bg-white/5 relative group flex items-center justify-center overflow-hidden transition-all ${rc}`;
      div.innerHTML = renderSlotContent(item, slotData.qty, cat, i, !!slotData.locked);

      bindTooltipForSlot(div, cat, i);

      div.draggable = !slotData.locked;
      div.ondragstart = slotData.locked ? null : (e) => dragFromSlot(e, cat, i);
    } else {
      div.className = "aspect-square bg-black/40 border border-white/10 rounded hover:bg-white/5 relative group flex items-center justify-center overflow-hidden transition-all";
      div.innerHTML = `<span class="text-white/5 text-[10px] select-none font-bold">+</span>`;
      div.title = "";
      div.draggable = false;
    }

    el.appendChild(div);
  }
}

function renderSlotContent(item, qty, cat, idx, locked = false) {
  if (!item) return "";
  const badge = qty > 1 ? `<div class="qty-badge">x${qty}</div>` : "";
  const lockOverlay = locked
    ? `<div class="absolute inset-0 bg-black/40 flex items-center justify-center text-white/70 text-lg pointer-events-none">🔒</div>`
    : "";
  const removeBtn = locked ? "" : `<button onclick="removeItem('${cat}', ${idx})" class="slot-remove">×</button>`;
  return `
    <img src="${item.image}" class="w-[85%] h-[85%] object-contain drop-shadow-md select-none pointer-events-none" draggable="false" onerror="this.style.opacity='0.2'">
    ${badge}
    ${removeBtn}
    ${lockOverlay}
  `;
}

// ------------------------------------------------------------
// 9) ITEM POOL + DETAILS
// ------------------------------------------------------------
function renderItemPool() {
  const container = $("item-pool");
  if (!container) return;
  container.innerHTML = "";

  const search = ($("search-input")?.value || "").toLowerCase();
  const sortBy = $("sort-select")?.value || "name";

  let filtered = itemsDatabase.filter((i) => {
    if (currentFilter === "all") return true;
    if (currentFilter === "equipment") return i.category === "equipment";
    if (currentFilter === "quick") return ["quick", "shield", "ammo", "trinket"].includes(i.category);
    return true;
  });

  filtered = filtered.filter((i) => !i.hiddenFromPool);

  if (search) filtered = filtered.filter((i) => (i.name || "").toLowerCase().includes(search));

  filtered.sort((a, b) => {
    if (sortBy === "weight") return (b.weight || 0) - (a.weight || 0);
    if (sortBy === "value") return (b.value || 0) - (a.value || 0);
    return (a.name || "").localeCompare(b.name || "");
  });

  for (const item of filtered) {
    const row = document.createElement("div");
    const rc = item.rarity ? `rarity-${item.rarity}` : "border-transparent";

    row.className = `item-row flex items-center gap-3 p-2 rounded border ${rc} cursor-pointer transition-all group hover:bg-white/10 ${selectedItemId === item.id ? "item-selected" : "bg-white/5"}`;
    row.draggable = true;
    row.ondragstart = (e) => dragFromPool(e, item.id);

    row.onclick = () => selectItem(item.id);

    bindTooltipForItem(row, item.id);

    row.ondblclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      addItem(item, null, null, 1);
    };

    row.innerHTML = `
      <div class="w-10 h-10 bg-black/50 rounded flex items-center justify-center overflow-hidden border border-white/5 shrink-0 relative">
        <img src="${item.image}" class="w-8 h-8 object-contain pointer-events-none select-none" draggable="false" onerror="this.style.opacity='0.2'">
        ${(item.stackMax || 1) > 1 ? `<div class="absolute bottom-0 right-0 bg-black/80 text-[8px] px-1 text-gray-400">max ${item.stackMax}</div>` : ""}
      </div>
      <div class="flex-1 min-w-0 pointer-events-none">
        <div class="flex justify-between items-baseline">
          <p class="text-xs font-bold text-gray-200 group-hover:text-[#66FCF1] truncate">${escHtml(item.name)}</p>
          <span class="text-[10px] text-[#FFD700]">$${(item.value || 0).toLocaleString()}</span>
        </div>
        <div class="flex justify-between items-center text-[9px] text-gray-500 uppercase mt-0.5">
          <span>${escHtml(item.type || "")}</span>
          <span class="${(item.weight || 0) > 5 ? "text-orange-400" : "text-gray-400"}">${(item.weight || 0).toFixed(2)} kg</span>
        </div>
      </div>
    `;

    const addBtn = document.createElement("button");
    addBtn.className = "pool-add-btn";
    addBtn.type = "button";
    addBtn.title = "Add";
    addBtn.textContent = "+";
    addBtn.draggable = false;

    addBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      addItem(item, null, null, 1);
    });

    addBtn.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openQtyPicker(item);
    });

    addBtn.addEventListener("mousedown", (ev) => {
      if (ev.shiftKey) {
        ev.preventDefault();
        ev.stopPropagation();
        openQtyPicker(item);
      }
    });

    // FIX #20: hold timer with DOM guard + pointercancel
    let holdTimer = null;
    const clearHold = () => {
      if (holdTimer) { window.clearTimeout(holdTimer); holdTimer = null; }
    };

    addBtn.addEventListener("pointerdown", () => {
      if ((item.stackMax || 1) <= 1) return;
      clearHold();
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        if (addBtn.isConnected) openQtyPicker(item);
      }, 350);
    });
    addBtn.addEventListener("pointerup", clearHold);
    addBtn.addEventListener("pointerleave", clearHold);
    addBtn.addEventListener("pointercancel", clearHold);

    row.appendChild(addBtn);
    container.appendChild(row);
  }
}

function selectItem(itemId) {
  selectedItemId = itemId;
  const item = getItemById(itemId);
  if (!item) return;

  const panel = $("details-panel");
  if (panel) panel.classList.remove("hidden");

  const img = $("detail-img");
  if (img) img.src = item.image;

  const name = $("detail-name");
  if (name) name.innerText = item.name || "";
  const w = $("detail-weight");
  if (w) w.innerText = `${(item.weight || 0).toFixed(2)} kg`;
  const v = $("detail-value");
  if (v) v.innerText = `$${(item.value || 0).toLocaleString()}`;

  const craft = $("detail-craft");
  if (craft) craft.innerText = item.crafting || item.recipe || "No Blueprint Required";

  renderItemPool();
}

// ------------------------------------------------------------
// 10) CONTEXT MENU (RIGHT CLICK INVENTORY SLOTS)
// ------------------------------------------------------------
function showContextMenu(e, cat, idx) {
  const menu = $("context-menu");
  if (!menu) return;

  let slotData = null;
  if (cat === "equipment") slotData = gameState.equipment[idx];
  else if (cat === "backpack") slotData = gameState.backpack[idx];
  else if (cat === "quick") slotData = gameState.quickUse[idx];
  else if (cat === "safe") slotData = gameState.safePocket[idx];
  else if (cat === "augmented") slotData = gameState.augmented[idx];

  if (!slotData) return;
  if (slotData.locked) return;

  contextSlot = { cat, idx, slotData, item: getItemById(slotData.id) };
  if (!contextSlot.item) return;

  const attBtn = $("ctx-attachments");
  if (attBtn) {
    attBtn.style.display = contextSlot.item.category === "equipment" ? "block" : "none";
  }

  menu.style.display = "block";
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - 240)}px`;
  menu.style.top = `${Math.min(e.clientY, window.innerHeight - 180)}px`;
}

function hideContextMenu() {
  const menu = $("context-menu");
  if (!menu) return;
  menu.style.display = "none";
  menu.style.left = "-9999px";
  menu.style.top = "-9999px";
  contextSlot = null;
}

function contextAction(action) {
  if (!contextSlot) return;

  const { cat, idx, slotData, item } = contextSlot;
  hideContextMenu();

  // FIX #19: no return showToast
  if (slotData?.locked) { showToast("Locked"); return; }

  if (action === "attachments") {
    if (item.category !== "equipment") { showToast("Not a weapon"); return; }
    openAttachmentsModal(cat, idx);
    return;
  }

  const clearSource = () => {
    if (cat === "equipment") gameState.equipment[idx] = null;
    else if (cat === "backpack") gameState.backpack[idx] = null;
    else if (cat === "quick") gameState.quickUse[idx] = null;
    else if (cat === "safe") gameState.safePocket[idx] = null;
    else if (cat === "augmented") gameState.augmented[idx] = null;
  };

  saveState();

  if (action === "remove") {
    clearSource();
    commitState();
    return;
  }

  if (action === "equip") {
    if (item.category !== "equipment") {
      showToast("Not a weapon");
      return;
    }

    const moved = cloneSlotData(slotData);
    ensureWeaponAtts(moved);
    moved.qty = 1;

    clearSource();

    if (!gameState.equipment[0]) gameState.equipment[0] = moved;
    else if (!gameState.equipment[1]) gameState.equipment[1] = moved;
    else {
      if (cat === "equipment") gameState.equipment[idx] = slotData;
      else if (cat === "backpack") gameState.backpack[idx] = slotData;
      else if (cat === "quick") gameState.quickUse[idx] = slotData;
      else if (cat === "safe") gameState.safePocket[idx] = slotData;
      else if (cat === "augmented") gameState.augmented[idx] = slotData;
      showToast("Weapon slots full");
      return;
    }

    commitState();
    return;
  }

  if (action === "backpack") {
    const qty = slotData.qty || 1;

    if (item.category === "equipment") {
      const moved = cloneSlotData(slotData);
      ensureWeaponAtts(moved);
      clearSource();

      const empty = gameState.backpack.findIndex((s) => !s);
      if (empty === -1) {
        showToast("Backpack Full!");
        if (cat === "equipment") gameState.equipment[idx] = slotData;
        else if (cat === "backpack") gameState.backpack[idx] = slotData;
        else if (cat === "quick") gameState.quickUse[idx] = slotData;
        else if (cat === "safe") gameState.safePocket[idx] = slotData;
        else if (cat === "augmented") gameState.augmented[idx] = slotData;
        return;
      }
      gameState.backpack[empty] = moved;
      commitState();
      return;
    }

    clearSource();
    const left = addStackable(gameState.backpack, item, qty);
    if (left > 0) showToast("Backpack Full!");
    commitState();
    return;
  }

  if (action === "quick") {
    const qty = slotData.qty || 1;
    clearSource();
    const left = addStackable(gameState.quickUse, item, qty);
    if (left > 0) showToast("Quick Use Full");
    commitState();
    return;
  }
}

// ------------------------------------------------------------
// 11) REMOVE / CLEAR / UNDO
// ------------------------------------------------------------
function removeItem(category, index) {
  const cont = getContainer(category);
  const d = cont ? cont[index] : null;
  // FIX #19
  if (d?.locked) { showToast("Locked"); return; }

  saveState();

  if (category === "equipment") gameState.equipment[index] = null;
  else if (category === "backpack") gameState.backpack[index] = null;
  else if (category === "quick") gameState.quickUse[index] = null;
  else if (category === "safe") gameState.safePocket[index] = null;
  else if (category === "augmented") gameState.augmented[index] = null;

  commitState();
}

function clearLoadout() {
  saveState();

  gameState.equipment = [null, null];
  gameState.backpack.fill(null);
  gameState.quickUse.fill(null);
  gameState.safePocket.fill(null);
  gameState.augmented.fill(null);
  gameState.shield = null;

  commitState();
  showToast("Cleared", true);
}

function saveState() {
  try {
    if (undoStack.length > 25) undoStack.shift();
    undoStack.push(JSON.stringify(gameState));
  } catch (e) {
    console.error("saveState failed:", e);
  }
}

// FIX #1 + #5: shield resolved by ID, no double changeSuit
function undoLastAction() {
  if (undoStack.length === 0) return;

  const prev = JSON.parse(undoStack.pop());

  const newSuit = getSuitById(prev?.currentSuit?.id) || suitsDatabase[0];
  gameState.currentSuit = newSuit;
  const icon = $("augment-icon");
  if (icon) icon.src = newSuit.image;
  bindTooltipForSuitIcon(icon);
  const sel = $("suit-selector");
  if (sel) sel.value = newSuit.id;

  gameState.equipment = prev.equipment || [null, null];
  // FIX #1: resolve shield by ID
  gameState.shield = prev.shield?.id ? getItemById(prev.shield.id) : null;
  gameState.backpack = prev.backpack || [];
  gameState.quickUse = prev.quickUse || [];
  gameState.safePocket = prev.safePocket || [];
  gameState.augmented = prev.augmented || prev.au || [];

  resizeContainers();
  commitState();
  showToast("Undo", false);
}

function undoClear() {
  undoLastAction();
}

// ------------------------------------------------------------
// 12) STATS
// ------------------------------------------------------------
function updateStats() {
  let currentWeight = gameState.currentSuit.stats.selfWeight;
  let totalVal = 0;

  const loadedArms = $("skill-loaded-arms")?.checked;
  const broadShoulders = $("skill-broad-shoulders")?.checked;

  const addSlot = (slot) => {
    if (!slot) return;
    const item = getItemById(slot.id);
    if (!item) return;

    let w = item.weight || 0;
    if (loadedArms && item.category === "equipment") w *= 0.5;

    currentWeight += w * (slot.qty || 1);
    totalVal += (item.value || 0) * (slot.qty || 1);

    if (item.category === "equipment" && slot.atts) {
      for (const s of getWeaponAttachmentSlotDefs(item)) {
        const aid = slot.atts[s.key];
        if (!aid) continue;
        const att = getAttachmentById(aid);
        if (!att) continue;
        totalVal += (att.value || 0);
        currentWeight += (att.weight || 0);
      }
    }
  };

  gameState.equipment.forEach(addSlot);

  // FIX #15: shield weight AND value
  if (gameState.shield) {
    currentWeight += gameState.shield.weight || 0;
    totalVal += gameState.shield.value || 0;
  }

  gameState.backpack.forEach(addSlot);
  gameState.quickUse.forEach(addSlot);
  gameState.safePocket.forEach(addSlot);
  gameState.augmented.forEach(addSlot);

  const maxWeight = gameState.currentSuit.stats.maxWeight + (broadShoulders ? 10 : 0);

  const wDisplay = $("weight-display");
  if (wDisplay) {
    wDisplay.innerText = currentWeight.toFixed(1);
    if (currentWeight > maxWeight) wDisplay.classList.add("text-red-500");
    else wDisplay.classList.remove("text-red-500");
  }

  const maxDisplay = $("max-weight-display");
  if (maxDisplay) maxDisplay.innerText = maxWeight.toFixed(1);

  const totalValue = $("total-value");
  if (totalValue) totalValue.innerText = `$${totalVal.toLocaleString()}`;

  const bar = $("weight-bar");
  if (bar) {
    bar.style.width = `${Math.min((currentWeight / maxWeight) * 100, 100)}%`;
    bar.className = `h-full transition-all duration-500 ${currentWeight > maxWeight ? "bg-red-500" : "bg-[#66FCF1]"}`;
  }
}

// ------------------------------------------------------------
// 13) TOAST
// ------------------------------------------------------------
function showToast(msg, showUndo = false) {
  const t = $("toast");
  const txt = $("toast-msg");
  if (!t || !txt) {
    console.log("TOAST:", msg);
    return;
  }

  txt.innerText = msg;

  const undoBtn = $("undo-btn");
  if (undoBtn) {
    if (showUndo) undoBtn.classList.remove("hidden");
    else undoBtn.classList.add("hidden");
  }

  t.classList.remove("translate-y-20", "opacity-0");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => t.classList.add("translate-y-20", "opacity-0"), 2200);
}

function hideToast() {
  $("toast")?.classList.add("translate-y-20", "opacity-0");
}

// ------------------------------------------------------------
// 14) SUIT CHANGE
// ------------------------------------------------------------
// FIX #5 + #13: resizeContainers extracted, toast on item loss
function resizeContainers() {
  const st = gameState.currentSuit.stats;

  let lostItems = 0;
  const checkLoss = (arr, newLen) => {
    for (let i = newLen; i < arr.length; i++) {
      if (arr[i] && !arr[i].locked) lostItems++;
    }
  };

  checkLoss(gameState.backpack, st.backpackSlots);
  checkLoss(gameState.quickUse, st.quickSlots);
  checkLoss(gameState.safePocket, st.safeSlots);
  checkLoss(gameState.augmented, st.augmentedSlots || 0);

  gameState.backpack.length = st.backpackSlots;
  gameState.quickUse.length = st.quickSlots;
  gameState.safePocket.length = st.safeSlots;
  gameState.augmented.length = st.augmentedSlots || 0;

  for (let i = 0; i < gameState.backpack.length; i++) if (gameState.backpack[i] === undefined) gameState.backpack[i] = null;
  for (let i = 0; i < gameState.quickUse.length; i++) if (gameState.quickUse[i] === undefined) gameState.quickUse[i] = null;
  for (let i = 0; i < gameState.safePocket.length; i++) if (gameState.safePocket[i] === undefined) gameState.safePocket[i] = null;
  for (let i = 0; i < gameState.augmented.length; i++) if (gameState.augmented[i] === undefined) gameState.augmented[i] = null;

  if (lostItems > 0) {
    showToast(`${lostItems} item(s) removed (fewer slots)`);
  }
}

function changeSuit(suitId) {
  const newSuit = getSuitById(suitId) || suitsDatabase[0];
  gameState.currentSuit = newSuit;

  const icon = $("augment-icon");
  if (icon) icon.src = newSuit.image;
  bindTooltipForSuitIcon(icon);

  const sel = $("suit-selector");
  if (sel) sel.value = suitId;

  resizeContainers();

  if (gameState.shield) {
    const allowed = newSuit.stats.allowedShields || [];
    if (!allowed.includes(gameState.shield.tier)) {
      gameState.shield = null;
      showToast("Shield Removed (Incompatible)");
    }
  }

  commitState();
}

// ------------------------------------------------------------
// 15) SHARE LINK + URL LOAD
// ------------------------------------------------------------
function serializeBuild() {
  return {
    v: 2,
    suit: gameState.currentSuit.id,
    eq: gameState.equipment,
    sh: gameState.shield ? gameState.shield.id : null,
    bp: gameState.backpack,
    qu: gameState.quickUse,
    sp: gameState.safePocket,
    au: gameState.augmented,
  };
}

const enc = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const dec = (str) => JSON.parse(decodeURIComponent(escape(atob(str))));

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (e2) {
      document.body.removeChild(ta);
      return false;
    }
  }
}

async function shareBuild() {
  const url = new URL(location.href);
  url.searchParams.set("b", enc(serializeBuild()));
  const ok = await copyText(url.toString());
  showToast(ok ? "Link Copied!" : "Copy Failed");
}

// FIX #5 + #7: no double changeSuit, validated payload
function loadFromUrl() {
  const b = new URLSearchParams(location.search).get("b");
  if (!b) return false;

  let p;
  try {
    p = dec(b);
  } catch (e) {
    console.warn("Invalid share link:", e);
    return false;
  }

  // FIX #7: validate payload
  if (!p || typeof p !== "object") return false;
  if (typeof p.suit !== "string" || !getSuitById(p.suit)) p.suit = suitsDatabase[0].id;

  const newSuit = getSuitById(p.suit) || suitsDatabase[0];
  gameState.currentSuit = newSuit;
  const icon = $("augment-icon");
  if (icon) icon.src = newSuit.image;
  bindTooltipForSuitIcon(icon);
  const sel = $("suit-selector");
  if (sel) sel.value = newSuit.id;

  // Restore + validate
  gameState.equipment = validateSlotArray(p.eq, 2);
  gameState.shield = (typeof p.sh === "string") ? getItemById(p.sh) : null;
  gameState.backpack = Array.isArray(p.bp) ? p.bp.map((s) => validateSlot(s)) : [];
  gameState.quickUse = Array.isArray(p.qu) ? p.qu.map((s) => validateSlot(s)) : [];
  gameState.safePocket = Array.isArray(p.sp) ? p.sp.map((s) => validateSlot(s)) : [];
  gameState.augmented = Array.isArray(p.au || p.augmented) ? (p.au || p.augmented).map((s) => validateSlot(s)) : [];

  resizeContainers();

  if (gameState.shield) {
    const allowed = newSuit.stats.allowedShields || [];
    if (!allowed.includes(gameState.shield.tier)) {
      gameState.shield = null;
    }
  }

  commitState();
  return true;
}

// ------------------------------------------------------------
// 16) DISCORD
// ------------------------------------------------------------
function openDiscord() {
  window.open("https://discord.gg/KB3kASNMMP", "_blank");
}

// ------------------------------------------------------------
// 17) LOADOUTS (PRESETS) MENU
// ------------------------------------------------------------
function toggleLoadoutMenu(e) {
  if (e) e.stopPropagation();
  const menu = $("loadout-menu");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

function handleGlobalClick(e) {
  const menu = $("loadout-menu");
  if (menu) {
    const clickedInside = e?.target?.closest && e.target.closest("#loadout-menu");
    const clickedBtn = e?.target?.closest && e.target.closest("#loadout-btn");
    if (!clickedInside && !clickedBtn) menu.classList.add("hidden");
  }
  hideContextMenu();
}

function savePreset() {
  const name = $("preset-name")?.value?.trim();
  // FIX #19
  if (!name) { showToast("Enter Name"); return; }

  const presets = JSON.parse(localStorage.getItem("arc_presets") || "{}");

  presets[name] = {
    suit: gameState.currentSuit.id,
    eq: gameState.equipment,
    sh: gameState.shield ? gameState.shield.id : null,
    bp: gameState.backpack,
    qu: gameState.quickUse,
    sp: gameState.safePocket,
    au: gameState.augmented,
  };

  localStorage.setItem("arc_presets", JSON.stringify(presets));
  loadPresets();
  showToast("Saved!");
}

// FIX #6: XSS-safe preset rendering
function loadPresets() {
  const list = $("preset-list");
  if (!list) return;

  const presets = JSON.parse(localStorage.getItem("arc_presets") || "{}");
  const names = Object.keys(presets);

  if (names.length === 0) {
    list.innerHTML = '<p class="text-xs text-gray-600 text-center py-2">No saved builds</p>';
    return;
  }

  list.innerHTML = "";
  for (const name of names) {
    const row = document.createElement("div");
    row.className = "flex justify-between items-center text-xs text-gray-400 hover:text-white cursor-pointer px-1 py-1 hover:bg-white/5 rounded";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    nameSpan.addEventListener("click", () => applyPreset(name));

    const delSpan = document.createElement("span");
    delSpan.textContent = "x";
    delSpan.className = "text-red-500 hover:text-red-300";
    delSpan.addEventListener("click", (e) => { e.stopPropagation(); deletePreset(name); });

    row.appendChild(nameSpan);
    row.appendChild(delSpan);
    list.appendChild(row);
  }
}

// FIX #5: no double changeSuit
function applyPreset(name) {
  const presets = JSON.parse(localStorage.getItem("arc_presets") || "{}");
  const p = presets[name];
  if (!p) return;

  const newSuit = getSuitById(p.suit) || suitsDatabase[0];
  gameState.currentSuit = newSuit;
  const icon = $("augment-icon");
  if (icon) icon.src = newSuit.image;
  bindTooltipForSuitIcon(icon);
  const sel = $("suit-selector");
  if (sel) sel.value = newSuit.id;

  gameState.equipment = p.eq || [null, null];
  gameState.shield = p.sh ? getItemById(p.sh) : null;
  gameState.backpack = p.bp || [];
  gameState.quickUse = p.qu || [];
  gameState.safePocket = p.sp || [];
  gameState.augmented = p.au || [];

  resizeContainers();

  if (gameState.shield) {
    const allowed = newSuit.stats.allowedShields || [];
    if (!allowed.includes(gameState.shield.tier)) {
      gameState.shield = null;
      showToast("Shield Removed (Incompatible)");
    }
  }

  commitState();
  showToast("Loaded");
}

function deletePreset(name) {
  const presets = JSON.parse(localStorage.getItem("arc_presets") || "{}");
  delete presets[name];
  localStorage.setItem("arc_presets", JSON.stringify(presets));
  loadPresets();
  showToast("Deleted");
}

// ------------------------------------------------------------
// 18) PUBLISH
// ------------------------------------------------------------
// ------------------------------------------------------------
// 18) PUBLISH
// ------------------------------------------------------------
function openPublishModal() {
  $("publish-modal")?.classList.remove("hidden");

  // Auto-fill creator name
  const saved = localStorage.getItem("arc_creator_name");
  const input = $("pub-creator");
  if (input && saved && !input.value) {
    input.value = saved;
  }
}

function closePublishModal() {
  $("publish-modal")?.classList.add("hidden");
}

async function submitBuild() {
  const title = $("pub-title")?.value?.trim();
  const creator = $("pub-creator")?.value?.trim();
  const tagsRaw = $("pub-tags")?.value || "";

  // Validation
  if (!title) { showToast("Title is required!"); return; }
  if (!creator) { showToast("Creator name is required!"); return; }
  if (!window.db || !window.dbFunctions) { showToast("Database not connected!"); return; }

  // Save creator for next time
  localStorage.setItem("arc_creator_name", creator);

  const payload = serializeBuild();
  const encoded = enc(payload);

  let totalWeight = gameState.currentSuit.stats.selfWeight;
  let totalValue = 0;

  const calc = (slot) => {
    if (!slot) return;
    const item = getItemById(slot.id);
    if (!item) return;
    totalWeight += (item.weight || 0) * (slot.qty || 1);
    totalValue += (item.value || 0) * (slot.qty || 1);

    if (item.category === "equipment" && slot.atts) {
      for (const s of getWeaponAttachmentSlotDefs(item)) {
        const aid = slot.atts[s.key];
        if (!aid) continue;
        const att = getAttachmentById(aid);
        if (!att) continue;
        totalWeight += (att.weight || 0);
        totalValue += (att.value || 0);
      }
    }
  };

  gameState.equipment.forEach(calc);
  if (gameState.shield) {
    totalWeight += gameState.shield.weight || 0;
    totalValue += gameState.shield.value || 0;
  }
  gameState.backpack.forEach(calc);
  gameState.quickUse.forEach(calc);
  gameState.safePocket.forEach(calc);
  gameState.augmented.forEach(calc);

  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const buildRecord = {
    title,
    creator,
    buildCode: encoded,
    augment: gameState.currentSuit.name,
    stats: {
      weight: parseFloat(totalWeight.toFixed(1)),
      value: totalValue,
      weaponCount: gameState.equipment.filter(Boolean).length,
    },
    tags,
    timestamp: new Date().toISOString(),
    patch: "0.12",
    views: 0,
    likes: 0,
  };

  try {
    const { collection, addDoc } = window.dbFunctions;
    await addDoc(collection(window.db, "builds"), buildRecord);
    closePublishModal();
    showToast("Build Published Successfully!");
  } catch (e) {
    console.error("Error publishing:", e);
    showToast("Error publishing (Check Console)");
  }
}



// ------------------------------------------------------------
// 19) QUANTITY PICKER MODAL
// ------------------------------------------------------------
function ensureQtyModal() {
  if ($("qty-modal")) return;

  const wrap = document.createElement("div");
  wrap.id = "qty-modal";
  wrap.className = "arc-modal-backdrop";

  wrap.innerHTML = `
    <div class="arc-modal-card" style="max-width: 400px;">
      <div class="arc-modal-header">
        <div class="arc-modal-icon-wrap">
          <img id="qty-modal-img" src="" onerror="this.style.opacity='0.2'">
        </div>
        <div style="flex:1; min-width:0;">
          <div class="arc-modal-title" id="qty-modal-title"></div>
          <div class="arc-modal-sub" id="qty-modal-sub"></div>
        </div>
        <button class="arc-modal-close" id="qty-modal-x">✕</button>
      </div>

      <div class="arc-modal-body">
        <div class="arc-qty-display">
          <span class="arc-qty-big" id="qty-modal-big">0</span>
          <span class="arc-qty-max" id="qty-modal-maxlabel">/ 1</span>
        </div>

        <input id="qty-modal-range" type="range" min="0" max="1" value="0" class="arc-range">

        <div style="display:flex; align-items:center; gap:12px; margin-top:14px;">
          <span style="font-size:11px; color:rgba(255,255,255,.45); font-weight:700; text-transform:uppercase;">Amount</span>
          <input id="qty-modal-number" type="number" min="0" max="1" value="0" class="arc-number">
        </div>
      </div>

      <div class="arc-modal-footer">
        <button class="arc-btn arc-btn-ghost" id="qty-modal-cancel">Cancel</button>
        <button class="arc-btn arc-btn-primary" id="qty-modal-add">Add to Loadout</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  $("qty-modal-x").onclick = closeQtyPicker;
  $("qty-modal-cancel").onclick = closeQtyPicker;

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeQtyPicker();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeQtyPicker();
  });

  const range = $("qty-modal-range");
  const num = $("qty-modal-number");
  const big = $("qty-modal-big");

  range.addEventListener("input", () => {
    num.value = range.value;
    big.textContent = range.value;
  });
  num.addEventListener("input", () => {
    const v = clampInt(num.value, parseInt(num.min, 10), parseInt(num.max, 10));
    num.value = v;
    range.value = v;
    big.textContent = v;
  });

  $("qty-modal-add").onclick = () => {
    const itemId = wrap.getAttribute("data-item-id");
    const item = getItemById(itemId);
    const qty = parseInt($("qty-modal-number").value, 10) || 0;
    closeQtyPicker();
    if (qty > 0 && item) addItem(item, null, null, qty);
  };
}

function clampInt(v, min, max) {
  let n = parseInt(v, 10);
  if (!Number.isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function openQtyPicker(item) {
  if (!item) return;
  ensureQtyModal();

  const wrap = $("qty-modal");
  const max = item.stackMax || 1;

  wrap.setAttribute("data-item-id", item.id);
  $("qty-modal-img").src = item.image || "";
  $("qty-modal-title").innerText = item.name || "Item";
  $("qty-modal-sub").innerText = `Stack up to ${max}`;
  $("qty-modal-maxlabel").textContent = `/ ${max}`;

  const range = $("qty-modal-range");
  const num = $("qty-modal-number");
  const big = $("qty-modal-big");

  range.min = "0";
  range.max = String(max);
  range.value = String(max);

  num.min = "0";
  num.max = String(max);
  num.value = String(max);

  big.textContent = String(max);

  wrap.classList.add("is-open");
}

function closeQtyPicker() {
  const wrap = $("qty-modal");
  if (!wrap) return;
  wrap.classList.remove("is-open");
  wrap.removeAttribute("data-item-id");
}

// ------------------------------------------------------------
// 20) ATTACHMENTS MODAL + CONTEXT MENU BUTTON
// ------------------------------------------------------------
let attModalTarget = null;

function ensureContextMenuAttachmentsButton() {
  const menu = $("context-menu");
  if (!menu) return;
  if ($("ctx-attachments")) return;

  const divider = menu.querySelector("div.h-px") || null;

  const btn = document.createElement("button");
  btn.id = "ctx-attachments";
  btn.className = "ctx-btn";
  btn.type = "button";
  btn.textContent = "Edit Attachments";
  btn.style.display = "none";
  btn.addEventListener("click", () => contextAction("attachments"));

  if (divider) menu.insertBefore(btn, divider);
  else menu.appendChild(btn);
}

function ensureAttachmentsModal() {
  if ($("att-modal")) return;

  const wrap = document.createElement("div");
  wrap.id = "att-modal";
  wrap.className = "arc-modal-backdrop";
  wrap.style.zIndex = "100000";

  wrap.innerHTML = `
    <div class="arc-modal-card" style="max-width: 500px;">
      <div class="arc-modal-header">
        <div class="arc-modal-icon-wrap" id="att-modal-icon-wrap">
          <img id="att-modal-img" src="" onerror="this.style.opacity='0.2'">
        </div>
        <div style="flex:1; min-width:0;">
          <div class="arc-modal-title" id="att-modal-title">Attachments</div>
          <div class="arc-modal-sub" id="att-modal-sub">Pick mods for this weapon</div>
        </div>
        <button class="arc-modal-close" id="att-modal-x">✕</button>
      </div>

      <div class="arc-modal-body" id="att-modal-slots" style="display:grid; gap:10px;"></div>

      <div class="arc-modal-footer">
        <button class="arc-btn arc-btn-ghost" id="att-modal-cancel">Cancel</button>
        <button class="arc-btn arc-btn-primary" id="att-modal-save">Save Attachments</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  $("att-modal-x").onclick = closeAttachmentsModal;
  $("att-modal-cancel").onclick = closeAttachmentsModal;

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) closeAttachmentsModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAttachmentsModal();
  });

  $("att-modal-save").onclick = saveAttachmentsModal;
}

function openAttachmentsModal(cat, idx) {
  ensureAttachmentsModal();

  const cont = getContainer(cat);
  const d = cont?.[idx];
  if (!d) return;

  const weapon = getItemById(d.id);
  if (!weapon || weapon.category !== "equipment") { showToast("Not a weapon"); return; }

  ensureWeaponAtts(d);

  const slotDefs = getWeaponAttachmentSlotDefs(weapon);
  if (!slotDefs.length) { showToast("No attachment slots"); return; }

  attModalTarget = { cat, idx };

  const title = $("att-modal-title");
  if (title) title.innerText = weapon.name || "Weapon";

  const sub = $("att-modal-sub");
  if (sub) sub.innerText = `${weapon.type} — Configure attachments`;

  const img = $("att-modal-img");
  if (img) img.src = weapon.image || "";

  const slotsWrap = $("att-modal-slots");
  if (!slotsWrap) return;

  slotsWrap.innerHTML = "";

  for (const s of slotDefs) {
    const row = document.createElement("div");
    row.className = "arc-att-row";

    const iconWrap = document.createElement("div");
    iconWrap.className = "arc-att-icon";
    const iconImg = document.createElement("img");
    const currentAttId = d.atts[s.key];
    iconImg.src = getAttIconSrc(s.key, currentAttId, weapon);
    iconImg.style.opacity = currentAttId ? "1" : "0.35";
    iconImg.onerror = function() { this.src = ATT_EMPTY_ICON; this.style.opacity = "0.25"; };
    iconWrap.appendChild(iconImg);

    const rightSide = document.createElement("div");
    rightSide.style.minWidth = "0";

    const label = document.createElement("div");
    label.className = "arc-att-label";
    label.innerText = s.label;

    const select = document.createElement("select");
    select.id = `att-select-${s.key}`;
    select.className = "arc-select";

    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.innerText = "None";
    select.appendChild(noneOpt);

    let attList = attachmentsDatabase.filter((a) => a.slot === s.key);

    if (s.key === "magazine") {
      const mt = (weapon.magType || "").toLowerCase();
      if (mt === "medium") attList = attList.filter((a) => a.id.includes("_med_mag_"));
      else if (mt === "shotgun") attList = attList.filter((a) => a.id.includes("_shotgun_mag_"));
      else if (mt === "light" || mt === "") attList = attList.filter((a) => a.id.includes("_light_mag_"));
      else {
        console.warn(`Unknown magType "${weapon.magType}" on weapon "${weapon.name}", showing all magazines`);
      }
    }

    for (const a of attList) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.innerText = a.name;
      select.appendChild(opt);
    }

    select.value = d.atts[s.key] || "";

    const hint = document.createElement("div");
    hint.className = "arc-att-hint";
    const current = d.atts[s.key] ? getAttachmentById(d.atts[s.key]) : null;
    hint.innerText = current ? (current.effect || current.crafting || "") : "";

    select.addEventListener("change", () => {
      const cur = select.value ? getAttachmentById(select.value) : null;
      hint.innerText = cur ? (cur.effect || cur.crafting || "") : "";
      iconImg.src = getAttIconSrc(s.key, select.value || null, weapon);
      iconImg.style.opacity = select.value ? "1" : "0.35";
    });

    rightSide.appendChild(label);
    rightSide.appendChild(select);
    rightSide.appendChild(hint);

    row.appendChild(iconWrap);
    row.appendChild(rightSide);

    slotsWrap.appendChild(row);
  }

  $("att-modal").classList.add("is-open");
}

function saveAttachmentsModal() {
  if (!attModalTarget) return;

  const { cat, idx } = attModalTarget;
  const cont = getContainer(cat);
  const d = cont?.[idx];
  if (!d) { closeAttachmentsModal(); return; }

  const weapon = getItemById(d.id);
  if (!weapon || weapon.category !== "equipment") { closeAttachmentsModal(); return; }

  saveState();

  ensureWeaponAtts(d);
  const slotDefs = getWeaponAttachmentSlotDefs(weapon);

  for (const s of slotDefs) {
    const sel = $(`att-select-${s.key}`);
    d.atts[s.key] = sel?.value ? sel.value : null;
  }

  ensureWeaponAtts(d);

  closeAttachmentsModal();
  commitState();
  showToast("Attachments updated");
}

function closeAttachmentsModal() {
  const wrap = $("att-modal");
  if (!wrap) return;
  wrap.classList.remove("is-open");
  attModalTarget = null;
}
document.addEventListener("click", () => {
  hideContextMenu();
});
document.addEventListener("contextmenu", (e) => {
  if (e.defaultPrevented) return;
  const menu = $("context-menu");
  if (!menu) return;
  const inside = e.target.closest && e.target.closest("#context-menu");
  if (!inside) hideContextMenu();
});

// ------------------------------------------------------------
window.addEventListener("DOMContentLoaded", init);