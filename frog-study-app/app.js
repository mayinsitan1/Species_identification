const state = {
  query: "",
  region: "全部",
  family: "全部",
  sortByTaxonomy: true,
  activeView: "browseView",
  quizMode: "audio",
  quiz: null,
  mastered: new Set(JSON.parse(localStorage.getItem("frog-mastered") || "[]")),
  favorites: new Set(JSON.parse(localStorage.getItem("frog-favorites") || "[]")),
};
let offlineWarmupScheduled = false;

const speciesById = new Map(FROG_DATA.species.map((item) => [item.spid, item]));
const families = [...new Map(FROG_DATA.species.map((item) => [item.family, item.familyLatin])).entries()]
  .map(([name, latin]) => ({ name, latin }));

const els = {
  searchInput: document.querySelector("#searchInput"),
  regionFilters: document.querySelector("#regionFilters"),
  familyFilterSection: document.querySelector("#familyFilterSection"),
  familyFilters: document.querySelector("#familyFilters"),
  speciesList: document.querySelector("#speciesList"),
  familyGroups: document.querySelector("#familyGroups"),
  familySummary: document.querySelector("#familySummary"),
  sortToggle: document.querySelector("#sortToggle"),
  shareButton: document.querySelector("#shareButton"),
  randomButton: document.querySelector("#randomButton"),
  masteredCount: document.querySelector("#masteredCount"),
  speciesCount: document.querySelector("#speciesCount"),
  photoCount: document.querySelector("#photoCount"),
  audioCount: document.querySelector("#audioCount"),
  detailDialog: document.querySelector("#detailDialog"),
  detailContent: document.querySelector("#detailContent"),
  closeDetail: document.querySelector("#closeDetail"),
  quizCard: document.querySelector("#quizCard"),
  nextQuiz: document.querySelector("#nextQuiz"),
};

function saveProgress() {
  localStorage.setItem("frog-mastered", JSON.stringify([...state.mastered]));
  localStorage.setItem("frog-favorites", JSON.stringify([...state.favorites]));
}

function textIncludes(value, query) {
  return (value || "").toLowerCase().includes(query);
}

function smallThumbUrl(url) {
  return url && url.startsWith("thumbs/") ? url.replace("thumbs/", "thumbs-small/") : url;
}

function hasGuangdongDistribution(item) {
  const distribution = item.distribution || "";
  if (distribution.includes("广东")) return true;

  const broadChinaPatterns = [
    "广布于全国",
    "全国各省",
    "大部分省",
    "大多数省",
    "多数省",
  ];
  const southChinaPatterns = [
    "长江以南",
    "长江流域及以南",
    "华南",
    "中国南部",
    "我国南部",
    "南方",
    "南部各省",
    "从四川东部及云南到浙江",
    "从云南南部到浙江",
  ];
  const excludesGuangdong = /除[^；。]*广东/.test(distribution);
  return !excludesGuangdong && [...broadChinaPatterns, ...southChinaPatterns].some((pattern) => distribution.includes(pattern));
}

function matchesRegion(item) {
  const inGuangdong = hasGuangdongDistribution(item);
  return state.region === "全部"
    || (state.region === "在广东有分布" && inGuangdong)
    || (state.region === "在广东无分布" && !inGuangdong);
}

function matchesRegionAndFamily(item) {
  const matchRegion = matchesRegion(item);
  const matchFamily = state.family === "全部" || item.family === state.family;
  return matchRegion && matchFamily;
}

function quizPool() {
  return FROG_DATA.species.filter((item) => {
    const hasRequiredMedia = state.quizMode === "audio" ? item.audios.length : item.photos.length;
    return matchesRegionAndFamily(item) && hasRequiredMedia;
  });
}

function filteredSpecies() {
  const query = state.query.trim().toLowerCase();
  let list = FROG_DATA.species.filter((item) => {
    const matchQuery = !query || [
      item.cname,
      item.latin,
      item.family,
      item.familyLatin,
      item.genus,
      item.genusLatin,
      item.feature,
      item.distribution,
    ].some((field) => textIncludes(field, query));
    return matchesRegionAndFamily(item) && matchQuery;
  });

  if (state.sortByTaxonomy) {
    list = list.slice().sort((a, b) => {
      const taxonomy = `${a.familyLatin}|${a.genusLatin}|${a.latin}`;
      const otherTaxonomy = `${b.familyLatin}|${b.genusLatin}|${b.latin}`;
      return taxonomy.localeCompare(otherTaxonomy, "en");
    });
  }
  return list;
}

function renderStats() {
  els.speciesCount.textContent = FROG_DATA.species.length;
  els.photoCount.textContent = FROG_DATA.meta.photoCount;
  els.audioCount.textContent = FROG_DATA.meta.audioCount;
  els.masteredCount.textContent = state.mastered.size;
}

function renderFilters() {
  const guangdongCount = FROG_DATA.species.filter(hasGuangdongDistribution).length;
  const regions = [
    { name: "全部", count: FROG_DATA.species.length },
    { name: "在广东有分布", count: guangdongCount },
    { name: "在广东无分布", count: FROG_DATA.species.length - guangdongCount },
  ];
  els.regionFilters.innerHTML = regions.map((region) => `
    <button class="chip ${state.region === region.name ? "active" : ""}" data-region="${region.name}">
      ${region.name} · ${region.count}
    </button>
  `).join("");

  const all = [{ name: "全部", latin: `${FROG_DATA.species.length} 种` }, ...families];
  els.familyFilters.innerHTML = all.map((family) => `
    <button class="chip ${state.family === family.name ? "active" : ""}" data-family="${family.name}">
      ${family.name}
    </button>
  `).join("");
}

function cardTemplate(item) {
  const favorite = state.favorites.has(item.spid);
  const mastered = state.mastered.has(item.spid);
  const cover = item.cover || "";
  return `
    <article class="species-card" data-spid="${item.spid}">
      <div class="cover">
        ${cover ? `<img loading="lazy" decoding="async" src="${smallThumbUrl(cover)}" alt="${item.cname}">` : ""}
      </div>
      <div class="species-main">
        <div class="species-title">
          <div>
            <h3>${item.cname}</h3>
            <p class="latin">${item.latin}</p>
          </div>
          <button class="small-toggle ${favorite ? "active" : ""}" data-action="favorite" data-spid="${item.spid}" aria-label="收藏">★</button>
        </div>
        <div class="taxonomy">
          <span class="tag">${item.family}</span>
          <span class="tag">${item.genus}</span>
          ${mastered ? `<span class="tag">已掌握</span>` : ""}
        </div>
        <p class="feature">${item.feature || "暂无鉴别特征"}</p>
        <div class="card-actions">
          <span class="media-count">${item.photos.length} 图 · ${item.audios.length} 声</span>
          <button class="pill-button" data-action="open" data-spid="${item.spid}">学习</button>
        </div>
      </div>
    </article>
  `;
}

function renderSpeciesList() {
  const list = filteredSpecies();
  els.speciesList.innerHTML = list.length
    ? list.map(cardTemplate).join("")
    : `<div class="empty-state">没有找到匹配物种，换个关键词试试。</div>`;
}

function renderFamilies() {
  const visibleFamilies = families.map((family) => {
    const members = FROG_DATA.species.filter((item) => item.family === family.name && matchesRegion(item));
    const genusCount = new Set(members.map((item) => item.genus)).size;
    return { family, members, genusCount };
  }).filter((group) => group.members.length);
  const visibleSpeciesCount = visibleFamilies.reduce((total, group) => total + group.members.length, 0);
  els.familySummary.textContent = `${visibleFamilies.length} 科 · ${visibleSpeciesCount} 种`;
  els.familyGroups.innerHTML = visibleFamilies.length ? visibleFamilies.map(({ family, members, genusCount }) => {
    return `
      <article class="family-block">
        <h3>${family.name}</h3>
        <p class="latin">${family.latin} · ${genusCount} 属 · ${members.length} 种</p>
        <div class="family-species">
          ${members.map((item) => `<button class="chip" data-action="open" data-spid="${item.spid}">${item.cname}</button>`).join("")}
        </div>
      </article>
    `;
  }).join("") : `<div class="empty-state">当前地区筛选下没有匹配物种。</div>`;
}

function renderAll() {
  renderStats();
  renderFilters();
  renderSpeciesList();
  renderFamilies();
  updateQuizModeButtons();
}

function setView(viewId) {
  state.activeView = viewId;
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  document.body.classList.toggle("families-view-active", viewId === "familiesView");
  els.familyFilterSection.hidden = viewId === "familiesView";
  if (viewId === "quizView" && !state.quiz) {
    makeQuiz();
  }
}

function metadataLine(media) {
  return [media.type, media.place, media.date, media.time, media.author].filter(Boolean).join(" · ");
}

function openDetail(spid) {
  const item = speciesById.get(spid);
  if (!item) return;
  const cover = item.cover || "";
  const photos = item.photos.map((photo) => `
    <a href="${photo.file}" target="_blank" rel="noopener">
      <img loading="lazy" src="${photo.thumb || photo.file}" alt="${item.cname} ${photo.author || ""}">
    </a>
  `).join("");
  const audios = item.audios.map((audio, index) => `
    <div class="audio-item">
      <strong>${audio.type || `鸣声 ${index + 1}`}</strong>
      <p class="audio-meta">${metadataLine(audio)}</p>
      <audio controls preload="none" src="${audio.file}"></audio>
    </div>
  `).join("");

  els.detailContent.innerHTML = `
    <section class="detail-hero">
      ${cover ? `<img src="${cover}" alt="${item.cname}">` : ""}
    </section>
    <section class="detail-body">
      <h2>${item.cname}</h2>
      <p class="latin">${item.latin}</p>
      <div class="taxonomy">
        <span class="tag">${item.family} ${item.familyLatin}</span>
        <span class="tag">${item.genus} ${item.genusLatin}</span>
      </div>
      <div class="card-actions">
        <button class="pill-button" data-action="master" data-spid="${item.spid}">
          ${state.mastered.has(item.spid) ? "取消掌握" : "标记已掌握"}
        </button>
        <button class="text-button" data-action="favorite" data-spid="${item.spid}">
          ${state.favorites.has(item.spid) ? "取消收藏" : "收藏"}
        </button>
      </div>
      <div class="detail-grid">
        <div class="info-block">
          <h3>鉴别特征</h3>
          <p>${item.feature || "暂无"}</p>
        </div>
        <div class="info-block">
          <h3>分类地位</h3>
          <p>${item.family} ${item.familyLatin} → ${item.genus} ${item.genusLatin}</p>
        </div>
        <div class="info-block">
          <h3>分布范围</h3>
          <p>${item.distribution || "暂无"}</p>
        </div>
        <div class="info-block">
          <h3>生境与繁殖</h3>
          <p>${[item.habitat, item.breeding ? `繁殖季节：${item.breeding}` : ""].filter(Boolean).join(" ") || "暂无"}</p>
        </div>
      </div>
      <div class="info-block">
        <h3>习性</h3>
        <p>${item.habits || "暂无"}</p>
      </div>
      <div class="info-block">
        <h3>照片 ${item.photos.length}</h3>
        <div class="photo-grid">${photos || "暂无照片"}</div>
      </div>
      <div class="info-block">
        <h3>鸣声 ${item.audios.length}</h3>
        <div class="audio-list">${audios || "暂无鸣声"}</div>
      </div>
    </section>
  `;

  if (els.detailDialog.open) {
    return;
  }
  if (typeof els.detailDialog.showModal === "function") {
    els.detailDialog.showModal();
  } else {
    els.detailDialog.setAttribute("open", "");
  }
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  return list.map((value) => ({ value, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value);
}

function makeQuiz() {
  const candidates = quizPool();
  if (!candidates.length) {
    state.quiz = null;
    const modeText = state.quizMode === "audio" ? "鸣声" : "图片";
    els.quizCard.innerHTML = `<div class="empty-state">当前地区和科筛选下没有带${modeText}资源的可出题物种。</div>`;
    return;
  }
  const answer = randomFrom(candidates);
  const options = shuffle([
    answer,
    ...shuffle(candidates.filter((item) => item.spid !== answer.spid)).slice(0, 3),
  ]);
  state.quiz = { answer, mode: state.quizMode, options, answered: false };
  renderQuiz();
}

function updateQuizModeButtons() {
  document.querySelectorAll("[data-quiz-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.quizMode === state.quizMode);
  });
}

function renderQuizMedia(answer, mode) {
  if (mode === "audio") {
    return `
      <div class="quiz-body">
        <p>听鸣声，选择对应物种。</p>
        <div class="quiz-resource-list">
          ${answer.audios.map((audio, index) => `
            <div class="quiz-resource-item">
              <strong>鸣声段落 ${index + 1}</strong>
              <audio controls preload="none" src="${audio.file}"></audio>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="quiz-body">
      <p>看图片，选择对应物种。</p>
      <div class="quiz-photo-grid">
        ${answer.photos.map((photo, index) => `
          <figure>
            <img loading="lazy" src="${photo.thumb || photo.file}" alt="待识别物种图片 ${index + 1}">
            <figcaption>图片 ${index + 1}</figcaption>
          </figure>
        `).join("")}
      </div>
    </div>
  `;
}

function renderQuiz(feedback = "") {
  const quiz = state.quiz;
  if (!quiz) return;
  const { answer, mode, options } = quiz;
  const media = renderQuizMedia(answer, mode);

  els.quizCard.innerHTML = `
    ${media}
    <div class="quiz-body">
      <div class="answer-options">
        ${options.map((item) => `<button data-answer="${item.spid}">${item.cname}<br><span class="latin">${item.latin}</span></button>`).join("")}
      </div>
      ${feedback ? `<p class="quiz-feedback">${feedback}</p>` : ""}
      <div class="info-block">
        <h3>答案提示</h3>
        <p>${quiz.answered ? `${answer.cname}：${answer.feature || "暂无鉴别特征"}` : "作答后显示鉴别特征。"}</p>
      </div>
    </div>
  `;
}

function answerQuiz(spid) {
  if (!state.quiz || state.quiz.answered) return;
  state.quiz.answered = true;
  const correct = spid === state.quiz.answer.spid;
  renderQuiz(correct ? "答对了。" : `还差一点，答案是 ${state.quiz.answer.cname}。`);
  document.querySelectorAll("[data-answer]").forEach((button) => {
    const isAnswer = button.dataset.answer === state.quiz.answer.spid;
    const isChosen = button.dataset.answer === spid;
    button.classList.toggle("correct", isAnswer);
    button.classList.toggle("wrong", isChosen && !isAnswer);
  });
}

function handleAction(target) {
  const action = target.dataset.action;
  const spid = target.dataset.spid;
  if (!action || !spid) return false;

  if (action === "open") {
    openDetail(spid);
  }
  if (action === "favorite") {
    state.favorites.has(spid) ? state.favorites.delete(spid) : state.favorites.add(spid);
    saveProgress();
    renderAll();
    if (els.detailDialog.open) openDetail(spid);
  }
  if (action === "master") {
    state.mastered.has(spid) ? state.mastered.delete(spid) : state.mastered.add(spid);
    saveProgress();
    renderAll();
    if (els.detailDialog.open) openDetail(spid);
  }
  return true;
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget && handleAction(actionTarget)) return;

  const familyButton = event.target.closest("[data-family]");
  if (familyButton) {
    state.family = familyButton.dataset.family;
    state.quiz = null;
    renderAll();
    if (state.activeView === "quizView") makeQuiz();
    return;
  }

  const regionButton = event.target.closest("[data-region]");
  if (regionButton) {
    state.region = regionButton.dataset.region;
    state.quiz = null;
    renderAll();
    if (state.activeView === "quizView") makeQuiz();
    return;
  }

  const navButton = event.target.closest("[data-view]");
  if (navButton) {
    setView(navButton.dataset.view);
    return;
  }

  const answerButton = event.target.closest("[data-answer]");
  if (answerButton) {
    answerQuiz(answerButton.dataset.answer);
  }

  const quizModeButton = event.target.closest("[data-quiz-mode]");
  if (quizModeButton) {
    state.quizMode = quizModeButton.dataset.quizMode;
    state.quiz = null;
    updateQuizModeButtons();
    if (state.activeView === "quizView") makeQuiz();
  }
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderSpeciesList();
});

els.sortToggle.addEventListener("click", () => {
  state.sortByTaxonomy = !state.sortByTaxonomy;
  els.sortToggle.textContent = state.sortByTaxonomy ? "按分类排序" : "按原始顺序";
  renderSpeciesList();
});

els.randomButton.addEventListener("click", () => {
  const list = filteredSpecies();
  openDetail(randomFrom(list.length ? list : FROG_DATA.species).spid);
});

async function shareApp() {
  const shareData = {
    title: "无尾两栖类速学",
    text: "打开无尾两栖类速学网页，学习分类、照片和鸣声。",
    url: window.location.href,
  };
  if (navigator.share) {
    await navigator.share(shareData);
    return;
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(window.location.href);
    els.shareButton.textContent = "已复制";
    setTimeout(() => {
      els.shareButton.textContent = "分享";
    }, 1600);
  }
}

function uniqueThumbnailUrls() {
  return [...new Set(FROG_DATA.species.map((item) => smallThumbUrl(item.cover)).filter(Boolean))];
}

function runWhenIdle(task) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(task, { timeout: 6000 });
    return;
  }
  window.setTimeout(task, 2500);
}

async function warmOfflineThumbnails() {
  if (!("caches" in window)) return;
  const thumbUrls = uniqueThumbnailUrls();
  try {
    const cache = await caches.open("frog-study-media-v2");
    const pending = [];
    for (const url of thumbUrls) {
      const request = new Request(url);
      const cached = await cache.match(request);
      if (!cached) pending.push(request);
    }
    for (let index = 0; index < pending.length; index += 4) {
      await Promise.allSettled(pending.slice(index, index + 4).map((request) => cache.add(request)));
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  } catch (_) {
  }
}

function scheduleOfflineWarmup() {
  if (window.location.protocol === "file:") return;
  if (offlineWarmupScheduled) return;
  offlineWarmupScheduled = true;
  runWhenIdle(() => warmOfflineThumbnails());
}

els.shareButton.addEventListener("click", () => {
  shareApp().catch(() => {});
});
els.closeDetail.addEventListener("click", () => els.detailDialog.close());
els.detailDialog.addEventListener("click", (event) => {
  if (event.target === els.detailDialog) els.detailDialog.close();
});
els.nextQuiz.addEventListener("click", makeQuiz);

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  const rootScope = new URL("../", window.location.href).href;
  const rootWorker = new URL("../service-worker.js", window.location.href).href;
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations
      .filter((registration) => registration.scope !== rootScope)
      .map((registration) => registration.unregister())))
    .then(() => navigator.serviceWorker.register(rootWorker, { scope: rootScope }))
    .then(() => scheduleOfflineWarmup())
    .catch(() => {});
}

renderAll();
scheduleOfflineWarmup();
