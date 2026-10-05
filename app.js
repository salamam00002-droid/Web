import { firebaseConfig, ADMIN_EMAIL, STORE } from "./firebase-config.js";

const CATEGORIES = ["كابينة", "متوسطة", "كبيرة", "حقائب ظهر", "أطقم"];
const STATUSES = ["جديد", "قيد التجهيز", "تم الشحن", "تم التسليم", "ملغي"];
const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR");

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG") + " " + STORE.currency;
const toEnDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#2F6FED");
const safeImg = (u) => (/^(https:\/\/|data:image\/)/i.test(u || "") ? u : "");

function bagSVG(color) {
  const c = safeColor(color);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'><rect width='300' height='300' fill='#EEF2F6'/><rect x='108' y='36' width='84' height='36' rx='12' fill='none' stroke='#16233B' stroke-width='10'/><rect x='64' y='62' width='172' height='198' rx='26' fill='${c}'/><g stroke='rgba(0,0,0,.18)' stroke-width='8' stroke-linecap='round'><path d='M112 92v138M150 92v138M188 92v138'/></g><rect x='132' y='214' width='36' height='16' rx='5' fill='#FFC428'/><circle cx='104' cy='274' r='11' fill='#16233B'/><circle cx='196' cy='274' r='11' fill='#16233B'/></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
const imgOf = (p) => safeImg(p.image) || bagSVG(p.color);

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

function compressImage(file, max = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ---------- data layer (Firebase أو وضع تجريبي) ---------- */
let fb = null;
const LS = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const SEED = [
  { name: "كابينة صلبة 20 بوصة", price: 1450, category: "كابينة", color: "#2F6FED", stock: 12, desc: "خفيفة ومقاسها مناسب لحقيبة الطيران اليدوية، بقفل TSA وأربع عجلات 360°." },
  { name: "شنطة متوسطة 24 بوصة", price: 1950, category: "متوسطة", color: "#1E8E5A", stock: 8, desc: "مساحة كبيرة لأسبوع سفر، بطانة داخلية بسوست وجيوب تنظيم." },
  { name: "شنطة كبيرة 28 بوصة", price: 2450, category: "كبيرة", color: "#C93C3C", stock: 5, desc: "للرحلات الطويلة، هيكل قوي مقاوم للصدمات وقابلة للتوسعة." },
  { name: "طقم 3 قطع", price: 4900, category: "أطقم", color: "#16233B", stock: 4, desc: "كابينة ومتوسطة وكبيرة بنفس التصميم، توفير أكتر من شراء كل قطعة لوحدها." },
  { name: "شنطة ظهر للسفر 40 لتر", price: 1250, category: "حقائب ظهر", color: "#8A5CF6", stock: 15, desc: "فتحة أمامية كاملة وجيب مخصص للابتوب وحزام صدر مريح." },
  { name: "كابينة قماش خفيفة", price: 1150, category: "كابينة", color: "#E5A400", stock: 0, desc: "قماش مقاوم للماء ووزن أقل من 2.5 كجم." },
].map((p, i) => ({ ...p, id: "demo" + i, createdAt: Date.now() - i * 1000 }));

async function initData() {
  if (DEMO) { $("#demoBar").hidden = false; return; }
  const base = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [app, fs, auth] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-firestore.js"),
    import(base + "firebase-auth.js"),
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { fs, auth, db: fs.getFirestore(a), au: auth.getAuth(a) };
}

const api = {
  async products() {
    if (DEMO) { if (!localStorage.getItem("sf_products")) LS.set("sf_products", SEED); return LS.get("sf_products", []); }
    const { fs, db } = fb;
    const snap = await fs.getDocs(fs.query(fs.collection(db, "products"), fs.orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async saveProduct(p) {
    if (DEMO) {
      const list = LS.get("sf_products", []);
      if (p.id) { const i = list.findIndex((x) => x.id === p.id); list[i] = { ...list[i], ...p }; }
      else list.unshift({ ...p, id: "p" + Date.now(), createdAt: Date.now() });
      return LS.set("sf_products", list);
    }
    const { fs, db } = fb;
    const { id, ...data } = p;
    if (id) return fs.setDoc(fs.doc(db, "products", id), data, { merge: true });
    return fs.addDoc(fs.collection(db, "products"), { ...data, createdAt: Date.now() });
  },
  async deleteProduct(id) {
    if (DEMO) return LS.set("sf_products", LS.get("sf_products", []).filter((x) => x.id !== id));
    return fb.fs.deleteDoc(fb.fs.doc(fb.db, "products", id));
  },
  async createOrder(o) {
    if (DEMO) { const list = LS.get("sf_orders", []); const id = "o" + Date.now(); list.unshift({ ...o, id }); LS.set("sf_orders", list); return id; }
    const ref = await fb.fs.addDoc(fb.fs.collection(fb.db, "orders"), o);
    return ref.id;
  },
  async orders() {
    if (DEMO) return LS.get("sf_orders", []);
    const { fs, db } = fb;
    const snap = await fs.getDocs(fs.query(fs.collection(db, "orders"), fs.orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async setStatus(id, status) {
    if (DEMO) { const l = LS.get("sf_orders", []); const o = l.find((x) => x.id === id); if (o) o.status = status; return LS.set("sf_orders", l); }
    return fb.fs.updateDoc(fb.fs.doc(fb.db, "orders", id), { status });
  },
  async login(email, password) {
    if (DEMO) { if (password !== "demo123") throw new Error("demo"); sessionStorage.setItem("sf_admin", "1"); return; }
    await fb.auth.signInWithEmailAndPassword(fb.au, email, password);
    if (ADMIN_EMAIL && fb.au.currentUser.email !== ADMIN_EMAIL) { await fb.auth.signOut(fb.au); throw new Error("not-admin"); }
  },
  async logout() {
    if (DEMO) return sessionStorage.removeItem("sf_admin");
    return fb.auth.signOut(fb.au);
  },
  isAdmin() {
    if (DEMO) return sessionStorage.getItem("sf_admin") === "1";
    const u = fb.au.currentUser;
    return !!u && (!ADMIN_EMAIL || u.email === ADMIN_EMAIL);
  },
  async authReady() {
    if (DEMO) return;
    await new Promise((res) => { const off = fb.auth.onAuthStateChanged(fb.au, () => { off(); res(); }); });
  },
};

/* ---------- state ---------- */
const state = {
  products: [],
  cat: "الكل",
  q: "",
  sort: "new",
  cart: LS.get("sf_cart", []), // [{id, qty}]
};
const byId = (id) => state.products.find((p) => p.id === id);
const saveCart = () => { LS.set("sf_cart", state.cart); renderCartCount(); };

/* ---------- storefront ---------- */
function renderChips() {
  $("#chips").innerHTML = ["الكل", ...CATEGORIES]
    .map((c) => `<button class="chip" role="tab" aria-selected="${c === state.cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

function visibleProducts() {
  let list = state.products.filter((p) =>
    (state.cat === "الكل" || p.category === state.cat) &&
    (!state.q || (p.name + " " + (p.desc || "")).toLowerCase().includes(state.q.toLowerCase())));
  if (state.sort === "low") list.sort((a, b) => a.price - b.price);
  if (state.sort === "high") list.sort((a, b) => b.price - a.price);
  return list;
}

function renderGrid() {
  const list = visibleProducts();
  $("#grid").innerHTML = list.length
    ? list.map((p) => `
      <article class="card">
        <div class="card-img"><img src="${esc(imgOf(p))}" alt="${esc(p.name)}" loading="lazy">${p.stock <= 0 ? '<span class="sold">نفدت الكمية</span>' : ""}</div>
        <div class="card-body">
          <span class="cat">${esc(p.category)}</span>
          <h3>${esc(p.name)}</h3>
          <p class="desc">${esc(p.desc)}</p>
          <div class="card-foot">
            <span class="price">${fmt(p.price)}</span>
            <button class="btn btn-sun btn-sm" data-add="${esc(p.id)}" ${p.stock <= 0 ? "disabled" : ""}>أضف للسلة</button>
          </div>
        </div>
      </article>`).join("")
    : `<div class="empty">مفيش حقائب مطابقة. جرّب تصنيف تاني أو كلمة بحث مختلفة.</div>`;
}

function renderHero() {
  const p = state.products.find((x) => x.stock > 0);
  $("#heroTag").innerHTML = p
    ? `<article class="tag">
         <img src="${esc(imgOf(p))}" alt="${esc(p.name)}">
         <div class="tag-info"><b>${esc(p.name)}</b><span class="price">${fmt(p.price)}</span></div>
         <button class="btn btn-primary" data-add="${esc(p.id)}">أضف للسلة</button>
       </article>`
    : "";
}

/* ---------- cart ---------- */
function renderCartCount() {
  const n = state.cart.reduce((s, i) => s + i.qty, 0);
  const b = $("#cartCount");
  b.textContent = n.toLocaleString("ar-EG");
  b.hidden = n === 0;
}
function cartLines() {
  return state.cart.map((i) => ({ ...i, p: byId(i.id) })).filter((l) => l.p);
}
function renderCart() {
  const lines = cartLines();
  $("#cartItems").innerHTML = lines.length
    ? lines.map((l) => `
      <div class="cart-row">
        <img src="${esc(imgOf(l.p))}" alt="">
        <div><b>${esc(l.p.name)}</b><span class="price">${fmt(l.p.price)}</span>
          <div class="qty"><button data-dec="${esc(l.id)}" aria-label="تقليل">−</button><span>${l.qty.toLocaleString("ar-EG")}</span><button data-inc="${esc(l.id)}" aria-label="زيادة">+</button></div></div>
        <button class="icon-btn" data-rm="${esc(l.id)}" aria-label="حذف">✕</button>
      </div>`).join("")
    : `<p class="empty" style="margin-top:24px">السلة فاضية. ضيف شنطة تعجبك وهتظهر هنا.</p>`;
  $("#cartTotal").textContent = fmt(lines.reduce((s, l) => s + l.p.price * l.qty, 0));
  $("#goCheckout").disabled = !lines.length;
}
function openCart() { renderCart(); $("#cart").hidden = false; $("#scrim").hidden = false; }
function closeCart() { $("#cart").hidden = true; $("#scrim").hidden = true; }

function addToCart(id) {
  const p = byId(id);
  if (!p || p.stock <= 0) return;
  const line = state.cart.find((i) => i.id === id);
  if (line) { if (line.qty >= p.stock) return toast("وصلت لأقصى كمية متاحة"); line.qty++; }
  else state.cart.push({ id, qty: 1 });
  saveCart();
  toast("اتضافت للسلة");
}

/* ---------- checkout ---------- */
async function submitOrder(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const phone = toEnDigits(f.get("phone")).replace(/\s|-/g, "");
  const err = $("#orderError");
  err.hidden = true;
  if (!/^01[0125]\d{8}$/.test(phone)) { err.textContent = "رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01."; err.hidden = false; return; }
  const lines = cartLines();
  if (!lines.length) return;
  const order = {
    name: String(f.get("name")).trim(),
    phone,
    city: String(f.get("city")).trim(),
    address: String(f.get("address")).trim(),
    notes: String(f.get("notes") || "").trim(),
    items: lines.map((l) => ({ id: l.id, name: l.p.name, price: l.p.price, qty: l.qty })),
    total: lines.reduce((s, l) => s + l.p.price * l.qty, 0),
    status: "جديد",
    createdAt: Date.now(),
  };
  const btn = $("#submitOrder");
  btn.disabled = true; btn.textContent = "جاري إرسال الطلب...";
  try {
    const id = await api.createOrder(order);
    state.cart = []; saveCart(); closeCart();
    $("#checkout").close(); e.target.reset();
    $("#doneText").textContent = `رقم طلبك ${id.slice(-6).toUpperCase()}. هنكلمك على ${phone} لتأكيد التوصيل.`;
    $("#done").showModal();
  } catch (x) {
    console.error(x);
    err.textContent = "معرفناش نبعت الطلب. اتأكد من النت وجرّب تاني.";
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "تأكيد الطلب";
  }
}

/* ---------- admin ---------- */
async function renderAdmin() {
  const ok = api.isAdmin();
  $("#loginBox").hidden = ok;
  $("#adminPanel").hidden = !ok;
  $("#loginHint").textContent = DEMO ? "الوضع التجريبي: اكتب أي إيميل وكلمة المرور demo123" : "";
  if (!ok) return;
  await Promise.all([renderAdminProducts(), renderAdminOrders()]);
}

async function renderAdminProducts() {
  state.products = await api.products();
  $("#adminProducts").innerHTML = state.products.length
    ? state.products.map((p) => `
      <div class="item">
        <img src="${esc(imgOf(p))}" alt="">
        <div><b>${esc(p.name)}</b><div class="meta">${esc(p.category)} · ${fmt(p.price)} · المتاح ${Number(p.stock).toLocaleString("ar-EG")}</div></div>
        <div class="acts"><button class="btn btn-ghost btn-sm" data-edit="${esc(p.id)}">تعديل</button><button class="btn btn-danger btn-sm" data-del="${esc(p.id)}">حذف</button></div>
      </div>`).join("")
    : `<div class="empty">لسه مفيش منتجات. دوس "إضافة منتج" وابدأ.</div>`;
}

async function renderAdminOrders() {
  let orders = [];
  try { orders = await api.orders(); } catch (e) { console.error(e); }
  const fresh = orders.filter((o) => o.status === "جديد").length;
  const revenue = orders.filter((o) => o.status !== "ملغي").reduce((s, o) => s + (o.total || 0), 0);
  $("#stats").innerHTML = `<div class="stat"><b>${fresh.toLocaleString("ar-EG")}</b><span>طلبات جديدة</span></div>
    <div class="stat"><b>${orders.length.toLocaleString("ar-EG")}</b><span>كل الطلبات</span></div>
    <div class="stat"><b>${fmt(revenue)}</b><span>إجمالي المبيعات</span></div>`;
  $("#adminOrders").innerHTML = orders.length
    ? orders.map((o) => {
        const wa = "https://wa.me/2" + esc(o.phone) + "?text=" + encodeURIComponent(`أهلاً ${o.name}، بخصوص طلبك من ${STORE.name}`);
        return `<div class="order">
          <div class="order-top"><b>${esc(o.name)}</b><span class="st">${esc(o.status)}</span></div>
          <div class="meta">${new Date(o.createdAt).toLocaleString("ar-EG")} · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a> · <a href="${wa}" target="_blank" rel="noopener">واتساب</a></div>
          <div>${esc(o.city)} - ${esc(o.address)}${o.notes ? `<br><span class="meta">ملاحظات: ${esc(o.notes)}</span>` : ""}</div>
          <ul>${(o.items || []).map((i) => `<li>${esc(i.name)} × ${Number(i.qty).toLocaleString("ar-EG")}</li>`).join("")}</ul>
          <div class="order-top"><b>${fmt(o.total)}</b>
            <select data-status="${esc(o.id)}" aria-label="حالة الطلب">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        </div>`;
      }).join("")
    : `<div class="empty">مفيش طلبات لحد دلوقتي.</div>`;
}

function openProductDlg(p) {
  const f = $("#productForm");
  f.reset();
  f.dataset.id = p?.id || "";
  $("#productDlgTitle").textContent = p ? "تعديل المنتج" : "منتج جديد";
  f.elements.name.value = p?.name || "";
  f.price.value = p?.price ?? "";
  f.stock.value = p?.stock ?? 10;
  f.category.value = p?.category || CATEGORIES[0];
  f.color.value = safeColor(p?.color);
  f.desc.value = p?.desc || "";
  f.dataset.image = p?.image || "";
  f.imageUrl.value = p?.image && !p.image.startsWith("data:") ? p.image : "";
  $("#imgPreview").src = imgOf(p || { color: f.color.value });
  $("#productError").hidden = true;
  $("#productDlg").showModal();
}

async function saveProduct(e) {
  e.preventDefault();
  const f = e.target;
  const err = $("#productError");
  err.hidden = true;
  const url = f.imageUrl.value.trim();
  if (url && !safeImg(url)) { err.textContent = "رابط الصورة لازم يبدأ بـ https://"; err.hidden = false; return; }
  const data = {
    name: f.elements.name.value.trim(),
    price: Number(f.price.value),
    stock: Number(f.stock.value),
    category: f.category.value,
    color: f.color.value,
    desc: f.desc.value.trim(),
    image: url || f.dataset.image || "",
  };
  if (f.dataset.id) data.id = f.dataset.id;
  const btn = $("#saveProduct");
  btn.disabled = true;
  try {
    await api.saveProduct(data);
    $("#productDlg").close();
    toast("تم حفظ المنتج");
    await renderAdminProducts();
  } catch (x) {
    console.error(x);
    err.textContent = "معرفناش نحفظ المنتج. اتأكد إنك مسجل دخول بحساب الأدمن.";
    err.hidden = false;
  } finally { btn.disabled = false; }
}

/* ---------- routing ---------- */
async function route() {
  const admin = location.hash === "#admin";
  $("#storeView").hidden = admin;
  $("#adminView").hidden = !admin;
  if (admin) { await api.authReady(); renderAdmin(); }
  else if (location.hash !== "#shop") window.scrollTo(0, 0);
}

async function loadProducts() {
  try { state.products = await api.products(); }
  catch (e) { console.error(e); toast("مقدرناش نحمّل المنتجات. اتأكد من إعدادات Firebase."); state.products = []; }
  renderHero(); renderGrid();
}

/* ---------- events ---------- */
function bind() {
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button,a");
    if (!t) return;
    const d = t.dataset;
    if (d.add) addToCart(d.add);
    if (d.inc) { const l = state.cart.find((i) => i.id === d.inc); if (l && l.qty < (byId(d.inc)?.stock ?? 0)) { l.qty++; saveCart(); renderCart(); } }
    if (d.dec) { const l = state.cart.find((i) => i.id === d.dec); if (l) { l.qty--; if (l.qty <= 0) state.cart = state.cart.filter((i) => i !== l); saveCart(); renderCart(); } }
    if (d.rm) { state.cart = state.cart.filter((i) => i.id !== d.rm); saveCart(); renderCart(); }
    if (d.cat) { state.cat = d.cat; renderChips(); renderGrid(); }
    if (d.edit) openProductDlg(byId(d.edit));
    if (d.del && confirm("متأكد إنك عايز تحذف المنتج ده؟")) { await api.deleteProduct(d.del); toast("تم حذف المنتج"); renderAdminProducts(); }
    if (d.tab) {
      $$(".tab").forEach((b) => b.classList.toggle("on", b === t));
      $("#tabProducts").hidden = d.tab !== "products";
      $("#tabOrders").hidden = d.tab !== "orders";
    }
  });
  document.addEventListener("change", async (e) => {
    if (e.target.dataset.status) { await api.setStatus(e.target.dataset.status, e.target.value); toast("تم تحديث حالة الطلب"); renderAdminOrders(); }
  });

  $("#openCart").onclick = openCart;
  $("#closeCart").onclick = closeCart;
  $("#scrim").onclick = closeCart;
  $("#goCheckout").onclick = () => { closeCart(); $("#checkout").showModal(); };
  $("#orderForm").onsubmit = submitOrder;
  $("#search").oninput = (e) => { state.q = e.target.value.trim(); renderGrid(); };
  $("#sort").onchange = (e) => { state.sort = e.target.value; renderGrid(); };

  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await api.login(f.get("email"), f.get("password")); renderAdmin(); }
    catch (x) { $("#loginHint").textContent = x.message === "not-admin" ? "الحساب ده مش أدمن." : "الإيميل أو كلمة المرور غلط."; }
  };
  $("#logout").onclick = async () => { await api.logout(); renderAdmin(); };
  $("#addProduct").onclick = () => openProductDlg(null);
  $("#productForm").onsubmit = saveProduct;
  $("#imgFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await compressImage(file);
      $("#productForm").dataset.image = data;
      $("#imageUrl").value = "";
      $("#imgPreview").src = data;
    } catch { toast("الصورة دي مش مدعومة"); }
  };
  $("#productForm").color.oninput = (e) => {
    const f = $("#productForm");
    if (!f.dataset.image && !f.imageUrl.value) $("#imgPreview").src = bagSVG(e.target.value);
  };
  window.addEventListener("hashchange", route);
}

/* ---------- init ---------- */
(async function init() {
  $("#brandName").textContent = STORE.name;
  $("#footName").textContent = "© " + STORE.name;
  $("#waLink").href = "https://wa.me/" + STORE.whatsapp;
  document.title = STORE.name + " | حقائب سفر";
  $("#catSelect").innerHTML = CATEGORIES.map((c) => `<option>${c}</option>`).join("");
  renderChips(); renderCartCount(); bind();
  try { await initData(); } catch (e) { console.error(e); toast("فشل تحميل Firebase. راجع الإعدادات."); }
  await loadProducts();
  route();
})();
