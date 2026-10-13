/**
 * TEMPLATE-MANAGER.JS
 * Hệ thống Quản Lý Mẫu Thiết Kế Nội Bộ (Local Multi-Category Template Manager)
 * Lưu trữ bằng IndexedDB (fallback LocalStorage), hỗ trợ gán nhiều danh mục,
 * bộ lọc danh mục trực quan dạng Pills, thumbnail Canvas tự động.
 */

(function () {
    'use strict';

    // ==========================================
    // 1. CƠ SỞ DỮ LIỆU INDEXEDDB (STORAGE ENGINE)
    // ==========================================
    const DB_NAME = 'VipSimTemplateDB';
    const DB_VERSION = 1;
    const STORE_TEMPLATES = 'templates';
    const STORE_CATEGORIES = 'categories';
    const LS_BACKUP_KEY = 'VIP_SIM_LOCAL_TEMPLATES_BACKUP';

    const DEFAULT_CATEGORIES = [
        { id: 'cat_don', name: 'Mẫu Đơn', color: '#3498db' },
        { id: 'cat_kep', name: 'Mẫu Kép', color: '#9b59b6' },
        { id: 'cat_viettel', name: 'Mẫu Viettel', color: '#ee0033' },
        { id: 'cat_vina', name: 'Mẫu Vinaphone', color: '#0066cc' },
        { id: 'cat_mobi', name: 'Mẫu Mobifone', color: '#0055a6' },
        { id: 'cat_phongthuy', name: 'Mẫu Phong Thủy', color: '#27ae60' }
    ];

    let dbInstance = null;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (dbInstance) return resolve(dbInstance);
            if (!window.indexedDB) {
                console.warn("IndexedDB không được hỗ trợ, chuyển sang LocalStorage");
                return resolve(null);
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
                    const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
                    DEFAULT_CATEGORIES.forEach(cat => catStore.add(cat));
                }
                if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
                    const tplStore = db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
                    tplStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                resolve(dbInstance);
            };

            request.onerror = (e) => {
                console.error("Lỗi mở IndexedDB:", e);
                resolve(null); // Fallback
            };
        });
    }

    // Helper thao tác Generic trên IndexedDB
    async function idbGetAll(storeName) {
        const db = await openDatabase();
        if (!db) {
            return getFallbackData(storeName);
        }
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve(getFallbackData(storeName));
        });
    }

    async function idbGet(storeName, key) {
        const db = await openDatabase();
        if (!db) {
            const list = getFallbackData(storeName);
            return list.find(item => item.id === key) || null;
        }
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    async function idbPut(storeName, item) {
        const db = await openDatabase();
        if (!db) {
            saveFallbackData(storeName, item);
            return true;
        }
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => resolve(true);
            req.onerror = (err) => {
                console.error("Lỗi ghi IndexedDB:", err);
                saveFallbackData(storeName, item);
                resolve(false);
            };
        });
    }

    async function idbDelete(storeName, key) {
        const db = await openDatabase();
        if (!db) {
            deleteFallbackData(storeName, key);
            return true;
        }
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        });
    }

    // Fallback LocalStorage (trong trường hợp Safari Incognito hoặc thiết bị chặn IndexedDB)
    function getFallbackData(storeName) {
        try {
            const raw = localStorage.getItem(LS_BACKUP_KEY + '_' + storeName);
            if (!raw) {
                if (storeName === STORE_CATEGORIES) {
                    localStorage.setItem(LS_BACKUP_KEY + '_' + storeName, JSON.stringify(DEFAULT_CATEGORIES));
                    return DEFAULT_CATEGORIES;
                }
                return [];
            }
            return JSON.parse(raw);
        } catch (e) {
            return storeName === STORE_CATEGORIES ? DEFAULT_CATEGORIES : [];
        }
    }

    function saveFallbackData(storeName, item) {
        try {
            let list = getFallbackData(storeName);
            const idx = list.findIndex(x => x.id === item.id);
            if (idx >= 0) list[idx] = item;
            else list.push(item);
            localStorage.setItem(LS_BACKUP_KEY + '_' + storeName, JSON.stringify(list));
        } catch (e) {
            console.error("Lỗi fallback LocalStorage:", e);
        }
    }

    function deleteFallbackData(storeName, key) {
        try {
            let list = getFallbackData(storeName);
            list = list.filter(x => x.id !== key);
            localStorage.setItem(LS_BACKUP_KEY + '_' + storeName, JSON.stringify(list));
        } catch (e) {}
    }

    // ==========================================
    // 2. REPOSITORY API (QUẢN LÝ DỮ LIỆU MẪU)
    // ==========================================
    const TemplateDB = {
        async getCategories() {
            let cats = await idbGetAll(STORE_CATEGORIES);
            if (!cats || cats.length === 0) {
                for (let c of DEFAULT_CATEGORIES) {
                    await idbPut(STORE_CATEGORIES, c);
                }
                cats = DEFAULT_CATEGORIES;
            }
            return cats;
        },

        async addCategory(name, color = '#007bff') {
            if (!name || !name.trim()) return null;
            const id = 'cat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
            const newCat = { id, name: name.trim(), color };
            await idbPut(STORE_CATEGORIES, newCat);
            return newCat;
        },

        async updateCategory(id, name, color) {
            const cat = await idbGet(STORE_CATEGORIES, id);
            if (!cat) return false;
            if (name) cat.name = name.trim();
            if (color) cat.color = color;
            await idbPut(STORE_CATEGORIES, cat);
            return true;
        },

        async deleteCategory(id) {
            await idbDelete(STORE_CATEGORIES, id);
            // Xóa tag này khỏi các template
            const tpls = await idbGetAll(STORE_TEMPLATES);
            for (let t of tpls) {
                if (t.categoryIds && t.categoryIds.includes(id)) {
                    t.categoryIds = t.categoryIds.filter(cid => cid !== id);
                    await idbPut(STORE_TEMPLATES, t);
                }
            }
            return true;
        },

        async getTemplates(filterCatId = 'ALL', searchKeyword = '') {
            let list = await idbGetAll(STORE_TEMPLATES);
            // Sắp xếp mẫu mới nhất lên đầu
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (filterCatId && filterCatId !== 'ALL') {
                list = list.filter(t => t.categoryIds && t.categoryIds.includes(filterCatId));
            }

            if (searchKeyword && searchKeyword.trim()) {
                const stripFn = typeof window.stripVietnameseTones === 'function' 
                    ? window.stripVietnameseTones 
                    : (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
                const rawKw = searchKeyword.trim().toLowerCase();
                const normKw = stripFn(rawKw);
                list = list.filter(t => {
                    if (!t.name) return false;
                    const nameLower = t.name.toLowerCase();
                    const nameNorm = stripFn(nameLower);
                    return nameLower.includes(rawKw) || nameNorm.includes(normKw);
                });
            }

            return list;
        },

        async getTemplate(id) {
            return await idbGet(STORE_TEMPLATES, id);
        },

        async saveTemplate({ name, categoryIds, thumbnail, config }) {
            const id = 'tpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
            const now = new Date();
            const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const item = {
                id,
                name: name.trim(),
                categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
                thumbnail: thumbnail || '',
                config: config || {},
                createdAt: dateStr,
                timestamp: now.getTime()
            };

            await idbPut(STORE_TEMPLATES, item);
            return item;
        },

        async updateTemplate(id, { name, categoryIds }) {
            const tpl = await idbGet(STORE_TEMPLATES, id);
            if (!tpl) return false;
            if (name) tpl.name = name.trim();
            if (categoryIds) tpl.categoryIds = categoryIds;
            await idbPut(STORE_TEMPLATES, tpl);
            return true;
        },

        async deleteTemplate(id) {
            return await idbDelete(STORE_TEMPLATES, id);
        },

        async exportBackupData() {
            const categories = await this.getCategories();
            const templates = await this.getTemplates('ALL', '');
            return {
                version: '1.0',
                appName: 'VIP_SIM_TOOL',
                exportedAt: new Date().toISOString(),
                categories,
                templates
            };
        },

        async importBackupData(backupObj) {
            if (!backupObj || (!backupObj.templates && !backupObj.categories)) {
                throw new Error("Tệp tin sao lưu không đúng định dạng!");
            }
            if (Array.isArray(backupObj.categories)) {
                for (let c of backupObj.categories) {
                    if (c && c.id && c.name) await idbPut(STORE_CATEGORIES, c);
                }
            }
            if (Array.isArray(backupObj.templates)) {
                for (let t of backupObj.templates) {
                    if (t && t.id && t.name) await idbPut(STORE_TEMPLATES, t);
                }
            }
            return true;
        }
    };

    window.LocalTemplateDB = TemplateDB;

    // ==========================================
    // 3. TIỆN ÍCH CHỤP THUMBNAIL & GÓI CẤU HÌNH
    // ==========================================
    function captureCanvasThumbnail(maxWidth = 640, maxHeight = 640) {
        const srcCanvas = document.getElementById('preview');
        if (!srcCanvas || srcCanvas.width === 0 || srcCanvas.height === 0) return '';
        try {
            const thumbCanvas = document.createElement('canvas');
            const srcW = srcCanvas.width;
            const srcH = srcCanvas.height;
            const ratio = Math.min(maxWidth / srcW, maxHeight / srcH);
            thumbCanvas.width = Math.round(srcW * ratio);
            thumbCanvas.height = Math.round(srcH * ratio);

            const tctx = thumbCanvas.getContext('2d');
            tctx.imageSmoothingEnabled = true;
            tctx.imageSmoothingQuality = 'high';
            tctx.drawImage(srcCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

            return thumbCanvas.toDataURL('image/jpeg', 0.88);
        } catch (e) {
            console.error("Lỗi tạo thumbnail:", e);
            return '';
        }
    }

    async function extractCurrentConfig() {
        let cfg = {};
        let inputs = document.querySelectorAll('.col-settings input, .col-settings select');
        inputs.forEach(el => {
            if (!el.id || el.type === 'file' || el.id.includes('search')) return;
            cfg[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
        });

        cfg.savedImages = {};
        const keys = ['globalBgImage', 'bgImage', 'cellBgImage', 'cellBorderImage'];
        const pfx = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum'];
        pfx.forEach(p => keys.push(p + 'ColorImage', p + 'BgImage', p + 'BorderImage', p + 'ShapeBorderImage'));

        for (let k of keys) {
            if (window[k] && window[k] instanceof Image && window[k].complete && window[k].naturalWidth > 0) {
                if (typeof window.compressImage === 'function') {
                    let res = await window.compressImage(window[k], 700, 0.7);
                    if (res) {
                        let skey = (k === 'globalBgImage') ? 'bgImage' : k;
                        cfg.savedImages[skey] = res;
                    }
                } else if (window[k].src && window[k].src.startsWith('data:image')) {
                    let skey = (k === 'globalBgImage') ? 'bgImage' : k;
                    cfg.savedImages[skey] = window[k].src;
                }
            }
        }
        return cfg;
    }

    // ==========================================
    // 4. UI CONTROLLER (QUẢN LÝ GIAO DIỆN MODAL)
    // ==========================================
    let currentFilterCatId = 'ALL';
    let currentSearchKeyword = '';
    let cachedCategories = [];
    let pendingThumbnailData = '';

    // Mở Modal Quản Lý Mẫu chính
    window.openLocalTemplateManager = async function () {
        // Đóng menu nổi nếu đang mở
        const list = document.getElementById('subMenuList');
        if (list) list.style.display = 'none';

        const modal = document.getElementById('themeModalOverlay');
        if (!modal) return alert("Không tìm thấy modal quản lý mẫu!");

        document.body.classList.add('theme-modal-open');
        modal.style.display = 'flex';
        // Luôn chuyển về tab kho nội bộ khi mở lần đầu
        window.switchTplMainTab('local');
        await refreshTemplateManagerUI();
    };
    window.openTemplateManager = window.openLocalTemplateManager;
    window.openThemeModal = window.openLocalTemplateManager;

    window.closeTemplateManager = function () {
        const modal = document.getElementById('themeModalOverlay');
        if (modal) modal.style.display = 'none';
        document.body.classList.remove('theme-modal-open');
        if (typeof window.closeTemplateDrawer === 'function') {
            window.closeTemplateDrawer();
        }
    };
    window.closeThemeModal = window.closeTemplateManager;

    // ==========================================
    // ĐIỀU KHIỂN HỘP TỦ DANH MỤC TRÊN MOBILE
    // ==========================================
    window.toggleTemplateDrawer = function (forceState) {
        const sidebar = document.getElementById('tplSidebarCategories');
        const backdrop = document.getElementById('tplDrawerBackdrop');
        if (!sidebar) return;

        const isOpen = sidebar.classList.contains('drawer-open');
        const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

        if (shouldOpen) {
            sidebar.classList.add('drawer-open');
            if (backdrop) backdrop.classList.add('active');
        } else {
            sidebar.classList.remove('drawer-open');
            if (backdrop) backdrop.classList.remove('active');
        }
    };

    window.closeTemplateDrawer = function () {
        window.toggleTemplateDrawer(false);
    };

    // ==========================================
    // CHUYỂN ĐỔI 2 TAB CHÍNH: KHO NỘI BỘ vs KHO ĐÁM MÂY
    // ==========================================
    window.switchTplMainTab = function (tabName) {
        const btnLocal = document.getElementById('btnTabLocal');
        const btnCloud = document.getElementById('btnTabCloud');
        const paneLocal = document.getElementById('tplTabPaneLocal');
        const paneCloud = document.getElementById('tplTabPaneCloud');

        if (typeof window.closeTemplateDrawer === 'function') {
            window.closeTemplateDrawer();
        }

        if (tabName === 'cloud') {
            if (btnLocal) btnLocal.classList.remove('active');
            if (btnCloud) btnCloud.classList.add('active');
            if (paneLocal) paneLocal.style.display = 'none';
            if (paneCloud) paneCloud.style.display = 'flex';

            // Tải mẫu đám mây trực tuyến nếu có
            if (typeof window.loadCloudTemplates === 'function') {
                try { window.loadCloudTemplates(); } catch (e) { console.error("Lỗi tải mẫu đám mây:", e); }
            }
        } else {
            // tabName === 'local' (Kho máy nội bộ)
            if (btnLocal) btnLocal.classList.add('active');
            if (btnCloud) btnCloud.classList.remove('active');
            if (paneLocal) paneLocal.style.display = 'flex';
            if (paneCloud) paneCloud.style.display = 'none';

            // Làm mới giao diện kho nội bộ
            renderCategorySidebar();
            renderTemplateCards();
        }
    };

    // Làm mới toàn bộ dữ liệu trong Modal Quản lý mẫu
    async function refreshTemplateManagerUI() {
        cachedCategories = await TemplateDB.getCategories();
        await renderCategorySidebar();
        await renderTemplateCards();
    }

    // Render danh sách danh mục trong cột trái Sidebar (Desktop: danh sách dọc, Mobile: thanh trượt ngang)
    async function renderCategorySidebar() {
        const container = document.getElementById('tplCategoryListSidebar');
        if (!container) return;

        const allTemplates = await TemplateDB.getTemplates('ALL', '');
        const totalCount = allTemplates.length;

        let html = `
            <div class="sidebar-cat-item ${currentFilterCatId === 'ALL' ? 'active' : ''}" 
                 onclick="window.selectTplCategory('ALL')">
                <span class="cat-item-icon">🌟</span>
                <span class="cat-item-name">Tất cả mẫu</span>
                <span class="cat-item-badge">${totalCount}</span>
            </div>
        `;

        cachedCategories.forEach(cat => {
            const isActive = currentFilterCatId === cat.id;
            const count = allTemplates.filter(t => t.categoryIds && t.categoryIds.includes(cat.id)).length;
            html += `
                <div class="sidebar-cat-item ${isActive ? 'active' : ''}" 
                     onclick="window.selectTplCategory('${cat.id}')">
                    <span class="cat-item-dot" style="background:${cat.color || '#007bff'}"></span>
                    <span class="cat-item-name">${escapeHtml(cat.name)}</span>
                    <span class="cat-item-badge">${count}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    window.selectTplCategory = async function (catId) {
        currentFilterCatId = catId;
        await renderCategorySidebar();
        await renderTemplateCards();
        // Tự động đóng hộp tủ trên mobile sau khi chọn danh mục
        if (typeof window.closeTemplateDrawer === 'function') {
            window.closeTemplateDrawer();
        }
    };

    window.handleTplSearchInput = async function (keyword) {
        currentSearchKeyword = keyword;
        await renderTemplateCards();
    };

    // Render danh sách các thẻ mẫu trong Grid
    async function renderTemplateCards() {
        const grid = document.getElementById('localTemplatesGrid');
        if (!grid) return;

        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #777;">⏳ Đang tải mẫu thiết kế...</div>';

        const templates = await TemplateDB.getTemplates(currentFilterCatId, currentSearchKeyword);
        const catMap = {};
        cachedCategories.forEach(c => { catMap[c.id] = c; });

        // Cập nhật banner tiêu đề danh mục đang xem
        const titleEl = document.getElementById('tplSelectedCatTitle');
        const countEl = document.getElementById('tplSelectedCatCount');
        if (titleEl) {
            if (currentFilterCatId === 'ALL') {
                titleEl.innerHTML = '<span>🌟 Tất cả các mẫu</span>';
            } else {
                const activeCat = cachedCategories.find(c => c.id === currentFilterCatId);
                titleEl.innerHTML = activeCat 
                    ? `<span class="cat-item-dot" style="background:${activeCat.color}"></span> <span>${escapeHtml(activeCat.name)}</span>` 
                    : '<span>Danh mục</span>';
            }
        }
        if (countEl) {
            countEl.innerText = `${templates.length} mẫu`;
        }

        // Cập nhật Tay Nắm Hộp Tủ Mobile (Luôn hiển thị tên tag đang chọn)
        const handleIcon = document.getElementById('tplDrawerHandleIcon');
        const handleName = document.getElementById('tplDrawerHandleName');
        if (handleName) {
            if (currentFilterCatId === 'ALL') {
                if (handleIcon) handleIcon.textContent = '🌟';
                handleName.textContent = 'Tất cả mẫu';
            } else {
                const activeCat = cachedCategories.find(c => c.id === currentFilterCatId);
                if (activeCat) {
                    if (handleIcon) {
                        handleIcon.innerHTML = `<span style="background:${activeCat.color || '#fff'}; display:inline-block; width:8px; height:8px; border-radius:50%; box-shadow:0 0 0 1px #fff; vertical-align:middle;"></span>`;
                    }
                    handleName.textContent = activeCat.name;
                }
            }
        }

        if (templates.length === 0) {
            let emptyMsg = currentSearchKeyword 
                ? `Không tìm thấy mẫu nào với từ khóa "<b>${escapeHtml(currentSearchKeyword)}</b>".`
                : (currentFilterCatId === 'ALL'
                    ? `Kho mẫu Local của bạn hiện đang trống.<br><br>👉 Hãy thiết kế trên màn hình và bấm nút <b>"💾 LƯU MẪU HIỆN TẠI"</b> ở trên để tạo mẫu đầu tiên!`
                    : `Chưa có mẫu nào thuộc danh mục này.`);

            grid.innerHTML = `
                <div class="tpl-empty-box">
                    <div style="font-size: 38px; margin-bottom: 10px;">📦</div>
                    <div style="font-size: 14px; line-height: 1.5; color: #666;">${emptyMsg}</div>
                </div>
            `;
            return;
        }

        let html = '';
        templates.forEach(tpl => {
            // Render các badge tag danh mục
            let tagsHtml = '';
            if (tpl.categoryIds && tpl.categoryIds.length > 0) {
                tpl.categoryIds.forEach(cid => {
                    const c = catMap[cid];
                    if (c) {
                        tagsHtml += `<span class="tpl-badge" style="background:${c.color || '#007bff'}">${escapeHtml(c.name)}</span>`;
                    }
                });
            } else {
                tagsHtml = `<span class="tpl-badge" style="background:#888;">Chưa phân loại</span>`;
            }

            const thumbSrc = tpl.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect width="400" height="240" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="16" font-weight="bold" font-family="sans-serif">🎨 Mẫu Thiết Kế</text></svg>';

            html += `
                <div class="tpl-card" id="card_${tpl.id}">
                    <div class="tpl-card-thumb-wrap" onclick="window.applyTemplateToCanvas('${tpl.id}')" title="Bấm để nạp mẫu này ngay">
                        <img src="${thumbSrc}" class="tpl-card-thumb" alt="${escapeHtml(tpl.name)}" loading="lazy">
                        <div class="tpl-thumb-overlay">🚀 Bấm để Áp Dụng</div>
                    </div>
                    <div class="tpl-card-content">
                        <div class="tpl-card-title" title="${escapeHtml(tpl.name)}">${escapeHtml(tpl.name)}</div>
                        <div class="tpl-card-tags">${tagsHtml}</div>
                        <div class="tpl-card-date">🕒 ${tpl.createdAt || ''}</div>
                        <div class="tpl-card-actions">
                            <button class="btn-tpl-action btn-tpl-apply" onclick="window.applyTemplateToCanvas('${tpl.id}')">🚀 Áp Dụng</button>
                            <button class="btn-tpl-action btn-tpl-lite" onclick="window.exportSingleTemplateLite('${tpl.id}')" title="Tải file .lite">📥 .lite</button>
                            <button class="btn-tpl-action btn-tpl-edit" onclick="window.openEditTemplateModal('${tpl.id}')" title="Sửa tên & danh mục">✏️</button>
                            <button class="btn-tpl-action btn-tpl-delete" onclick="window.deleteTemplateConfirm('${tpl.id}')" title="Xóa mẫu">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    }

    // ==========================================
    // 5. THAO TÁC LƯU MẪU MỚI (SAVE MODAL)
    // ==========================================
    window.openSaveTemplateModal = function () {
        // Tự động chụp thumbnail canvas (độ nét cao 480x480)
        pendingThumbnailData = captureCanvasThumbnail(480, 480);
        const previewImg = document.getElementById('saveTplThumbPreview');
        if (previewImg) {
            previewImg.src = pendingThumbnailData || '';
        }

        const nameInput = document.getElementById('saveTplNameInput');
        if (nameInput) {
            const d = new Date();
            nameInput.value = `Mẫu Thiết Kế ${d.getDate()}/${d.getMonth()+1} - ${d.getHours()}h${d.getMinutes()}`;
        }

        // Reset ô nhập thêm tab mới
        const quickCatInput = document.getElementById('quickSaveCatName');
        if (quickCatInput) quickCatInput.value = '';

        // Render danh sách checkbox danh mục
        renderSaveCategoryCheckboxes();

        const modal = document.getElementById('saveTemplateModalOverlay');
        if (modal) modal.style.display = 'flex';
    };

    window.closeSaveTemplateModal = function () {
        const modal = document.getElementById('saveTemplateModalOverlay');
        if (modal) modal.style.display = 'none';
    };

    function renderSaveCategoryCheckboxes(selectedIds = []) {
        const container = document.getElementById('saveTplCategoryList');
        if (!container) return;

        let html = '';
        cachedCategories.forEach(cat => {
            const isChecked = selectedIds.includes(cat.id);
            html += `
                <label class="tpl-check-chip ${isChecked ? 'checked' : ''}">
                    <input type="checkbox" value="${cat.id}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('checked', this.checked)">
                    <span class="tpl-chip-dot" style="background:${cat.color}"></span>
                    <span>${escapeHtml(cat.name)}</span>
                </label>
            `;
        });
        container.innerHTML = html;
    }

    // Thêm Tab/Danh mục mới trực tiếp ngay trong Modal Lưu Mẫu
    window.submitQuickAddCatInSaveModal = async function () {
        const nameInput = document.getElementById('quickSaveCatName');
        const colorInput = document.getElementById('quickSaveCatColor');
        const name = nameInput ? nameInput.value.trim() : '';
        const color = colorInput ? colorInput.value : '#007bff';

        if (!name) {
            alert("⚠️ Vui lòng nhập tên tab / danh mục mới!");
            if (nameInput) nameInput.focus();
            return;
        }

        // Lấy danh sách ID hiện tại đang được tích chọn
        const checkedEls = document.querySelectorAll('#saveTplCategoryList input[type="checkbox"]:checked');
        const currentCheckedIds = Array.from(checkedEls).map(el => el.value);

        // Lưu danh mục mới vào DB
        const newCat = await TemplateDB.addCategory(name, color);
        cachedCategories = await TemplateDB.getCategories();

        // Tự động tích chọn danh mục mới này cho mẫu
        if (newCat && newCat.id) {
            currentCheckedIds.push(newCat.id);
        }

        if (nameInput) nameInput.value = '';

        // Render lại danh sách chip checkbox với tab mới đã được tích
        renderSaveCategoryCheckboxes(currentCheckedIds);

        // Cập nhật lại cột sidebar bên ngoài để hiển thị ngay tab mới
        await renderCategorySidebar();

        if (typeof window.showToast === 'function') {
            window.showToast(`➕ Đã tạo tab "${name}" và chọn cho mẫu!`);
        }
    };

    window.confirmSaveTemplate = async function () {
        const nameInput = document.getElementById('saveTplNameInput');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert("⚠️ Vui lòng nhập tên cho mẫu thiết kế!");
            if (nameInput) nameInput.focus();
            return;
        }

        // Lấy danh sách danh mục được chọn
        const checkedEls = document.querySelectorAll('#saveTplCategoryList input[type="checkbox"]:checked');
        const categoryIds = Array.from(checkedEls).map(el => el.value);

        if (typeof window.showToast === 'function') window.showToast("Đang đóng gói và lưu mẫu...");

        try {
            const config = await extractCurrentConfig();
            const savedItem = await TemplateDB.saveTemplate({
                name,
                categoryIds,
                thumbnail: pendingThumbnailData || captureCanvasThumbnail(640, 640),
                config
            });

            window.closeSaveTemplateModal();
            if (typeof window.showToast === 'function') {
                window.showToast(`✅ Đã lưu mẫu "${name}" thành công!`);
            }

            // Nếu modal quản lý mẫu đang mở thì cập nhật lại lưới
            const mainModal = document.getElementById('themeModalOverlay');
            if (mainModal && mainModal.style.display === 'flex') {
                await refreshTemplateManagerUI();
            }

            // Mở hộp thoại hỏi người dùng có muốn tải thêm file .lite về máy không
            if (savedItem && typeof window.openSaveLiteConfirmModal === 'function') {
                window.openSaveLiteConfirmModal(savedItem.id, savedItem.name);
            }
        } catch (err) {
            console.error("Lỗi khi lưu mẫu:", err);
            alert("❌ Đã có lỗi xảy ra khi lưu mẫu: " + err.message);
        }
    };

    // ==========================================
    // 5.1 HỘP THOẠI HỎI TẢI FILE .LITE SAU KHI LƯU
    // ==========================================
    let lastSavedTemplateForLite = null;

    window.openSaveLiteConfirmModal = function (tplId, tplName) {
        lastSavedTemplateForLite = { id: tplId, name: tplName };
        const nameEl = document.getElementById('saveLiteConfirmTplName');
        if (nameEl) nameEl.textContent = `📁 ${tplName}`;
        const modal = document.getElementById('saveLiteConfirmModalOverlay');
        if (modal) modal.style.display = 'flex';
    };

    window.closeSaveLiteConfirmModal = function () {
        const modal = document.getElementById('saveLiteConfirmModalOverlay');
        if (modal) modal.style.display = 'none';
        lastSavedTemplateForLite = null;
    };

    window.confirmDownloadLiteAfterSave = async function () {
        if (!lastSavedTemplateForLite || !lastSavedTemplateForLite.id) {
            window.closeSaveLiteConfirmModal();
            return;
        }
        const tplId = lastSavedTemplateForLite.id;
        window.closeSaveLiteConfirmModal();
        if (typeof window.exportSingleTemplateLite === 'function') {
            await window.exportSingleTemplateLite(tplId);
        }
    };

    // ==========================================
    // 6. THAO TÁC ÁP DỤNG, SỬA, XÓA & XUẤT .LITE
    // ==========================================
    window.applyTemplateToCanvas = async function (tplId) {
        const tpl = await TemplateDB.getTemplate(tplId);
        if (!tpl || !tpl.config) {
            alert("❌ Không tìm thấy dữ liệu mẫu này!");
            return;
        }

        if (typeof window.applyConfigToUI === 'function') {
            window.applyConfigToUI(tpl.config, true); // true: giữ nguyên danh sách SIM
            if (typeof window.updateUI === 'function') window.updateUI();
            if (typeof window.drawCanvas === 'function') window.drawCanvas();
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();

            window.closeTemplateManager();
            if (typeof window.showToast === 'function') {
                window.showToast(`✨ Đã nạp mẫu "${tpl.name}" vào bản vẽ!`);
            }
        } else {
            alert("Không tìm thấy hàm nạp mẫu applyConfigToUI!");
        }
    };

    window.deleteTemplateConfirm = async function (tplId) {
        const tpl = await TemplateDB.getTemplate(tplId);
        const name = tpl ? tpl.name : 'mẫu này';
        if (!confirm(`Bạn có chắc chắn muốn xóa "${name}" khỏi kho mẫu Local không?`)) return;

        await TemplateDB.deleteTemplate(tplId);
        if (typeof window.showToast === 'function') window.showToast("🗑️ Đã xóa mẫu!");
        await renderTemplateCards();
    };

    window.exportSingleTemplateLite = async function (tplId) {
        const tpl = await TemplateDB.getTemplate(tplId);
        if (!tpl || !tpl.config) return alert("Không tìm thấy mẫu!");

        const blob = new Blob([JSON.stringify(tpl.config)], { type: 'application/json' });
        const dl = document.createElement('a');
        dl.href = URL.createObjectURL(blob);
        const safeName = (tpl.name || 'Mau_Thiet_Ke').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
        dl.download = `${safeName}.lite`;
        document.body.appendChild(dl);
        dl.click();
        setTimeout(() => {
            document.body.removeChild(dl);
            URL.revokeObjectURL(dl.href);
        }, 500);
        if (typeof window.showToast === 'function') window.showToast(`📦 Đã tải file "${safeName}.lite"`);
    };

    // Chỉnh sửa tên & đổi danh mục cho mẫu đã lưu
    let editingTemplateId = null;
    window.openEditTemplateModal = async function (tplId) {
        const tpl = await TemplateDB.getTemplate(tplId);
        if (!tpl) return;
        editingTemplateId = tplId;

        const nameInput = document.getElementById('editTplNameInput');
        if (nameInput) nameInput.value = tpl.name || '';

        // Reset ô nhập thêm tab mới
        const quickCatInput = document.getElementById('quickEditCatName');
        if (quickCatInput) quickCatInput.value = '';

        // Render danh mục với các checkbox đã chọn
        renderEditCategoryCheckboxes(tpl.categoryIds || []);

        const modal = document.getElementById('editTemplateModalOverlay');
        if (modal) modal.style.display = 'flex';
    };

    function renderEditCategoryCheckboxes(selectedIds = []) {
        const container = document.getElementById('editTplCategoryList');
        if (!container) return;
        let html = '';
        cachedCategories.forEach(cat => {
            const isChecked = selectedIds.includes(cat.id);
            html += `
                <label class="tpl-check-chip ${isChecked ? 'checked' : ''}">
                    <input type="checkbox" value="${cat.id}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('checked', this.checked)">
                    <span class="tpl-chip-dot" style="background:${cat.color}"></span>
                    <span>${escapeHtml(cat.name)}</span>
                </label>
            `;
        });
        container.innerHTML = html;
    }

    // Thêm Tab/Danh mục mới trực tiếp ngay trong Modal Sửa Mẫu
    window.submitQuickAddCatInEditModal = async function () {
        const nameInput = document.getElementById('quickEditCatName');
        const colorInput = document.getElementById('quickEditCatColor');
        const name = nameInput ? nameInput.value.trim() : '';
        const color = colorInput ? colorInput.value : '#007bff';

        if (!name) {
            alert("⚠️ Vui lòng nhập tên tab / danh mục mới!");
            if (nameInput) nameInput.focus();
            return;
        }

        const checkedEls = document.querySelectorAll('#editTplCategoryList input[type="checkbox"]:checked');
        const currentCheckedIds = Array.from(checkedEls).map(el => el.value);

        const newCat = await TemplateDB.addCategory(name, color);
        cachedCategories = await TemplateDB.getCategories();

        if (newCat && newCat.id) {
            currentCheckedIds.push(newCat.id);
        }

        if (nameInput) nameInput.value = '';

        renderEditCategoryCheckboxes(currentCheckedIds);
        await renderCategorySidebar();

        if (typeof window.showToast === 'function') {
            window.showToast(`➕ Đã tạo tab "${name}" và chọn cho mẫu!`);
        }
    };

    window.closeEditTemplateModal = function () {
        const modal = document.getElementById('editTemplateModalOverlay');
        if (modal) modal.style.display = 'none';
        editingTemplateId = null;
    };

    window.confirmEditTemplate = async function () {
        if (!editingTemplateId) return;
        const nameInput = document.getElementById('editTplNameInput');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) return alert("Vui lòng nhập tên mẫu!");

        const checkedEls = document.querySelectorAll('#editTplCategoryList input[type="checkbox"]:checked');
        const categoryIds = Array.from(checkedEls).map(el => el.value);

        await TemplateDB.updateTemplate(editingTemplateId, { name, categoryIds });
        window.closeEditTemplateModal();
        if (typeof window.showToast === 'function') window.showToast("✅ Đã cập nhật mẫu!");
        await renderTemplateCards();
    };

    // ==========================================
    // 7. QUẢN LÝ DANH MỤC (CATEGORY MANAGER)
    // ==========================================
    window.openCategoryManagerModal = function () {
        renderCategoryManagerList();
        const modal = document.getElementById('categoryManagerModalOverlay');
        if (modal) modal.style.display = 'flex';
    };

    window.closeCategoryManagerModal = function () {
        const modal = document.getElementById('categoryManagerModalOverlay');
        if (modal) modal.style.display = 'none';
    };

    function renderCategoryManagerList() {
        const container = document.getElementById('categoryManagerList');
        if (!container) return;

        let html = '';
        cachedCategories.forEach(cat => {
            html += `
                <div class="cat-mgr-item" id="cat_row_${cat.id}">
                    <input type="color" value="${cat.color || '#007bff'}" class="cat-color-picker" 
                           onchange="window.handleCategoryColorChange('${cat.id}', this.value)">
                    <input type="text" value="${escapeHtml(cat.name)}" class="cat-name-input"
                           onchange="window.handleCategoryNameChange('${cat.id}', this.value)">
                    <button class="btn-cat-del" onclick="window.handleDeleteCategory('${cat.id}')" title="Xóa danh mục">🗑️</button>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    window.handleCategoryNameChange = async function (catId, newName) {
        if (!newName || !newName.trim()) return;
        await TemplateDB.updateCategory(catId, newName.trim(), null);
        cachedCategories = await TemplateDB.getCategories();
        await renderCategorySidebar();
    };

    window.handleCategoryColorChange = async function (catId, newColor) {
        await TemplateDB.updateCategory(catId, null, newColor);
        cachedCategories = await TemplateDB.getCategories();
        await renderCategorySidebar();
    };

    window.addNewCategorySubmit = async function () {
        const nameInput = document.getElementById('newCatNameInput');
        const colorInput = document.getElementById('newCatColorInput');
        const name = nameInput ? nameInput.value.trim() : '';
        const color = colorInput ? colorInput.value : '#007bff';

        if (!name) return alert("Vui lòng nhập tên danh mục!");
        await TemplateDB.addCategory(name, color);
        if (nameInput) nameInput.value = '';
        cachedCategories = await TemplateDB.getCategories();
        renderCategoryManagerList();
        await renderCategorySidebar();
        if (typeof window.showToast === 'function') window.showToast(`➕ Đã thêm danh mục "${name}"`);
    };

    window.handleDeleteCategory = async function (catId) {
        const cat = cachedCategories.find(c => c.id === catId);
        const name = cat ? cat.name : 'danh mục này';
        if (!confirm(`Xóa danh mục "${name}"? Các mẫu thuộc danh mục này sẽ không bị xóa mà chỉ gỡ nhãn.`)) return;

        await TemplateDB.deleteCategory(catId);
        cachedCategories = await TemplateDB.getCategories();
        renderCategoryManagerList();
        await renderCategorySidebar();
        await renderTemplateCards();
    };

    // ==========================================
    // 8. SAO LƯU & PHỤC HỒI TOÀN BỘ KHO MẪU
    // ==========================================
    window.exportAllTemplatesBackup = async function () {
        const backupData = await TemplateDB.exportBackupData();
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const dl = document.createElement('a');
        dl.href = URL.createObjectURL(blob);
        const d = new Date();
        dl.download = `VIP_SIM_TEMPLATES_BACKUP_${d.getDate()}_${d.getMonth()+1}_${d.getFullYear()}.json`;
        document.body.appendChild(dl);
        dl.click();
        setTimeout(() => {
            document.body.removeChild(dl);
            URL.revokeObjectURL(dl.href);
        }, 500);
        if (typeof window.showToast === 'function') window.showToast("📤 Đã tải file sao lưu kho mẫu!");
    };

    window.dismissBackupNotice = function () {
        const el = document.getElementById('tplBackupNotice');
        if (el) el.style.display = 'none';
    };

    window.handleImportTemplatesBackup = function (event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const data = JSON.parse(e.target.result);
                await TemplateDB.importBackupData(data);
                alert("✅ Đã nạp thành công toàn bộ kho mẫu và danh mục!");
                await refreshTemplateManagerUI();
            } catch (err) {
                alert("❌ Lỗi khi đọc file sao lưu: " + err.message);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    // ==========================================
    // TIỆN ÍCH TRÁNH XSS
    // ==========================================
    function escapeHtml(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
