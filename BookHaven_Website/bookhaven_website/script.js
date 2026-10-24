const API = "https://openlibrary.org";
const grid = document.getElementById("bookGrid");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const searchForm = document.getElementById("searchForm");
const resultsTitle = document.getElementById("resultsTitle");
const resultsSubtitle = document.getElementById("resultsSubtitle");
const sortSelect = document.getElementById("sortSelect");
const loadMoreBtn = document.getElementById("loadMore");
const savedToggle = document.getElementById("savedToggle");
const savedCount = document.getElementById("savedCount");
let currentBooks = [];
let currentQuery = "";
let page = 1;
let showingSaved = false;
let savedBooks = JSON.parse(localStorage.getItem("bookhaven-saved") || "{}");

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function updateSavedCount() {
  savedCount.textContent = Object.keys(savedBooks).length;
}
function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function bookKey(book) { return book.key || `${book.title}-${book.author_name?.[0] || ""}`; }
function coverURL(book, size = "L") {
  if (book.cover_i) return `https://covers.openlibrary.org/b/id/${book.cover_i}-${size}.jpg`;
  return "";
}
function pickGenre(book) {
  const subjects = (book.subject || []).join(" ").toLowerCase();
  if (/romance|love stories/.test(subjects)) return "Romance";
  if (/fantasy|magic|fairy tales/.test(subjects)) return "Fantasy";
  if (/mystery|detective|crime/.test(subjects)) return "Mystery";
  if (/science fiction|space|robots/.test(subjects)) return "Sci-fi";
  if (/self-help|personal growth|psychology/.test(subjects)) return "Self-growth";
  if (/history|biography/.test(subjects)) return "History";
  if (/poetry/.test(subjects)) return "Poetry";
  if (/horror|ghost/.test(subjects)) return "Horror";
  return book.subject?.[0] ? book.subject[0].split(" ").slice(0, 2).join(" ") : "Explore";
}
function normaliseBook(book) {
  return {
    ...book,
    title: book.title || "Untitled book",
    author_name: book.author_name || ["Author not listed"],
    first_publish_year: book.first_publish_year || null,
    subject: book.subject || [],
    average_rating: book.ratings_average || null,
    ratings_count: book.ratings_count || 0
  };
}
function sortBooks(books) {
  const value = sortSelect.value;
  const copy = [...books];
  if (value === "title") copy.sort((a,b) => a.title.localeCompare(b.title));
  if (value === "rating") copy.sort((a,b) => (b.average_rating || 0) - (a.average_rating || 0));
  return copy;
}
function renderBooks() {
  const books = sortBooks(currentBooks);
  updateSavedCount();
  if (!books.length) {
    grid.innerHTML = `<div class="empty-state"><strong>No books found just yet.</strong>Try another title, author, or genre.</div>`;
    loadMoreBtn.hidden = true;
    return;
  }
  grid.innerHTML = books.map((book, index) => {
    const key = bookKey(book);
    const isSaved = Boolean(savedBooks[key]);
    const cover = coverURL(book);
    const title = escapeHTML(book.title);
    const author = escapeHTML(book.author_name?.[0] || "Author not listed");
    const genre = escapeHTML(pickGenre(book));
    const year = book.first_publish_year || "Year unknown";
    const rating = book.average_rating ? Number(book.average_rating).toFixed(1) : "N/A";
    const ratingCount = book.ratings_count ? ` · ${Number(book.ratings_count).toLocaleString()} ratings` : "";
    const openUrl = book.key ? `${API}${book.key}` : "https://openlibrary.org";
    return `<article class="book-card">
      <div class="cover-wrap">
        ${cover ? `<img src="${cover}" alt="Cover of ${title}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ""}
        <div class="cover-placeholder" style="${cover ? "display:none" : ""}"><span class="placeholder-symbol">✦</span><strong>${title}</strong><small>${author}</small></div>
        <button class="save-book ${isSaved ? "saved" : ""}" type="button" data-save="${escapeHTML(key)}" aria-label="${isSaved ? "Remove from" : "Add to"} my shelf">${isSaved ? "♥" : "♡"}</button>
      </div>
      <div class="book-info">
        <span class="book-category">${genre}</span>
        <h3 class="book-title">${title}</h3>
        <div class="book-author">by ${author}</div>
        <div class="book-meta"><span>${year}</span><span class="rating"><span>★</span>${rating}<span style="color:#929084;font-weight:400">${escapeHTML(ratingCount)}</span></span></div>
        <div style="margin-top:12px"><a href="${escapeHTML(openUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:#42634a;text-decoration:none;font-weight:700">View book details ↗</a></div>
      </div>
    </article>`;
  }).join("");
  loadMoreBtn.hidden = showingSaved || !currentQuery;
}
async function searchBooks(query, nextPage = false) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    notify("Type a book, author, or genre to search.");
    searchInput.focus();
    return;
  }
  if (!nextPage) {
    currentQuery = cleanQuery;
    page = 1;
    showingSaved = false;
    savedToggle.classList.remove("active");
    resultsTitle.textContent = `Books for “${cleanQuery}”`;
    resultsSubtitle.textContent = "Titles, authors, publication years, covers and available ratings.";
    grid.innerHTML = "";
  } else {
    page += 1;
  }
  statusEl.innerHTML = `<span class="loader"></span> Searching the shelves...`;
  statusEl.style.display = "block";
  loadMoreBtn.hidden = true;
  try {
    const url = `${API}/search.json?q=${encodeURIComponent(currentQuery)}&page=${page}&limit=12`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("The book service is unavailable right now.");
    const data = await response.json();
    const results = (data.docs || []).map(normaliseBook);
    currentBooks = nextPage ? [...currentBooks, ...results] : results;
    statusEl.textContent = results.length ? `Found ${data.numFound.toLocaleString()} matching book records.` : "No matching books found. Try a different search.";
    if (!data.numFound) currentBooks = [];
    renderBooks();
    loadMoreBtn.hidden = !(data.numFound > page * 12);
  } catch (error) {
    statusEl.textContent = "Couldn't connect to the book catalogue. Check your internet connection and try again.";
    if (!nextPage) {
      grid.innerHTML = `<div class="empty-state"><strong>Your book search is taking a little break.</strong>Connect to the internet and refresh this page to search the live catalogue.</div>`;
    }
  }
}
function showSaved() {
  showingSaved = true;
  currentQuery = "";
  currentBooks = Object.values(savedBooks).map(normaliseBook);
  resultsTitle.textContent = "Your personal bookshelf";
  resultsSubtitle.textContent = "Books you have saved for another day.";
  statusEl.textContent = currentBooks.length ? "Your saved reads, all in one place." : "Your shelf is waiting for its first book.";
  statusEl.style.display = "block";
  renderBooks();
  loadMoreBtn.hidden = true;
  document.getElementById("popular").scrollIntoView({ behavior: "smooth" });
}
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  searchBooks(searchInput.value);
  document.getElementById("popular").scrollIntoView({ behavior: "smooth" });
});
document.querySelectorAll("[data-query]").forEach(button => {
  button.addEventListener("click", () => {
    const query = button.dataset.query;
    searchInput.value = query;
    searchBooks(query);
    document.getElementById("popular").scrollIntoView({ behavior: "smooth" });
  });
});
grid.addEventListener("click", event => {
  const button = event.target.closest("[data-save]");
  if (!button) return;
  const key = button.dataset.save;
  const book = currentBooks.find(item => bookKey(item) === key);
  if (savedBooks[key]) {
    delete savedBooks[key];
    notify("Removed from your shelf.");
  } else if (book) {
    savedBooks[key] = book;
    notify("Saved to your personal shelf ♥");
  }
  localStorage.setItem("bookhaven-saved", JSON.stringify(savedBooks));
  updateSavedCount();
  if (showingSaved) showSaved();
  else renderBooks();
});
savedToggle.addEventListener("click", showSaved);
sortSelect.addEventListener("change", renderBooks);
loadMoreBtn.addEventListener("click", () => searchBooks(currentQuery, true));
updateSavedCount();
searchBooks("bestselling fiction");
