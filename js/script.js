// ============================================================================
// 1. ZOOM, FULLSCREEN VÀ PHÂN TRANG (CÔNG CỤ DƯỚI PREVIEW)
// ============================================================================
window.applyZoom = function(val) {
    let zVal = document.getElementById('zoomVal'); if(zVal) zVal.innerText = val + '%';
    let canvas = document.getElementById('preview'); if(canvas) { canvas.style.transform = `scale(${val / 100})`; canvas.style.transformOrigin = 'top center'; }
};

window.fitZoom = function() {
    let wrapper = document.getElementById('canvasWrapper'); let canvas = document.getElementById('preview');
    if(!wrapper || !canvas || canvas.width === 0) return;
    let scale = Math.min(1, (wrapper.clientWidth - 20) / canvas.width);
    let finalVal = Math.floor(scale * 100);
    let zSlider = document.getElementById('zoomSlider'); if(zSlider) zSlider.value = finalVal;
    window.applyZoom(finalVal);
};

window.toggleFullscreen = function() {
    let col = document.getElementById('previewColumn'); let btn = document.getElementById('toggleFullBtn');
    if(!col) return;
    
    // Kiểm tra mobile
    let isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        document.body.classList.toggle('studio-mode');
        window.isFullscreen = document.body.classList.contains('studio-mode');
        if (window.isFullscreen) {
            if (btn) btn.innerText = '↙ Thu nhỏ';
            // Tự động nạp mẫu cài đặt khi vào Studio Mode
            if (typeof window.openMobileModal === 'function') window.openMobileModal('layout');
        } else {
            if (btn) btn.innerText = '🔲 TOÀN MÀN HÌNH';
            if (typeof window.closeMobileModal === 'function') window.closeMobileModal();
        }
    } else {
        col.classList.toggle('fullscreen');
        window.isFullscreen = col.classList.contains('fullscreen');
        if (window.isFullscreen) { if (btn) btn.innerText = '↙ Thu nhỏ'; } 
        else { 
            if (btn) btn.innerText = '🔲 TOÀN MÀN HÌNH'; 
            if (typeof window.closeMobileModal === 'function') window.closeMobileModal(); 
        }
    }
    setTimeout(window.fitZoom, 300);
};

window.currentStep = 0;
window.updatePagination = function() {
    let r = parseInt(document.getElementById('tableRows')?.value) || 10;
    let c = parseInt(document.getElementById('tableCols')?.value) || 2;
    let listLen = 0; if(typeof window.parseList === 'function') listLen = window.parseList().length;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    if(window.currentStep >= tot) window.currentStep = Math.max(0, tot - 1);
    
    let pInp = document.getElementById('pageInput'); if(pInp) pInp.value = window.currentStep + 1;
    let tTxt = document.getElementById('totalPagesText'); if(tTxt) tTxt.innerText = tot;
};

window.goToPage = function(v) {
    let p = parseInt(v); let r = parseInt(document.getElementById('tableRows')?.value) || 10; let c = parseInt(document.getElementById('tableCols')?.value) || 2;
    let listLen = 0; if(typeof window.parseList === 'function') listLen = window.parseList().length;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    window.currentStep = Math.max(0, Math.min(p - 1, tot - 1));
    if(typeof window.drawCanvas === 'function') window.drawCanvas();
};

window.prevStep = function() { if(window.currentStep > 0) { window.currentStep--; if(typeof window.drawCanvas === 'function') window.drawCanvas(); } };
window.nextStep = function() {
    let r = parseInt(document.getElementById('tableRows')?.value) || 10; let c = parseInt(document.getElementById('tableCols')?.value) || 2;
    let listLen = 0; if(typeof window.parseList === 'function') listLen = window.parseList().length;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    if(window.currentStep < tot - 1) { window.currentStep++; if(typeof window.drawCanvas === 'function') window.drawCanvas(); }
};

// ============================================================================
// 2. ĐIỀU KHIỂN TAB GIAO DIỆN
// ============================================================================
window.isSyncingTabs = false; window.currentSubSubTab = 'pos'; 

window.switchTab = function(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    let target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    if(btn) btn.classList.add('active');
};

window.switchSubTab = function(tabId, btn) {
    let parent = btn.closest('.tab-content') || document.getElementById('mobileModalBody');
    if(!parent) return;
    parent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    parent.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    let target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    if(btn) btn.classList.add('active');
    
    if(target && window.currentSubSubTab) {
        let activeSubSubBtn = target.querySelector(`.sub-sub-tab-btn[onclick*="-${window.currentSubSubTab}'"], .sub-sub-tab-btn[onclick*='-${window.currentSubSubTab}"']`);
        if(activeSubSubBtn && !activeSubSubBtn.classList.contains('active')) {
            let match = activeSubSubBtn.getAttribute('onclick').match(/['"]([^'"]+)['"]/);
            if(match) window.switchSubSubTab(match[1], activeSubSubBtn, true);
        }
    }
};

window.switchSubSubTab = function(tabId, btn, isAutoSync = false) {
    if (window.isSyncingTabs) return;
    let parent = btn.closest('.sub-tab-content'); if(!parent) return;
    parent.querySelectorAll('.sub-sub-tab-content').forEach(c => c.classList.remove('active'));
    parent.querySelectorAll('.sub-sub-tab-btn').forEach(b => b.classList.remove('active'));
    let target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    if(btn) btn.classList.add('active');

    let parts = tabId.split('-'); let category = parts[parts.length - 1]; 
    if (!isAutoSync && ['pos', 'format', 'bg'].includes(category)) {
        window.currentSubSubTab = category; window.isSyncingTabs = true;
        let allBtns = document.querySelectorAll(`.sub-sub-tab-btn[onclick*="-${category}'"], .sub-sub-tab-btn[onclick*='-${category}"']`);
        allBtns.forEach(b => {
            if (b !== btn) {
                let match = b.getAttribute('onclick').match(/['"]([^'"]+)['"]/);
                if (match) {
                    let t = document.getElementById(match[1]);
                    if(t) {
                        b.closest('.sub-tab-content').querySelectorAll('.sub-sub-tab-content').forEach(c => c.classList.remove('active'));
                        b.closest('.sub-tab-content').querySelectorAll('.sub-sub-tab-btn').forEach(x => x.classList.remove('active'));
                        t.classList.add('active'); b.classList.add('active');
                    }
                }
            }
        });
        window.isSyncingTabs = false;
    }
};

window.updateUI = function() {
    let toggleAdv = function(prefix) {
        let modeEl = document.getElementById(prefix + 'Mode') || document.getElementById(prefix + 'ColorMode'); if (!modeEl) return;
        let mode = modeEl.value;
        let sol = document.getElementById(prefix + 'SolidGrp') || document.getElementById(prefix + 'ColorSolidGrp');
        let grad = document.getElementById(prefix + 'GradGrp') || document.getElementById(prefix + 'ColorGradGrp');
        let img = document.getElementById(prefix + 'ImgGrp') || document.getElementById(prefix + 'ColorImgGrp');
        if (sol) sol.style.display = (mode === 'solid') ? 'flex' : 'none';
        if (grad) grad.style.display = (mode === 'gradient') ? 'flex' : 'none';
        if (img) img.style.display = (mode === 'image') ? 'flex' : 'none';
    };

    // ĐÃ BỔ SUNG ĐỦ 9 CHỮ GÓC
    let allPrefixes = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum', 'cell'];
    allPrefixes.forEach(p => { 
        toggleAdv(p + 'Color'); toggleAdv(p + 'Bg'); toggleAdv(p + 'Border'); 
        if((p === 'menh' || p === 'mang') && typeof window.toggleShapeOptions === 'function') {
            window.toggleShapeOptions(p);
        }
    });
    toggleAdv('bg'); 
    
    let checkCol = (id, chkId) => { let btn = document.querySelector(`.sub-tabs button[onclick*="${id}"]`); let chk = document.getElementById(chkId); if(btn && chk) btn.style.display = chk.checked ? '' : 'none'; };
    checkCol('sub-num', 'chkNum'); checkCol('sub-price', 'chkPrice'); checkCol('sub-menh', 'chkMenh'); checkCol('sub-mang', 'chkMang'); checkCol('sub-data1', 'chkData1'); checkCol('sub-data2', 'chkData2');
    checkCol('sub-hNum', 'chkNum'); checkCol('sub-hPrice', 'chkPrice'); checkCol('sub-hMenh', 'chkMenh'); checkCol('sub-hMang', 'chkMang'); checkCol('sub-hData1', 'chkData1'); checkCol('sub-hData2', 'chkData2');
    checkCol('sub-header1', 'use_header1'); checkCol('sub-header2', 'use_header2'); 
    checkCol('sub-footer1', 'use_footer1'); checkCol('sub-footer2', 'use_footer2');
    checkCol('sub-ctl', 'use_ctl'); checkCol('sub-ctr', 'use_ctr');
    checkCol('sub-cbl', 'use_cbl'); checkCol('sub-cbr', 'use_cbr');
    checkCol('sub-pageNum', 'use_pageNum');
};

document.addEventListener('DOMContentLoaded', () => {
    let prefixes = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum', 'cell'];
    prefixes.forEach(p => {
        if(typeof window.setupAdvancedUploader === 'function') {
            window.setupAdvancedUploader(p + 'ColorInput', p + 'ColorImage');
            window.setupAdvancedUploader(p + 'BgInput', p + 'BgImage');
            window.setupAdvancedUploader(p + 'BorderInput', p + 'BorderImage');
        }
    });
    if(typeof window.setupAdvancedUploader === 'function') window.setupAdvancedUploader('bgInput', 'bgImage');
    
    window.updateUI();
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('input', () => { 
            if(typeof window.drawCanvas === 'function') window.drawCanvas(); 
            if(typeof window.debouncedSave === 'function') window.debouncedSave();
        });
        if (el.tagName === 'SELECT' || el.type === 'checkbox') el.addEventListener('change', () => { 
            window.updateUI(); 
            if(typeof window.drawCanvas === 'function') window.drawCanvas(); 
            if(typeof window.debouncedSave === 'function') window.debouncedSave();
        });
    });
});

// ==========================================
// 3. DRM, MOBILE MODAL VÀ KÉO THẢ (GIỮ GỐC)
// ==========================================
window.activeMobileElement = null; window.placeholderNode = null;
// Xóa các hàm Mobile Modal trùng lặp để dùng thống nhất từ main.js
// --- PHỐI MÀU AI (V25) ---
window.applyAIColor = function(prefix) {
    const list = typeof window.parseList === 'function' ? window.parseList() : [];
    let designMenh = 'KIM'; // Mặc định
    if (list.length > 0) {
        let firstSim = list[0][0] || "";
        designMenh = (typeof getMenhFromPhone === 'function' ? getMenhFromPhone(firstSim) : 'KIM') || 'KIM';
    }

    const aiPalettes = {
        'KIM': { main: '#ff9900', sub: '#ffffff', grad: '#ffd700' },
        'MỘC': { main: '#0a8f0a', sub: '#ffffff', grad: '#2ecc71' },
        'THỦY': { main: '#0066ff', sub: '#ffffff', grad: '#3498db' },
        'HỎA': { main: '#ff0000', sub: '#ffffff', grad: '#e74c3c' },
        'THỔ': { main: '#8b4513', sub: '#ffffff', grad: '#d35400' }
    };

    let p = aiPalettes[designMenh] || aiPalettes['KIM'];
    
    // Áp dụng màu cho prefix hiện tại
    let colorEl = document.getElementById(prefix + 'Color');
    let colorMode = document.getElementById(prefix + 'ColorMode');
    let grad1 = document.getElementById(prefix + 'ColorGradient1');
    let grad2 = document.getElementById(prefix + 'ColorGradient2');

    if (colorEl) colorEl.value = p.main;
    if (grad1) grad1.value = p.main;
    if (grad2) grad2.value = p.grad;
    
    // Nếu là nền, áp dụng cho nền
    let bgEl = document.getElementById(prefix + 'Bg');
    if (bgEl) {
        bgEl.value = p.main;
        let bgG1 = document.getElementById(prefix + 'BgGradient1');
        let bgG2 = document.getElementById(prefix + 'BgGradient2');
        if (bgG1) bgG1.value = p.main;
        if (bgG2) bgG2.value = p.grad;
    }

    if (prefix === 'all') {
        const prefixes = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2'];
        prefixes.forEach(pf => {
            let colorEl = document.getElementById(pf + 'Color');
            if (colorEl) colorEl.value = p.main;
            let g1 = document.getElementById(pf + 'ColorGradient1');
            let g2 = document.getElementById(pf + 'ColorGradient2');
            if (g1) g1.value = p.main;
            if (g2) g2.value = p.grad;
        });
        alert(`✨ AI đã phối màu ĐỒNG BỘ cho mệnh ${designMenh}!`);
    } else {
        alert(`✨ AI đã gợi ý bộ màu cho mệnh ${designMenh}!`);
    }
    
    if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
}

window.exportToPDF = async function() {
    const { jsPDF } = window.jspdf;
    const list = typeof window.parseList === 'function' ? window.parseList() : [];
    const r = parseInt(document.getElementById('tableRows')?.value) || 10;
    const c = parseInt(document.getElementById('tableCols')?.value) || 2;
    const totalCells = r * c;
    const totalPages = Math.max(1, Math.ceil(list.length / totalCells));
    
    const loading = document.getElementById('globalLoading');
    if (loading) loading.style.display = 'flex';
    const lText = document.getElementById('loadingText');
    if (lText) lText.innerText = "Đang chuẩn bị PDF...";

    try {
        const oldStep = window.currentStep;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [canvas.width / getVal('exportScale', 1), canvas.height / getVal('exportScale', 1)]
        });

        for (let i = 0; i < totalPages; i++) {
            if (lText) lText.innerText = `Đang xử lý trang ${i + 1}/${totalPages}`;
            window.currentStep = i;
            await new Promise(resolve => {
                window.drawCanvas();
                setTimeout(resolve, 300); // Đợi canvas vẽ xong
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        }

        pdf.save(`VIP_SIM_CATALOG_${new Date().getTime()}.pdf`);
        window.currentStep = oldStep;
        window.drawCanvas();
    } catch (err) {
        console.error(err);
        alert("❌ Lỗi khi xuất PDF!");
    } finally {
        if (loading) loading.style.display = 'none';
    }
};

// Kéo thả & DRM
function setupDrag(elementId, handleId) {
    const el = document.getElementById(elementId); 
    const handle = document.getElementById(handleId) || el;
    if(!el || !handle) return; 
    let isDragging = false, moved = false, startX, startY, initX, initY;
    
    const start = (e) => { 
        if(['BUTTON','INPUT','SELECT','A'].includes(e.target.tagName)) return; 
        isDragging = true; moved = false; 
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; 
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY; 
        startX = clientX; startY = clientY; 
        
        let rect = el.getBoundingClientRect();
        initX = rect.left; 
        initY = rect.top; 
        
        // Cố định vị trí hiện tại bằng left/top để tránh nhảy khi gỡ bottom/right
        el.style.left = initX + 'px'; 
        el.style.top = initY + 'px';
        el.style.bottom = 'auto'; 
        el.style.right = 'auto'; 
        el.style.margin = '0';
        el.style.transform = 'none'; 
    };
    
    const move = (e) => { 
        if(!isDragging) return; 
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; 
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY; 
        let dx = clientX - startX; 
        let dy = clientY - startY; 
        
        if(Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true; 
        if(moved) { 
            e.preventDefault(); 
            let maxX = window.innerWidth - el.offsetWidth; 
            let maxY = window.innerHeight - el.offsetHeight; 
            let newX = Math.max(0, Math.min(initX + dx, maxX));
            let newY = Math.max(0, Math.min(initY + dy, maxY));
            el.style.left = newX + 'px'; 
            el.style.top = newY + 'px'; 
        } 
    };
    
    const end = () => { 
        isDragging = false; 
    };
    
    handle.addEventListener('mousedown', start); 
    handle.addEventListener('touchstart', start, {passive: false}); 
    window.addEventListener('mousemove', move, {passive: false}); 
    window.addEventListener('touchmove', move, {passive: false}); 
    window.addEventListener('mouseup', end); 
    window.addEventListener('touchend', end);
    return () => moved;
}
setupDrag('unifiedMenuContainer', 'unifiedMenuBtn'); 

const STORAGE_ID_KEY = 'SYSTEM_LOG_DATA_CACHED'; const LICENSE_KEY = 'SYSTEM_LICENSE_ACTIVE'; const POS = [2, 5, 9, 14, 20, 27, 35, 44, 54, 59];
document.addEventListener('contextmenu', function(e) { if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.id === 'displayMac') return; e.preventDefault(); }, false);
document.addEventListener('keydown', function(e) { if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode===73||e.keyCode===74||e.keyCode===67)) || (e.ctrlKey && e.keyCode===85) || (e.ctrlKey && e.keyCode===83) || (e.ctrlKey && e.keyCode===80)) { e.preventDefault(); return false; } });
function getDeviceID() { try { let secret = localStorage.getItem(STORAGE_ID_KEY); if (!secret || secret.length < 60) { let charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let rawID = ""; for(let i=0; i<10; i++) rawID += charset.charAt(Math.floor(Math.random() * charset.length)); let junk = ""; for(let i=0; i<60; i++) junk += charset.charAt(Math.floor(Math.random() * charset.length)); let complexArr = junk.split(""); for(let i=0; i<10; i++) { complexArr[POS[i]] = rawID[i]; } secret = complexArr.join(""); localStorage.setItem(STORAGE_ID_KEY, secret); return rawID; } let realID = ""; for(let p of POS) { realID += secret[p]; } return realID; } catch (e) { return "ERROR_ID"; } }
function verifyLicense(keyStr) { if(!keyStr) return false; try { let myMac = getDeviceID(); let decoded = decodeURIComponent(atob(keyStr.split('').reverse().join(''))); let rawData = ""; for(let i=0; i<decoded.length; i++) { rawData += String.fromCharCode(decoded.charCodeAt(i) - 7); } let parts = rawData.split('|||'); if(parts.length !== 2) return false; let keyMac = parts[0]; let expTime = parseInt(parts[1]); if(keyMac === myMac && expTime > Date.now()) { return true; } return false; } catch(e) { return false; } }
function checkLicense() { let savedKey = localStorage.getItem(LICENSE_KEY); let overlay = document.getElementById('drmOverlay'); let macDisplay = document.getElementById('displayMac'); if(macDisplay) macDisplay.innerText = getDeviceID(); if(savedKey && verifyLicense(savedKey)) { if(overlay) overlay.style.display = 'none'; } else { if(overlay) overlay.style.display = 'flex'; } }
function activateLicense() { let keyInput = document.getElementById('licenseKeyInput').value.trim(); let msg = document.getElementById('drmMessage'); if(!keyInput) { msg.innerText = "Vui lòng nhập mã kích hoạt!"; return; } if(verifyLicense(keyInput)) { localStorage.setItem(LICENSE_KEY, keyInput); msg.style.color = "#2ecc71"; msg.innerText = "Kích hoạt thành công! Đang tải lại phần mềm..."; setTimeout(() => { document.getElementById('drmOverlay').style.display='none'; if(typeof window.fitZoom === 'function') window.fitZoom(); }, 1000); } else { msg.style.color = "#e74c3c"; msg.innerText = "Mã kích hoạt sai hoặc đã hết hạn!"; } }
function copyMac() { let mac = document.getElementById('displayMac').innerText; let tempInput = document.createElement("input"); tempInput.value = mac; document.body.appendChild(tempInput); tempInput.select(); tempInput.setSelectionRange(0, 99999); try { document.execCommand("copy"); alert("✅ Đã copy Mã Máy thành công: " + mac); } catch (err) { alert("❌ Vui lòng copy thủ công!"); } document.body.removeChild(tempInput); }
checkLicense();

window.toggleCanvasSizeInputs = function() {
    let mode = document.getElementById('canvasSizeMode')?.value;
    let wrapper = document.getElementById('customCanvasSizeWrapper');
    if(!wrapper) return;
    wrapper.style.display = mode === 'auto' ? 'none' : 'flex';
    let cH = document.getElementById('customCanvasH'); let lH = document.getElementById('labelCustomH');
    if(cH) cH.style.display = mode === 'ratio' ? 'none' : 'block';
    if(lH) lH.style.display = mode === 'ratio' ? 'none' : 'block';
}