// ============================================================================
// MAIN.JS - BẢN FULL V23 (FIX LỖI MẤT TIÊU ĐỀ VÀ DỮ LIỆU)
// ============================================================================
// --- TOAST NOTIFICATION UTILITY ---
function showToast(message) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastNotification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>💬</span> ${message}`;
    toast.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}


const canvas = document.getElementById('preview'); 
const ctx = canvas ? canvas.getContext('2d') : null;
const wrapper = document.getElementById('canvasWrapper');

// --- 1. BIẾN TRẠNG THÁI ---
let hitBoxes = []; window.isExporting = false; window.currentStep = 0;
let currentZoom = 100; let isAutoFit = true;
let isPanning = false, startX, startY, panStartX, panStartY, scrollLeft, scrollTop;
let isDragging = false, dragTarget = null, dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
let hoveredIndex = -1, isDragMoved = false, isFullscreen = false;
let isPressed = false; // QUAN TRỌNG: Kiểm soát trạng thái có đang nhấn chuột hay không
let lastClickTime = 0; 
let longPressTimeout = null;
let isLongPress = false;
let smartGuides = []; // V25: Lưu trữ các đường gióng

// Biến cho Multi-touch Zoom/Pan
let initialDist = 0;
let initialZoom = 100;
let isPinching = false;
let lastTouchX = 0;
let lastTouchY = 0;

window.isSyncingTabs = false; 
window.currentSubSubTab = 'pos'; 

// --- 2. HÀM TIỆN ÍCH CƠ BẢN ---
function getVal(id, def=0) { let el = document.getElementById(id); return el ? (isNaN(parseFloat(el.value)) ? el.value : parseFloat(el.value)) : def; }
function isChecked(id) { let el = document.getElementById(id); return el ? el.checked : false; }
window.getPos = function(base, cellTotal, objSize, align, offset) { 
    if (align === 'center' || align === 'middle') return base + (cellTotal - objSize) / 2 + offset; 
    if (align === 'right' || align === 'bottom') return base + cellTotal - objSize + offset; 
    return base + offset; 
}

// --- 3. DATA NHÀ MẠNG, PHONG THỦY & BẢN ĐỒ ÁNH XẠ CHECKBOX ---
// (Đã chuyển sang js/configs.js)

function getNetworkKey(simNumber) {
    if(!simNumber) return null; let cleanSim = simNumber.replace(/\D/g, ''); 
    if(cleanSim.startsWith('84')) cleanSim = '0' + cleanSim.substring(2); 
    if(cleanSim.length < 9) return null; return window.PREFIX_TO_NETWORK[cleanSim.substring(1, 3)] || null;
}
function getNetworkData(simNumber) { 
    let key = getNetworkKey(simNumber);
    return key ? window.NETWORK_INFO[key] : null; 
}
function getMenhFromPhone(phone){
    let d=phone.replace(/\D/g,'').split('').map(Number); if(d.length===0)return''; 
    let s=d.reduce((a,b)=>a+b,0); while(s>=10)s=s.toString().split('').map(Number).reduce((a,b)=>a+b,0); 
    if(s===1)return'THỦY'; if([2,5,8].includes(s))return'THỔ'; if([3,4].includes(s))return'MỘC'; if([6,7].includes(s))return'KIM'; if(s===9)return'HỎA'; return'';
}

window.formatPriceString = function(str) {
    if (!str || str.toString().trim() === '') return ''; 
    let prefix = document.getElementById('pricePrefix') ? document.getElementById('pricePrefix').value : ''; 
    let suffix = document.getElementById('priceSuffix') ? document.getElementById('priceSuffix').value : ''; 
    let mode = document.getElementById('priceFormatMode') ? document.getElementById('priceFormatMode').value : 'auto'; 
    
    let res = str.toString();
    let cleanStr = res.replace(/,/g, '').replace(/\./g, '').trim();
    let val = parseFloat(cleanStr);
    let hasLetters = /[a-zA-Z]/.test(res); 

    if (hasLetters || isNaN(val)) return (prefix ? prefix + " " : "") + res + (suffix ? " " : "") + suffix;

    if (mode === 'auto_k') { let kVal = Math.floor(val / 1000); res = kVal.toLocaleString('vi-VN') + "K"; }
    else if (mode === 'auto_compact' || mode === 'auto_slang') {
        if (val < 1000000) { res = Math.ceil(val / 1000) + "K"; } 
        else if (val < 1000000000) { let mVal = Math.ceil(val / 100000) / 10; res = Number.isInteger(mVal) ? mVal + "Tr" : (mode === 'auto_slang' ? mVal.toString().replace('.', 'Tr') : mVal + "Tr"); } 
        else { let bVal = Math.ceil(val / 100000000) / 10; res = Number.isInteger(bVal) ? bVal + "Tỷ" : (mode === 'auto_slang' ? bVal.toString().replace('.', 'Tỷ') : bVal + "Tỷ"); }
    }
    else if (mode === 'auto') { 
        if(val >= 1000000000) res = parseFloat((val/1000000000).toFixed(2)) + " Tỷ"; 
        else if(val >= 1000000) res = parseFloat((val/1000000).toFixed(2)) + " Tr"; 
        else if(val >= 1000) res = parseFloat((val/1000).toFixed(1)) + " K"; 
        else res = val.toLocaleString('vi-VN'); 
    }
    else if (mode === 'comma') { res = val.toLocaleString('en-US'); }
    else { res = val.toLocaleString('vi-VN'); }

    return (prefix ? prefix + " " : "") + res + (suffix ? " " : "") + suffix;
};

window.parseList = function() { 
    let lines = document.getElementById('list')?.value.split('\n') || []; let out = []; let filter = document.getElementById('filterMenh')?.value || 'ALL'; 
    lines.forEach(line=>{ 
        try { line = line.replace(/[^\p{L}\p{N}\s.,\-|/=+]/gu, '').trim(); } catch(e) {} 
        if(!line) return; line = line.replace(/^[\-.,=+|/]+\s*/, ''); 
        let p = line.includes('|') ? line.split(/\s*\|\s*/) : line.replace(/\s*=\s*/g, ' ').replace(/\s+-\s+/g, ' ').split(/\s+/);
        let num = p[0]||""; if(filter !== 'ALL' && getMenhFromPhone(num) !== filter) return; 
        out.push([num, p[1]||"", p[2]||"", p.slice(3).join(' ')||""]); 
    }); return out; 
}

// --- 4. HÀM ENGINE ĐỒ HỌA ---
window.getAdvancedStyle = function(ctx, mode, c1, c2, imgObj, x, y, w, h, angle = 0) {
    if (mode === 'gradient') { 
        let rad = (parseFloat(angle) || 0) * Math.PI / 180; let cx = x + w/2; let cy = y + h/2;
        let r = Math.abs((w / 2) * Math.cos(rad)) + Math.abs((h / 2) * Math.sin(rad)); 
        let grad = ctx.createLinearGradient(cx - Math.cos(rad) * r, cy - Math.sin(rad) * r, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r); 
        grad.addColorStop(0, c1 || '#000000'); grad.addColorStop(1, c2 || '#ffffff'); return grad; 
    }
    if (mode === 'image' && imgObj) { let pat = ctx.createPattern(imgObj, 'repeat'); pat.setTransform(new DOMMatrix().translate(x,y).scale(Math.max(w/imgObj.width, h/imgObj.height))); return pat; }
    return c1 || '#000000';
};

function applyShadow(ctx, prefix, shadowType) {
    if(isChecked(prefix + shadowType)) { ctx.shadowOffsetX = getVal(prefix + shadowType + 'X'); ctx.shadowOffsetY = getVal(prefix + shadowType + 'Y'); ctx.shadowBlur = getVal(prefix + shadowType + 'Blur'); ctx.shadowColor = document.getElementById(prefix + shadowType + 'Color')?.value || '#000'; } 
    else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
}

window.buildShapePath = function(ctx, shape, w, h, radius, expand = 0) {
    let minR = Math.max(0, Math.min(w, h) / 2 + expand);
    if (shape === 'circle') { ctx.arc(0, 0, minR, 0, Math.PI * 2); } 
    else if (shape === 'diamond') { ctx.moveTo(0, -minR); ctx.lineTo(minR * 0.8, 0); ctx.lineTo(0, minR); ctx.lineTo(-minR * 0.8, 0); ctx.closePath(); } 
    else if (shape === 'teardrop') { ctx.moveTo(0, -minR); ctx.bezierCurveTo(minR, -minR, minR, minR*0.5, 0, minR); ctx.bezierCurveTo(-minR, minR*0.5, -minR, -minR, 0, -minR); ctx.closePath(); } 
    else if (shape === 'star') { let innerR = minR * 0.4, angle = Math.PI / 5; ctx.moveTo(0, -minR); for (let i = 0; i < 10; i++) { let r = (i % 2 == 0) ? minR : innerR; let a = i * angle - Math.PI / 2; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); } ctx.closePath(); } 
    else if (shape === 'pentagon') { let a = (Math.PI * 2) / 5, start = -Math.PI / 2; ctx.moveTo(minR * Math.cos(start), minR * Math.sin(start)); for (let i = 1; i <= 5; i++) ctx.lineTo(minR * Math.cos(start + i * a), minR * Math.sin(start + i * a)); ctx.closePath(); } 
    else if (shape === 'hexagon') { let a = (Math.PI * 2) / 6, start = -Math.PI / 2; ctx.moveTo(minR * Math.cos(start), minR * Math.sin(start)); for (let i = 1; i <= 6; i++) ctx.lineTo(minR * Math.cos(start + i * a), minR * Math.sin(start + i * a)); ctx.closePath(); } 
    else if (shape === 'octagon') { let a = (Math.PI * 2) / 8, start = -Math.PI / 2; ctx.moveTo(minR * Math.cos(start), minR * Math.sin(start)); for (let i = 1; i <= 8; i++) ctx.lineTo(minR * Math.cos(start + i * a), minR * Math.sin(start + i * a)); ctx.closePath(); } 
    else if (shape === 'rect_square' || shape === 'rect_expand' || shape === 'rect_tight') {
        ctx.rect(-w/2 - expand, -h/2 - expand, w + expand*2, h + expand*2);
    } 
    else {
        // Mặc định là Rect Round
        let r = radius + (expand ? 2 : 0), x = -w/2 - expand, y = -h/2 - expand, ew = w + expand*2, eh = h + expand*2;
        if (ew < 2 * r) r = ew / 2; if (eh < 2 * r) r = eh / 2; if (r < 0) r = 0;
        ctx.moveTo(x + r, y); ctx.arcTo(x + ew, y, x + ew, y + eh, r); ctx.arcTo(x + ew, y + eh, x, y + eh, r); ctx.arcTo(x, y + eh, x, y, r); ctx.arcTo(x, y, x + ew, y, r); ctx.closePath();
    }
}

// ============================================================================
// HÀM VẼ CHÍNH (DRAW PRO ELEMENT) 
// ============================================================================
window.drawProElement = function(ctx, prefix, text, cx, cy, w, h, radius, angle, isCellGrid = false, autoBgColor = null, rowIndex = -1) {
    if (!text && !isCellGrid) return;

    const _v = (id, def) => { let el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : def; };
    const _c = (id) => { let el = document.getElementById(id); return el ? el.checked : false; };

    if (typeof isExporting !== 'undefined' && !window.isExporting && prefix !== 'cell') {
        hitBoxes.push({ id: prefix, inputX: prefix + 'X', inputY: prefix + 'Y', rectX: cx - w/2, rectY: cy - h/2, rectW: w, rectH: h, angle: angle, cx: cx, cy: cy });
    }

    ctx.save(); 
    ctx.translate(cx, cy); 
    if (angle !== 0) ctx.rotate(angle * Math.PI / 180);

    const drawBaseRect = () => {
        let r = radius, x = -w/2, y = -h/2;
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; if (r < 0) r = 0;
        ctx.moveTo(x + r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
    };

    // 1. NỀN Ô
    if (!_c(prefix + 'BgTrans')) {
        ctx.save(); 
        if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'BoxShadow'); 
        ctx.beginPath(); drawBaseRect();
        
        let bgMode = document.getElementById(prefix + 'BgMode')?.value || 'solid';
        let bgC1 = bgMode === 'gradient' ? document.getElementById(prefix + 'BgGradient1')?.value : document.getElementById(prefix + 'Bg')?.value;
        
        // --- LOGIC NGỰA VẰN (ZEBRA) - PHẦN NỀN ---
        if (window.isChecked('useZebra') && rowIndex !== -1 && ['cell', 'num','price','menh','mang','data1','data2'].includes(prefix)) {
            let parity = rowIndex % 2; // 0: Lẻ (1,3,5..), 1: Chẵn (2,4,6..)
            let zPrefix = (parity === 0) ? 'zebraOdd' : 'zebraEven';
            let zebraGen = document.getElementById(zPrefix + 'Bg')?.value;
            
            if (zebraGen) {
                bgMode = 'solid';
                bgC1 = zebraGen;
            }
        }
        
        ctx.fillStyle = window.getAdvancedStyle(ctx, bgMode, bgC1, document.getElementById(prefix + 'BgGradient2')?.value, window[prefix + 'BgImage'], -w/2, -h/2, w, h, _v(prefix + 'BgGradAngle', 0));
        ctx.fill(); 
        ctx.restore();
    }

    // 2. VIỀN Ô
    if (!_c(prefix + 'BorderTrans')) {
        ctx.save(); 
        if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'BorderShadow'); 
        ctx.beginPath(); drawBaseRect();
        
        ctx.lineWidth = _v(prefix + 'BorderW', 1);
        let bdMode = document.getElementById(prefix + 'BorderMode')?.value || 'solid';
        let bdC1 = bdMode === 'gradient' ? document.getElementById(prefix + 'BorderGradient1')?.value : document.getElementById(prefix + 'BorderColor')?.value;
        ctx.strokeStyle = window.getAdvancedStyle(ctx, bdMode, bdC1, document.getElementById(prefix + 'BorderGradient2')?.value, window[prefix + 'BorderImage'], -w/2, -h/2, w, h, _v(prefix + 'BorderGradAngle', 0));
        let bStyle = document.getElementById(prefix + 'BorderStyle')?.value;
        if (bStyle === 'dashed') ctx.setLineDash([10, 5]); else if (bStyle === 'dotted') ctx.setLineDash([3, 5]);
        ctx.stroke(); 
        ctx.restore();
    }

    // 3. KHỐI SHAPE (VIP) — V24: Chỉ vẽ khối khi ô có dữ liệu (không phải cellGrid trống)
    let sType = document.getElementById(prefix + 'ShapeType')?.value || 'none';
    if (sType !== 'none' && sType !== 'text_only' && !isCellGrid) {
        // V24: TÍNH TOÁN KÍCH THƯỚC DYNAMIC (Ưu tiên Checkbox Auto)
        let autoW = _c(prefix + 'ShapeAutoW'); 
        let autoH = _c(prefix + 'ShapeAutoH');
        let swInput = _v(prefix + 'ShapeW', 0); 
        let shInput = _v(prefix + 'ShapeH', 0); 
        
        let sw = swInput > 0 ? swInput : 45; 
        let sh = shInput > 0 ? shInput : 45;
        let sRadius = _v(prefix + 'ShapeRadius', 0);

        if (autoW || autoH || sType.includes('expand')) {
            ctx.save();
            ctx.font = `${_c(prefix + 'Bold') ? 'bold ' : ''}${_c(prefix + 'Italic') ? 'italic ' : ''}${_v(prefix + 'Size', 24)}px "${document.getElementById(prefix + 'Font')?.value || 'Arial'}"`;
            let tW = ctx.measureText(text).width;
            ctx.restore();
            
            // Nếu bật AutoW hoặc là loại expand mà không có kích thước nhập tay
            if (autoW || (sType.includes('expand') && swInput <= 0)) sw = tW + 20; 
            // Nếu bật AutoH hoặc là loại expand mà không có kích thước nhập tay
            if (autoH || (sType.includes('expand') && shInput <= 0)) sh = _v(prefix + 'Size', 24) * 1.5; 
        } else if (sType.includes('tight')) {
            // Gần khít / Vừa khít: Ưu tiên lấy W và H từ input, nếu không có mới dùng cỡ ô
            if (swInput <= 0) sw = w - 8; 
            if (shInput <= 0) sh = h - 8;
        }

        // V24: Dùng autoBgColor nếu có, nếu không dùng màu mặc định xám
        let shapeFillColor = autoBgColor || '#888888';
        
        // --- LOGIC NGỰA VẰN (ZEBRA) - PHẦN KHỐI SHAPE (ÁP DỤNG CHO CÁC CỘT DỮ LIỆU) ---
        if (window.isChecked('useZebra') && rowIndex !== -1 && ['num','price','data1','data2'].includes(prefix)) {
            let parity = rowIndex % 2; 
            let zPrefix = (parity === 0) ? 'zebraOdd' : 'zebraEven';
            let zebraGen = document.getElementById(zPrefix + 'Bg')?.value;
            if (zebraGen) {
                shapeFillColor = zebraGen;
            }
        }
        
        ctx.save();
        if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'ShapeBoxShadow'); 
        
        // V24: Đổ bóng 3D nếu yêu cầu
        if (_c(prefix + 'Shape3D')) {
            ctx.save();
            ctx.translate(2, 2); // Đổ bóng lệch 2px
            ctx.beginPath();
            if (typeof window.buildShapePath === 'function') window.buildShapePath(ctx, sType, sw, sh, sRadius, 0);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
            ctx.restore();
        }

        ctx.beginPath();
        if (typeof window.buildShapePath === 'function') window.buildShapePath(ctx, sType, sw, sh, sRadius, 0);
        ctx.fillStyle = shapeFillColor; ctx.fill(); ctx.restore();

        if (!_c(prefix + 'ShapeBorderTrans')) {
            ctx.save();
            if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'ShapeBorderShadow'); 
            ctx.beginPath();
            if (typeof window.buildShapePath === 'function') window.buildShapePath(ctx, sType, sw, sh, sRadius, 0);
            
            ctx.lineWidth = _v(prefix + 'ShapeBorderW', 2);
            let sbMode = document.getElementById(prefix + 'ShapeBorderMode')?.value || 'solid';
            let sbC1 = sbMode === 'gradient' ? document.getElementById(prefix + 'ShapeBorderGradient1')?.value : document.getElementById(prefix + 'ShapeBorderColor')?.value;
            ctx.strokeStyle = window.getAdvancedStyle(ctx, sbMode, sbC1, document.getElementById(prefix + 'ShapeBorderGradient2')?.value, window[prefix + 'ShapeBorderImage'], -sw/2, -sh/2, sw, sh, _v(prefix + 'ShapeBorderGradAngle', 0));
            let sbStyle = document.getElementById(prefix + 'ShapeBorderStyle')?.value;
            if (sbStyle === 'dashed') ctx.setLineDash([10, 5]); else if (sbStyle === 'dotted') ctx.setLineDash([3, 5]);
            ctx.stroke(); ctx.restore();
        }
    }

    // 4. CHỮ
    if (text && !isCellGrid && text !== ' ') {
        ctx.save();
        ctx.font = `${_c(prefix + 'Bold') ? 'bold ' : ''}${_c(prefix + 'Italic') ? 'italic ' : ''}${_v(prefix + 'Size', 24)}px "${document.getElementById(prefix + 'Font')?.value || 'Arial'}"`;
        
        let clMode = document.getElementById(prefix + 'ColorMode')?.value || 'solid';
        let clC1 = clMode === 'gradient' ? document.getElementById(prefix + 'ColorGradient1')?.value : document.getElementById(prefix + 'Color')?.value;

        // --- LOGIC NGỰA VẰN (ZEBRA) - PHẦN CHỮ ---
        if (window.isChecked('useZebra') && rowIndex !== -1 && ['num','price','menh','mang','data1','data2'].includes(prefix)) {
            let parity = rowIndex % 2; 
            let zPrefix = (parity === 0) ? 'zebraOdd' : 'zebraEven';
            let colKey = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            let zebraTextCol = document.getElementById(zPrefix + colKey + 'Color')?.value;
            
            if (zebraTextCol) {
                clMode = 'solid';
                clC1 = zebraTextCol;
            }
        }

        if (sType === 'text_only' && autoBgColor) clC1 = autoBgColor; 
        
        ctx.fillStyle = window.getAdvancedStyle(ctx, clMode, clC1, document.getElementById(prefix + 'ColorGradient2')?.value, window[prefix + 'ColorImage'], -w/2, -h/2, w, h, _v(prefix + 'ColorGradAngle', 0));
        
        let align = document.getElementById(prefix + 'TextAlign')?.value || 'center';
        let tx = _v(prefix + 'TextX', 0), ty = _v(prefix + 'TextY', 0), pad = _v(prefix + 'TextPad', 0);
        if (align === 'left') { ctx.textAlign = 'left'; tx += (-w / 2 + pad); } else if (align === 'right') { ctx.textAlign = 'right'; tx += (w / 2 - pad); } else { ctx.textAlign = 'center'; }
        
        ctx.textBaseline = 'middle'; let scY = _v(prefix + 'ScaleY', 1); ctx.scale(1, scY);
        if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'ObjShadow');
        ctx.fillText(text, tx, ty / scY);
        
        if (_c(prefix + 'Stroke')) { 
            ctx.lineWidth = _v(prefix + 'StrokeWidth', 1); ctx.strokeStyle = document.getElementById(prefix + 'StrokeColor')?.value || '#fff'; ctx.strokeText(text, tx, ty / scY); 
        }
        ctx.restore();
    }

    // 5. BLUEPRINT UX
    if (!window.isExporting && prefix !== 'cell') {
        if ((typeof dragTarget !== 'undefined' && dragTarget && dragTarget.id === prefix) || (typeof hoveredIndex !== 'undefined' && hoveredIndex !== -1 && hitBoxes[hoveredIndex] && hitBoxes[hoveredIndex].id === prefix)) {
            ctx.save(); 
            ctx.strokeStyle = '#007bff'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); 
            let bX = -w/2 - 5, bY = -h/2 - 5, bW = w + 10, bH = h + 10;
            ctx.strokeRect(bX, bY, bW, bH);
            
            ctx.setLineDash([]); ctx.font = "bold 11px Arial"; ctx.textBaseline = "middle";
            let dName = (window._objNames && window._objNames[prefix]) ? window._objNames[prefix] : prefix.toUpperCase();

            ctx.fillStyle = '#007bff'; let textW = ctx.measureText(dName).width; ctx.fillRect(bX, bY - 18, textW + 10, 18);
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText(dName, bX + 5, bY - 9);

            ctx.fillStyle = '#e74c3c'; let wText = `W: ${Math.round(w)}`; let ww = ctx.measureText(wText).width; ctx.fillRect(-ww/2 - 4, bY + bH, ww + 8, 16);
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(wText, 0, bY + bH + 8);

            ctx.fillStyle = '#27ae60'; let hText = `H: ${Math.round(h)}`; let hw = ctx.measureText(hText).width; ctx.fillRect(bX + bW, -8, hw + 8, 16);
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText(hText, bX + bW + 4, 0);

            ctx.restore();
        }
    }
    ctx.restore();
}

// =========================================================
// 6. HÀM DRAW CANVAS CHÍNH 
// =========================================================
window.drawCanvas = function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 24px Arial";
            ctx.textAlign = "center";
            ctx.fillText("VUI LÒNG KÍCH HOẠT BẢN QUYỀN", canvas.width / 2, canvas.height / 2);
            ctx.font = "16px Arial";
            ctx.fillText("Để sử dụng đầy đủ tính năng của phần mềm", canvas.width / 2, canvas.height / 2 + 40);
        }
        return;
    }
    if(!ctx) return; 
    hitBoxes = []; 
    let list = typeof window.parseList === 'function' ? window.parseList() : []; 
    
    let tCols = window.getVal('tableCols', 2), tRows = window.getVal('tableRows', 10), cW = window.getVal('cellW', 380), cH = window.getVal('cellH', 60);
    let gapX = window.getVal('tableGap', 15), gapY = window.getVal('rowGap', 10), 
        mLeft = window.getVal('mLeft', 30), mRight = window.getVal('mRight', 30), 
        tZoneH = window.getVal('tZoneH', 100), fZoneH = window.getVal('fZoneH', 80);
    
    let bMode = document.getElementById('bindingMode')?.value || 'none';
    let mBind = window.getVal('marginBinding', 80);
    let mNonBind = window.getVal('marginNonBinding', 30);
    
    let chkHead = document.getElementById('showHeaderRow');
    let hasHead = chkHead ? chkHead.checked : false; 
    let headH = hasHead ? window.getVal('headerRowHeight', 50) : 0, headGap = hasHead ? gapY : 0;
    
    let totalTableW = (tCols * cW + Math.max(0, tCols - 1) * gapX);
    let totalTableH = (tRows * cH + Math.max(0, tRows - 1) * gapY);

    let sMode = document.getElementById('canvasSizeMode')?.value || 'auto';
    let imgToDraw = window.globalBgImage || window.bgImage; 
    let scale = window.getVal('exportScale', 1);

    if (sMode === 'ratio' && imgToDraw) {
        let baseW = window.getVal('customCanvasW', 1080); 
        let imgRatio = imgToDraw.height / imgToDraw.width; 
        canvas.width = baseW * scale; canvas.height = (baseW * imgRatio) * scale; 
    } else if (sMode === 'fixed') {
        canvas.width = window.getVal('customCanvasW', 1080) * scale; canvas.height = window.getVal('customCanvasH', 1920) * scale;
    } else {
        // Auto mode
        let curMLeft = (bMode === 'none') ? mLeft : mBind;
        let curMRight = (bMode === 'none') ? mRight : mNonBind;
        let autoW = curMLeft + curMRight + totalTableW;
        let autoH = tZoneH + fZoneH + headH + headGap + totalTableH;
        canvas.width = autoW * scale; canvas.height = autoH * scale;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(scale, scale);
    let cw = canvas.width / scale; let ch = canvas.height / scale;

    // VẼ NỀN TỔNG
    let bgMode = document.getElementById('bgMode')?.value || 'solid';
    if (bgMode === 'image' && imgToDraw) {
        let fitMode = document.getElementById('bgFitMode')?.value || 'stretch';
        ctx.save();
        if (fitMode === 'stretch') ctx.drawImage(imgToDraw, 0, 0, cw, ch);
        else if (fitMode === 'cover') {
            let s = Math.max(cw / imgToDraw.width, ch / imgToDraw.height); let nw = imgToDraw.width * s, nh = imgToDraw.height * s;
            ctx.drawImage(imgToDraw, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
        } else if (fitMode === 'contain' || fitMode === 'contain_trans') {
            if(fitMode === 'contain') { ctx.fillStyle = document.getElementById('bgColor')?.value || '#ffffff'; ctx.fillRect(0, 0, cw, ch); }
            let s = Math.min(cw / imgToDraw.width, ch / imgToDraw.height); let nw = imgToDraw.width * s, nh = imgToDraw.height * s;
            ctx.drawImage(imgToDraw, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
        }
        ctx.restore();
    } else {
        let c1 = (bgMode === 'solid') ? (document.getElementById('bgColor')?.value || '#ffffff') : (document.getElementById('bgGradient1')?.value || '#ffffff');
        let c2 = document.getElementById('bgGradient2')?.value || '#ffffff';
        ctx.fillStyle = window.getAdvancedStyle(ctx, bgMode, c1, c2, null, 0, 0, cw, ch, window.getVal('bgGradAngle', 0));
        ctx.fillRect(0, 0, cw, ch);
    }

    // CĂN LỀ & ĐÓNG GÁY (V2.5.2)
    let tStartX = (cw - totalTableW) / 2; 
    if (bMode === 'single') {
        tStartX = mBind;
    } else if (bMode === 'double') {
        let isOddPage = (window.currentStep % 2 === 0);
        if (isOddPage) tStartX = mBind;
        else tStartX = cw - totalTableW - mBind;
    } else {
        if (sMode === 'auto') tStartX = mLeft;
        else tStartX = mLeft + (cw - mLeft - mRight - totalTableW) / 2;
    }
    let tStartY = tZoneH + headH + headGap;
    let totalCells = tRows * tCols;

    // VẼ TIÊU ĐỀ CỘT
    if (hasHead) {
        for (let c = 0; c < tCols; c++) {
            let cx = tStartX + c * (cW + gapX) + cW/2; 
            let cy = tZoneH + headH/2;
            ['hNum','hPrice','hMenh','hMang','hData1','hData2'].forEach(p => {
                let chkId = window.colCheckMap[p]; 
                let chkEl = document.getElementById(chkId);
                if(!chkEl || chkEl.checked) {
                    let w = window.getVal(p+'W', 100), h = window.getVal(p+'H', 40);
                    let px = window.getPos(cx-cW/2, cW, w, document.getElementById(p+'AlignX')?.value || 'center', window.getVal(p+'X', 0)) + w/2;
                    let py = window.getPos(cy-headH/2, headH, h, document.getElementById(p+'AlignY')?.value || 'middle', window.getVal(p+'Y', 0)) + h/2;
                    window.drawProElement(ctx, p, document.getElementById(p+'Text')?.value, px, py, w, h, window.getVal(p+'Radius'), window.getVal(p+'Angle'));
                }
            });
        }
    }

    // =========================================================
    // VẼ DỮ LIỆU (ĐÃ SỬA: ĐỔ TỪ TRÊN XUỐNG DƯỚI, HẾT CỘT RỒI MỚI SANG)
    // =========================================================
    let drawList = list.slice(window.currentStep * totalCells, (window.currentStep + 1) * totalCells);
    let pKeys = ['num','price','menh','mang','data1','data2'];
    
    // Vòng lặp ngoài chạy theo Cột (c), Vòng lặp trong chạy theo Hàng (r)
    for (let c = 0; c < tCols; c++) {
        for (let r = 0; r < tRows; r++) {
            let i = c * tRows + r; // Tính toán Index dữ liệu dựa trên cột và hàng
            if (i >= totalCells) continue; // Bỏ qua nếu vượt quá tổng số ô

            // Tính toán tọa độ x, y cho ô hiện tại
            let cx = tStartX + c * (cW + gapX) + cW/2; 
            let cy = tStartY + r * (cH + gapY) + cH/2;
            
            window.drawProElement(ctx, 'cell', ' ', cx, cy, cW, cH, window.getVal('cellRadius'), 0, true, null, r);

            // Lấy dữ liệu cho ô
            let rowData = drawList[i]; 
            let num = rowData ? (rowData[0] || "") : "";
            let priceText = rowData ? (typeof window.formatPriceString === 'function' ? window.formatPriceString(rowData[1]) : (rowData[1] || "")) : "";
            
            // Ưu tiên lấy Mệnh/Mạng từ dữ liệu dán vào (rowData[2], rowData[3])
            let inputMenh = rowData ? (rowData[2] || "").trim() : "";
            let inputMang = rowData ? (rowData[3] || "").trim() : "";
            
            // Xử lý Mệnh: LUÔN TỰ ĐỘNG từ số điện thoại
            let rawMenh = rowData ? (typeof window.getMenhFromPhone === 'function' ? window.getMenhFromPhone(num) : "") : "";
            let mMode = document.getElementById('menhMode')?.value || 'proper';
            let mPre = document.getElementById('menhPrefix')?.value || '';
            let mSuf = document.getElementById('menhSuffix')?.value || '';
            
            let formattedMenh = rawMenh;
            if (mMode === 'short') formattedMenh = rawMenh.charAt(0);
            else if (mMode === 'proper') formattedMenh = rawMenh.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            // Nếu upper thì giữ nguyên rawMenh (vì getMenhFromPhone đã trả về Uppercase)
            
            let menhText = rawMenh ? (mPre + formattedMenh + mSuf) : "";
            
            // Xử lý Mạng: LUÔN TỰ ĐỘNG từ số điện thoại
            let netKey = rowData ? (typeof window.getNetworkKey === 'function' ? window.getNetworkKey(num) : null) : null;
            let netData = rowData ? (typeof window.getNetworkData === 'function' ? window.getNetworkData(num) : null) : null;
            let mModeNet = document.getElementById('mangMode')?.value || 'proper';
            let mPreNet = document.getElementById('mangPrefix')?.value || '';
            let mSufNet = document.getElementById('mangSuffix')?.value || '';
            
            let rawMang = "";
            if (netData) {
                if (mModeNet === 'proper') {
                    // Chế độ 1: Viết hoa đầu tự động từ short2 (VINA -> Vina)
                    let base = netData.short2 || "";
                    rawMang = base.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                } else if (mModeNet === 'short2') {
                    // Chế độ 2: Lấy nguyên văn từ short2 (VINA)
                    rawMang = netData.short2 || "";
                } else if (mModeNet === 'key') {
                    // Chế độ 3: Lấy mã rút gọn (VT, VN)
                    rawMang = netKey || "";
                } else if (mModeNet === 'short1') {
                    // Chế độ 4: Lấy dữ liệu chuẩn từ short1 (Vinaphone)
                    rawMang = netData.short1 || "";
                } else {
                    rawMang = netData.short2 || "";
                }
            } else {
                rawMang = "SIM";
            }
            
            let mangText = (rawMang && rawMang !== "SIM") ? (mPreNet + rawMang + mSufNet) : "";
 
             // vList mapping: num(0), price(1), menh(2), mang(3), data1(4), data2(5)
             let vList = [num, priceText, menhText, mangText, rowData ? (rowData[2]||"") : "", rowData ? (rowData[3]||"") : ""];
             
             pKeys.forEach((p, idx) => {
                 let chkId = window.colCheckMap[p]; 
                 let chkEl = document.getElementById(chkId);
                 if (!chkEl || chkEl.checked) {
                     let w = window.getVal(p+'W', 100), h = window.getVal(p+'H', 40);
                     let px = window.getPos(cx-cW/2, cW, w, document.getElementById(p+'AlignX')?.value || 'center', window.getVal(p+'X', 0)) + w/2;
                     let py = window.getPos(cy-cH/2, cH, h, document.getElementById(p+'AlignY')?.value || 'middle', window.getVal(p+'Y', 0)) + h/2;
                     
                     if (rowData && vList[idx] !== "" && vList[idx] !== undefined) {
                         let autoColor = null;
                         if (p === 'menh') autoColor = window.menhColors[rawMenh] || null; // Dùng rawMenh để lấy màu
                         if (p === 'mang') autoColor = netData ? netData.color : null;
                         
                         window.drawProElement(ctx, p, vList[idx], px, py, w, h, window.getVal(p+'Radius'), window.getVal(p+'Angle'), false, autoColor, r);
                     } else {
                         window.drawProElement(ctx, p, ' ', px, py, w, h, window.getVal(p+'Radius'), window.getVal(p+'Angle'), true, null, r);
                     }
                 }
             });
        }
    }

    // VẼ HEADER, FOOTER...
    ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum'].forEach(g => {
        let chkEl = document.getElementById('use_'+g);
        if(chkEl && chkEl.checked) {
            let txt = document.getElementById(g+'Text')?.value || '';
            if(g === 'pageNum') txt = txt.replace(/\{p\}/gi, window.currentStep + 1).replace(/\{t\}/gi, Math.max(1, Math.ceil(list.length / (totalCells))));
            
            let w = window.getVal(g+'W', 200), h = window.getVal(g+'H', 40), 
                axInput = document.getElementById(g+'AlignX')?.value || 'center', 
                ay = document.getElementById(g+'AlignY')?.value || 'top';
            
            let ax = axInput;
            if (ax === 'auto') {
                if (bMode === 'double') {
                    // Trang lẻ (1, 3... currentStep 0, 2...): Gáy Trái -> Chữ dạt Phải
                    // Trang chẵn (2, 4... currentStep 1, 3...): Gáy Phải -> Chữ dạt Trái
                    ax = (window.currentStep % 2 === 0) ? 'right' : 'left';
                } else {
                    ax = 'center'; 
                }
            }

            let curMLeft = (bMode === 'none') ? mLeft : mBind;
            let curMRight = (bMode === 'none') ? mRight : mNonBind;
            if (bMode === 'double') {
                 if (window.currentStep % 2 === 0) { curMLeft = mBind; curMRight = mNonBind; }
                 else { curMLeft = mNonBind; curMRight = mBind; }
            }

            let gx = (ax==='left') ? curMLeft+w/2 : (ax==='right' ? cw-curMRight-w/2 : cw/2);
            let gy = (ay==='bottom') ? (ch - fZoneH/2) : (ay==='middle' ? ch/2 : tZoneH/2);
            window.drawProElement(ctx, g, txt, gx + window.getVal(g+'X', 0), gy + window.getVal(g+'Y', 0), w, h, window.getVal(g+'Radius', 0), window.getVal(g+'Angle', 0));
        }
    });

    // OVERLAY
    if (window.overlayImage && isChecked('useOverlay')) {
        ctx.save(); let fit = document.getElementById('overlayFitMode')?.value || 'stretch';
        if (fit === 'stretch') { ctx.drawImage(window.overlayImage, 0, 0, cw, ch); } 
        else if (fit === 'cover') { let s = Math.max(cw / window.overlayImage.width, ch / window.overlayImage.height); let nw = window.overlayImage.width * s, nh = window.overlayImage.height * s; ctx.drawImage(window.overlayImage, (cw - nw) / 2, (ch - nh) / 2, nw, nh); } 
        else if (fit === 'contain') { let s = Math.min(cw / window.overlayImage.width, ch / window.overlayImage.height); let nw = window.overlayImage.width * s, nh = window.overlayImage.height * s; ctx.drawImage(window.overlayImage, (cw - nw) / 2, (ch - nh) / 2, nw, nh); }
        ctx.restore();
    }

    // V25: WATERMARK
    if (isChecked('useWatermark')) {
        ctx.save(); ctx.font = 'bold 20px Arial'; ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let wmText = document.getElementById('watermarkText')?.value || 'VIP SIM TOOL';
        for(let i=0; i<3; i++) {
            for(let j=0; j<5; j++) {
                ctx.save(); ctx.translate(cw/3 * (i+0.5), ch/5 * (j+0.5)); ctx.rotate(-Math.PI/4);
                ctx.fillText(wmText, 0, 0); ctx.restore();
            }
        }
        ctx.restore();
    }

    if(typeof window.updateZoomUI === 'function') window.updateZoomUI();
    if(typeof window.updatePagination === 'function') window.updatePagination();
};

// ============================================================================
// 7. CÁC HÀM TƯƠNG TÁC (ZOOM, PANNING, DRAG & DROP, AUTO-SYNC)
// ============================================================================
document.addEventListener('input', function(e) { if (e.target.closest('.pro-box')) { if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas(); } });
document.addEventListener('change', function(e) { if (e.target.closest('.pro-box')) { if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas(); } });

window.updateZoomUI = function() {
    if (!canvas || !canvas.width || !wrapper) return;
    if (isAutoFit) {
        let expScale = (typeof getVal === 'function' ? getVal('exportScale', 1) : 1);
        let baseW = canvas.width / expScale;
        let baseH = canvas.height / expScale;
        
        let isMobile = window.innerWidth <= 768;
        // Tối ưu Padding cho Mobile (20px) và Desktop (100px)
        let padX = isMobile ? 20 : 100;
        let padY = isMobile ? 40 : 160;

        let zX = (wrapper.clientWidth - padX) / baseW;
        let zY = (wrapper.clientHeight - padY) / baseH;
        let z = Math.min(zX, zY) * 100;
        currentZoom = Math.floor(z < 5 ? 5 : (z > 400 ? 400 : z));
    }

    let zSlider = document.getElementById('zoomSlider'); if (zSlider) zSlider.value = currentZoom;
    let zValTxt = document.getElementById('zoomVal'); if (zValTxt) zValTxt.innerText = currentZoom + '%';
    let expScale = (typeof getVal === 'function' ? getVal('exportScale', 1) : 1);
    canvas.style.width = Math.floor((canvas.width / expScale) * currentZoom / 100) + 'px';
    canvas.style.height = 'auto';
};

window.fitZoom = function() { 
    isAutoFit = true; 
    window.updateZoomUI(); 
    // Cuộn về 0,0 - CSS margin:auto sẽ lo phần căn giữa nếu ảnh nhỏ
    if(wrapper) { wrapper.scrollTop = 0; wrapper.scrollLeft = 0; } 
};

window.applyZoom = function(val) { 
    let oldZoom = currentZoom;
    currentZoom = parseInt(val); 
    isAutoFit = false; 
    window.updateZoomUI();
};


if(wrapper) {
    wrapper.addEventListener('mousedown', (e) => { 
        // v26.6: Bảo vệ PAN - Chỉ cho phép Pan khi click vào vùng trống (không phải canvas đang xử lý object)
        if (e.target !== canvas && e.target !== wrapper) return;
        if (typeof isDragging !== 'undefined' && isDragging) return; 
        
        isPressed = true; // Khởi tạo nhấn chuột tại wrapper
        isPanning = true; 
        panStartX = e.pageX - wrapper.offsetLeft; 
        panStartY = e.pageY - wrapper.offsetTop; 
        scrollLeft = wrapper.scrollLeft; 
        scrollTop = wrapper.scrollTop; 
    });
    wrapper.addEventListener('mouseleave', () => { isPanning = false; isPressed = false; hoveredIndex = -1; if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); });
    canvas.addEventListener('mouseleave', () => { hoveredIndex = -1; if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); });
    wrapper.addEventListener('mouseup', () => { isPanning = false; isPressed = false; });

    wrapper.addEventListener('mousemove', (e) => { 
        if (!isPanning) return; 
        e.preventDefault(); 
        wrapper.scrollLeft = scrollLeft - (e.pageX - wrapper.offsetLeft - panStartX) * 1.5; 
        wrapper.scrollTop = scrollTop - (e.pageY - wrapper.offsetTop - panStartY) * 1.5; 
    });

    // Zoom bằng con lăn chuột
    wrapper.addEventListener('wheel', (e) => {
        let delta = e.deltaY;
        let zoomStep = 8;
        if (delta < 0) {
            currentZoom += zoomStep;
        } else {
            currentZoom -= zoomStep;
        }

        // Giới hạn zoom từ 10% đến 400%
        if (currentZoom < 10) currentZoom = 10;
        if (currentZoom > 400) currentZoom = 400;

        isAutoFit = false;
        window.updateZoomUI();
        
        // Ngăn trình duyệt cuộn dọc khi đang zoom trong khung
        e.preventDefault();
    }, { passive: false });
}

function getPointerPos(canvas, clientX, clientY) {
    var rect = canvas.getBoundingClientRect(); let expScale = parseFloat(document.getElementById('exportScale')?.value) || 1;
    return { x: (clientX - rect.left) * ((canvas.width / expScale) / rect.width), y: (clientY - rect.top) * ((canvas.height / expScale) / rect.height) };
}

let pendingTarget = null;
function handleInteractStart(clientX, clientY) {
    isPressed = true; // Bắt đầu trạng thái nhấn
    isPanning = true; // Mặc định là cho phép PAN nếu không trúng đối tượng nào
    isDragMoved = false; isLongPress = false; isDragging = false; 
    let pos = getPointerPos(canvas, clientX, clientY);
    pendingTarget = null;
    
    // Lưu vị trí bắt đầu để PAN
    startX = clientX; startY = clientY;
    if (wrapper) { scrollLeft = wrapper.scrollLeft; scrollTop = wrapper.scrollTop; }

    let currentTime = new Date().getTime();
    lastClickTime = currentTime;

    for (let i = hitBoxes.length - 1; i >= 0; i--) {
        let box = hitBoxes[i];
        let isInside = false;
        if (!box.angle || box.angle === 0) {
            isInside = (pos.x >= box.rectX && pos.x <= box.rectX + box.rectW && pos.y >= box.rectY && pos.y <= box.rectY + box.rectH);
        } else {
            let rad = -box.angle * Math.PI / 180;
            let cos = Math.cos(rad), sin = Math.sin(rad);
            let dx = pos.x - box.cx, dy = pos.y - box.cy;
            let rx = dx * cos - dy * sin;
            let ry = dx * sin + dy * cos;
            isInside = (Math.abs(rx) <= box.rectW / 2 && Math.abs(ry) <= box.rectH / 2);
        }

        if (isInside) {
            let lockCheck = document.getElementById(box.id + 'Locked'); 
            let isLocked = lockCheck && lockCheck.checked;
            pendingTarget = { ...box, isLocked };
            
            if (isLocked) {
                showToast("🔒 Đối tượng đang KHÓA. Hãy mở khóa để kéo thả!");
                isPanning = false; // QUAN TRỌNG: Không cho phép kéo màn hình khi trúng đối tượng bị khóa
            } else {
                showToast("🔓 GIỮ 1 GIÂY để kéo thả hoặc KHÓA để cố định vị trí!");
                isPanning = false; // QUAN TRỌNG: Mặc định tắt PAN để chuẩn bị cho Long-press
                
                // Khởi tạo Long-press (Nhấn giữ 350ms để bắt đầu kéo) - Giảm từ 500ms theo yêu cầu
                clearTimeout(longPressTimeout);
                longPressTimeout = setTimeout(() => {
                    if (!isDragMoved && pendingTarget && !pendingTarget.isLocked) {
                        isLongPress = true;
                        isDragging = true;
                        dragTarget = pendingTarget;
                        dragStartX = pos.x; dragStartY = pos.y;
                        let elX = document.getElementById(dragTarget.inputX); dragStartOffsetX = elX ? parseInt(elX.value)||0 : 0;
                        let elY = document.getElementById(dragTarget.inputY); dragStartOffsetY = elY ? parseInt(elY.value)||0 : 0;
                        if (typeof window.saveState === 'function') window.saveState();
                        canvas.style.cursor = 'grabbing';
                        isPanning = false;
                    }
                }, 350); 
            }

            return true; 
        }
    }
    return false;
}


function handleInteractMove(clientX, clientY) {
    if (!isPressed) {
        // --- CHỈ XỬ LÝ HOVER NẾU KHÔNG NHẤN CHUỘT ---
        let pos = getPointerPos(canvas, clientX, clientY); let foundIdx = -1;
        for (let i = hitBoxes.length - 1; i >= 0; i--) {
            let box = hitBoxes[i];
            let isInside = false;
            if (!box.angle || box.angle === 0) { isInside = (pos.x >= box.rectX && pos.x <= box.rectX + box.rectW && pos.y >= box.rectY && pos.y <= box.rectY + box.rectH); } 
            else {
                let rad = -box.angle * Math.PI / 180; let cos = Math.cos(rad), sin = Math.sin(rad);
                let dx_h = pos.x - box.cx, dy_h = pos.y - box.cy;
                let rx = dx_h * cos - dy_h * sin; let ry = dx_h * sin + dy_h * cos;
                isInside = (Math.abs(rx) <= box.rectW / 2 && Math.abs(ry) <= box.rectH / 2);
            }
            if (isInside) { foundIdx = i; break; }
        }
        if (hoveredIndex !== foundIdx) {
            hoveredIndex = foundIdx;
            if (foundIdx !== -1) { let box = hitBoxes[foundIdx], lockCheck = document.getElementById(box.id + 'Locked'); canvas.style.cursor = (lockCheck && lockCheck.checked) ? 'pointer' : 'grab'; } 
            else canvas.style.cursor = 'default';
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
        }
        return; 
    }

    let dx = clientX - startX; 
    let dy = clientY - startY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    
    // v26.6: Cảm biến di chuyển Threshold 5px để hỗ trợ click chính xác trên mobile
    if (dist > 5) {
        if (!isDragging && !isLongPress && dist > 20) {
            clearTimeout(longPressTimeout);
            isPanning = true; // Quay lại cho phép PAN màn hình
        }
        isDragMoved = true;
    }


    if (isDragging && dragTarget && isLongPress) {
        // --- CHẾ ĐỘ KÉO ĐỐI TƯỢNG (Sau khi Long-press thành công) ---
        isDragMoved = true; 
        let pos = getPointerPos(canvas, clientX, clientY); 
        let dX_obj = pos.x - dragStartX; let dY_obj = pos.y - dragStartY;
        
        let nx = dragStartOffsetX + dX_obj, ny = dragStartOffsetY + dY_obj;
        let inputXEl = document.getElementById(dragTarget.inputX), inputYEl = document.getElementById(dragTarget.inputY);
        if (inputXEl) inputXEl.value = Math.round(nx);
        if (inputYEl) inputYEl.value = Math.round(ny);
        
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
    } else if (isPanning && isDragMoved && wrapper) {
        // --- CHẾ ĐỘ KÉO MÀN HÌNH (PAN) ---
        wrapper.scrollLeft = scrollLeft - dx;
        wrapper.scrollTop = scrollTop - dy;
    }
}


function handleInteractEnd(e) {
    if (!e) return;
    
    // v26.6: SIÊU BẢO VỆ UI - Bỏ qua xử lý nếu click trúng các thanh điều khiển
    if (e.target && (
        e.target.closest('.zoom-bar') || 
        e.target.closest('#quickSliderContainer') || 
        e.target.closest('.unified-menu-container') ||
        e.target.closest('.mobile-modal-header-area')
    )) {
        console.log("Interact: UI control detected, ignoring canvas close logic");
        return;
    }
    
    // v26.6: SIÊU BẢO VỆ SIDEBAR - Kiểm tra tọa độ vật lý (Fix lỗi trượt thanh kéo tắt popup)
    let modalEl = document.getElementById('mobileSettingModal');
    if (modalEl && modalEl.style.display === 'flex') {
        let rect = modalEl.getBoundingClientRect();
        // Thêm vùng đệm lề 15px để chống chuột trượt nhanh khi kéo thanh trượt
        let buffer = 15;
        if (e.clientX >= (rect.left - buffer) && e.clientX <= (rect.right + buffer) && 
            e.clientY >= (rect.top - buffer) && e.clientY <= (rect.bottom + buffer)) {
            return; 
        }
    }
    
    if (e.target && (e.target.closest('#mobileSettingModal') || e.target.id === 'mobileSettingModal')) return;
    
    clearTimeout(longPressTimeout);
    let targetRef = isDragging ? dragTarget : pendingTarget;
    let wasLongPress = isLongPress;

    const isFS = window.isFullscreen || document.getElementById('previewColumn')?.classList.contains('fullscreen') || false;
    canvas.style.cursor = hoveredIndex !== -1 ? 'grab' : 'default';

    if (isDragMoved && wasLongPress) {
        // Vừa kết thúc kéo đối tượng
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
        if (typeof window.debouncedSave === 'function') window.debouncedSave();
        setTimeout(() => { window.isOpeningModal = false; }, 100);
    } else if (!isDragMoved && !wasLongPress && targetRef) {
        // v26.3 Debug logs
        console.log("Interact: Click detected on ID:", targetRef.id, "Fullscreen:", isFS);

        // Click nhanh -> Mở modal
        window.isOpeningModal = true; 
        if (isFS || window.innerWidth <= 768) { 
            if (typeof window.openMobileModal === 'function') {
                console.log("Calling openMobileModal for:", targetRef.id);
                window.openMobileModal(targetRef.id); 
            }
        } 
        else { 
            if (typeof window.focusDesktopTab === 'function') {
                console.log("Calling focusDesktopTab for:", targetRef.id);
                window.focusDesktopTab(targetRef.id); 
            }
        }
        setTimeout(() => { window.isOpeningModal = false; }, 200);
    } else if (!isDragMoved && !isLongPress && !targetRef) {
        // v26.4: Bấm vùng trống -> Tự động đóng Popup luôn
        if (window.innerWidth <= 768 || isFS) {
            if (!document.body.classList.contains('studio-mode')) {
                if (typeof window.closeMobileModal === 'function') {
                    console.log("Interact: Blank click, auto closing modal");
                    window.closeMobileModal();
                }
            }
        }
    }



    // v26.6: Bảo vệ Pinch - Nếu đang Zoom 2 ngón tay thì KHÔNG đóng popup
    if (typeof isPinching !== 'undefined' && isPinching) {
        isPinching = false;
        return; 
    }

    isDragging = false; dragTarget = null; pendingTarget = null;
    isLongPress = false; isDragMoved = false; isPanning = false;
    isPressed = false; // QUAN TRỌNG: Kết thúc trạng thái nhấn
    smartGuides = [];
}



if(canvas) {
    canvas.addEventListener('touchstart', function(e) { 
        if(e.touches.length === 1) { 
            let handled = handleInteractStart(e.touches[0].clientX, e.touches[0].clientY); 
            if(handled) e.preventDefault(); 
        } else if (e.touches.length === 2 && wrapper) {
            // Khởi tạo Pinch Zoom
            isPinching = true;
            initialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            initialZoom = currentZoom;
            lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            e.preventDefault();
        }
    }, {passive: false});

    window.addEventListener('mousemove', function(e) { 
        if (isDragging) { e.preventDefault(); handleInteractMove(e.clientX, e.clientY); } 
        else { if (e.target === canvas || (e.target.closest && e.target.closest('#canvasWrapper'))) { handleInteractMove(e.clientX, e.clientY); } } 
    }, {passive: false});

    window.addEventListener('touchmove', function(e) {
        if (isDragging) {
            e.preventDefault();
            handleInteractMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (isPinching && e.touches.length === 2 && wrapper) {
            e.preventDefault();
            // 1. Pinch Zoom
            let currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            let zoomFactor = currentDist / initialDist;
            let newZoom = Math.max(10, Math.min(400, initialZoom * zoomFactor));
            if (Math.abs(newZoom - currentZoom) > 1) {
                applyZoom(newZoom);
            }
            
            // 2. Two-finger Pan
            let currentTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            let currentTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            wrapper.scrollLeft -= (currentTouchX - lastTouchX) * 1.5;
            wrapper.scrollTop -= (currentTouchY - lastTouchY) * 1.5;
            lastTouchX = currentTouchX;
            lastTouchY = currentTouchY;
        }
    }, {passive: false});

    window.addEventListener('touchend', function(e) { 
        if (e.touches.length === 0) { 
            handleInteractEnd(e); 
            isPinching = false;
        } else if (e.touches.length === 1) {
            isPinching = false;
        }
    });

    canvas.addEventListener('mousedown', function(e) { 
        let handled = handleInteractStart(e.clientX, e.clientY); 
        if(handled) e.preventDefault();
    });
    window.addEventListener('mouseup', function(e) { handleInteractEnd(e); });
}

window.closeMobileModal = function() {
    let modalEl = document.getElementById('mobileSettingModal'); if (modalEl) modalEl.style.display = 'none';
    
    // v26.6: KHÔNG tự động thoát Studio Mode khi đóng Popup. 
    // Việc thoát Studio Mode chỉ được thực hiện bởi toggleFullscreen().


    document.querySelectorAll('.m-tab-lvl1').forEach(btn => btn.classList.remove('active'));
    if (window.activeMobileElement && window.placeholderNode && window.placeholderNode.parentNode) {
        window.placeholderNode.parentNode.insertBefore(window.activeMobileElement, window.placeholderNode);
        window.placeholderNode.parentNode.removeChild(window.placeholderNode);
    }
    window.activeMobileElement = null; window.placeholderNode = null;
    let activeTabBtn = document.querySelector('.tab-btn.active'); if(activeTabBtn) activeTabBtn.click();
    let activeSubTabBtn = document.querySelector('.tab-content.active .sub-tab-btn.active'); if(activeSubTabBtn) activeSubTabBtn.click();
};

window.currentUXCategory = 'pos'; 
let isSyncingTab = false;

window.switchTab = function(tabId, btn) { 
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active')); 
    let target = document.getElementById(tabId); 
    if(target) target.classList.add('active'); 
    if(btn) btn.classList.add('active'); 
    
    // Trên Desktop, khi chuyển Level 1, ta cần sync sâu vào tab con đang active bên trong nó
    setTimeout(() => {
        if (target) {
            let activeSub = target.querySelector('.sub-tab-content.active') || target;
            if (typeof syncTabUX === 'function') syncTabUX(activeSub); 
        }
    }, 50);

    if (typeof window.updateMobileNavUI === 'function') setTimeout(window.updateMobileNavUI, 10);
};

window.switchSubTab = function(subTabId, btn) {
    if (!btn) return;
    const parent = btn.closest('.tab-content');
    if (!parent) return;
    
    parent.querySelectorAll('.sub-tabs:first-child .sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    parent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(subTabId);
    if (target) {
        target.classList.add('active');
        // Đồng bộ hóa phân mục cho toàn bộ vùng cài đặt
        if (typeof syncTabUX === 'function') syncTabUX(document.getElementById('dynamic-tabs-container') || target);
    }
    if (typeof window.debouncedSave === 'function') window.debouncedSave();
    if (typeof window.updateMobileNavUI === 'function') setTimeout(window.updateMobileNavUI, 10);
};

window.switchSubSubTab = function(subSubTabId, btn) {
    if (!btn) return;
    const parentScope = btn.closest('.sub-tab-content') || btn.parentNode.parentNode;
    if (!parentScope) return;

    // Reset buttons in siblings
    btn.parentNode.querySelectorAll('.sub-sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Reset content
    parentScope.querySelectorAll(':scope > .sub-sub-tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(subSubTabId);
    if (target) target.classList.add('active');

    // Save category (extract from ssub-prefix-category)
    let parts = subSubTabId.split('-');
    if (parts.length >= 3) {
        window.currentUXCategory = parts[parts.length - 1];
        console.log("UX Sync: Category saved as", window.currentUXCategory);
    }

    if (typeof window.debouncedSave === 'function') window.debouncedSave();
    if (typeof window.updateMobileNavUI === 'function') setTimeout(window.updateMobileNavUI, 10);
};

// [KẾT THÚC] Hết logic cơ bản của Tab

window.mobileStackLevel = 1;
window.mobileNavLevel1Html = null;

window.updateMobileNavUI = function() {
    let menu = document.getElementById('mobileTabMenu');
    let modalEl = document.getElementById('mobileSettingModal');
    // Chỉ hoạt động nếu popup đang hiển thị
    if (!menu || !modalEl || modalEl.style.display === 'none' || modalEl.style.display === '') return;
    
    if (!window.mobileNavLevel1Html) window.mobileNavLevel1Html = menu.innerHTML;

    // TRÊN DESKTOP: Không dùng menu động cấp 2/cấp 3 trên header, luôn khóa ở Menu Cấp 1
    if (window.innerWidth > 768) {
        menu.innerHTML = window.mobileNavLevel1Html;
        return;
    }

    let bodyEl = document.getElementById('mobileModalBody');
    let activeTabContent = bodyEl ? bodyEl.querySelector('.tab-content.active') : null;
    
    if (!activeTabContent || window.mobileStackLevel === 1) {
        menu.innerHTML = window.mobileNavLevel1Html;
        return;
    }

    if (window.mobileStackLevel === 3) {
        let activeSubTabContent = activeTabContent.querySelector('.sub-tab-content.active');
        if (activeSubTabContent) {
            let level3Container = activeSubTabContent.querySelector('.sub-sub-tabs, .sub-tabs');
            let btns = level3Container ? level3Container.querySelectorAll('.sub-sub-tab-btn, .sub-tab-btn') : []; 
            if (btns.length > 0) {
                let backName = "⬅ Lùi";
                let activeLevel2Btn = activeTabContent.querySelector('.sub-tab-btn.active');
                if (activeLevel2Btn) backName = "⬅ " + activeLevel2Btn.innerText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim();

                let html = `<button class="m-tab-lvl1" style="background:#e74c3c; color:white; border:none;" onclick="window.navGoBack()">${backName}</button>`;
                btns.forEach(btn => {
                    let isActive = btn.classList.contains('active') ? 'active' : '';
                    let bid = btn.id;
                    if (!bid) { bid = 'gen_btn_' + Math.floor(Math.random()*1000000); btn.id = bid; }
                    html += `<button class="m-tab-lvl1 ${isActive}" onclick="window.mobileStackLevel=3; document.getElementById('${bid}').click()">${btn.innerHTML}</button>`;
                });
                menu.innerHTML = html;
                setTimeout(() => { let ab = menu.querySelector('.active'); if(ab) ab.scrollIntoView({behavior: 'smooth', inline: 'center'}); }, 50);
                return;
            }
        }
        window.mobileStackLevel = 2; // Rớt cấp nếu ko tìm thấy
    }

    if (window.mobileStackLevel === 2) {
        let level2Container = activeTabContent.querySelector(':scope > .sub-tabs, :scope > div > .sub-tabs') || activeTabContent.querySelector('.sub-tabs');
        if (level2Container) {
             let btns = level2Container.querySelectorAll('.sub-tab-btn');
             if (btns.length > 0) {
                 let t1Btn = document.querySelector(`button#mTab-${activeTabContent.id}`);
                 let backName = t1Btn ? "⬅ " + t1Btn.innerText.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim() : "⬅ Menu Cài Đặt";

                 let html = `<button class="m-tab-lvl1" style="background:#e74c3c; color:white; border:none;" onclick="window.navGoBack()">${backName}</button>`;
                 btns.forEach(btn => {
                    let isActive = btn.classList.contains('active') ? 'active' : '';
                    let bid = btn.id;
                    if (!bid) { bid = 'gen_btn_' + Math.floor(Math.random()*1000000); btn.id = bid; }
                    html += `<button class="m-tab-lvl1 ${isActive}" onclick="window.mobileStackLevel=3; document.getElementById('${bid}').click()">${btn.innerHTML}</button>`;
                 });
                 menu.innerHTML = html;
                 setTimeout(() => { let ab = menu.querySelector('.active'); if(ab) ab.scrollIntoView({behavior: 'smooth', inline: 'center'}); }, 50);
                 return;
             }
        }
        window.mobileStackLevel = 1;
        menu.innerHTML = window.mobileNavLevel1Html;
    }
};

window.navGoBack = function() {
    if (window.mobileStackLevel > 1) {
        window.mobileStackLevel--;
        window.updateMobileNavUI();
    }
};

function syncTabUX(container) {
    if(isSyncingTab || !window.currentUXCategory) return;
    isSyncingTab = true;
    let cat = window.currentUXCategory;
    
    // Chỉ tìm trong phạm vi content đang active để tránh click nhầm vào các tab đang ẩn
    let scope = container;
    if (container.id === 'dynamic-tabs-container') {
        scope = container.querySelector('.tab-content.active') || container;
    }
    
    // Selector hỗ trợ cả nháy đơn và nháy kép trong onclick
    let selector = `.sub-sub-tab-btn[onclick*="-${cat}'"], .sub-sub-tab-btn[onclick*='-${cat}"']`;
    
    // Tìm nút trong phạm vi sub-tab đang hiện hữu
    let subSubBtn = scope.querySelector('.sub-tab-content.active ' + selector) || scope.querySelector(selector);
    
    if (subSubBtn) {
        console.log("UX Sync: Found category", cat, "in", scope.id || 'current scope');
        if (!subSubBtn.classList.contains('active')) subSubBtn.click();
    } else {
        // Mặc định quay về tab "Vị trí" nếu không tìm thấy phân mục cũ
        let defBtn = scope.querySelector('.sub-tab-content.active .sub-sub-tab-btn[onclick*="-pos\'"]') || 
                     scope.querySelector('.sub-sub-tab-btn[onclick*="-pos\'"]') ||
                     scope.querySelector('.sub-sub-tab-btn');
        if (defBtn && !defBtn.classList.contains('active')) defBtn.click();
    }
    
    isSyncingTab = false;
}

function updatePreview(){clearTimeout(window.previewTimeout); window.previewTimeout=setTimeout(window.updatePreviewImmediate,150);}
window.updatePreviewImmediate = function(){ if(typeof window.updatePagination==='function') window.updatePagination(); window.drawCanvas(); }

// ==========================================
// FIX LỖI "CHƯA HOẠT ĐỘNG" TỪ UI HTML CỦA PHI
// ==========================================
window.updateUI = function() {
    let toggleAdv = function(prefix) {
        let modeEl = document.getElementById(prefix + 'Mode') || document.getElementById(prefix + 'ColorMode') || document.getElementById(prefix + 'BgMode') || document.getElementById(prefix + 'BorderMode'); 
        if (!modeEl) return;
        let mode = modeEl.value;
        let sol = document.getElementById(prefix + 'SolidGrp') || document.getElementById(prefix + 'ColorSolidGrp') || document.getElementById(prefix + 'BgSolidGrp') || document.getElementById(prefix + 'BorderSolidGrp');
        let grad = document.getElementById(prefix + 'GradGrp') || document.getElementById(prefix + 'ColorGradGrp') || document.getElementById(prefix + 'BgGradGrp') || document.getElementById(prefix + 'BorderGradGrp');
        let img = document.getElementById(prefix + 'ImgGrp') || document.getElementById(prefix + 'ColorImgGrp') || document.getElementById(prefix + 'BgImgGrp') || document.getElementById(prefix + 'BorderImgGrp');
        if (sol) sol.style.display = (mode === 'solid') ? 'flex' : 'none';
        if (grad) grad.style.display = (mode === 'gradient') ? 'flex' : 'none';
        if (img) img.style.display = (mode === 'image') ? 'flex' : 'none';
    };

    let allPrefixes = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum', 'cell'];
    allPrefixes.forEach(p => { toggleAdv(p + 'Color'); toggleAdv(p + 'Bg'); toggleAdv(p + 'Border'); });
    toggleAdv('bg'); 
    
    let checkCol = (tabId, chkId) => { 
        let btn = document.querySelector(`.sub-tabs button[onclick*="'${tabId}'"], .sub-tabs button[onclick*='"${tabId}"']`); 
        let chk = document.getElementById(chkId); 
        if (btn && chk) {
            let isShow = chk.checked;
            btn.style.display = isShow ? 'inline-block' : 'none'; 
            if (!isShow && btn.classList.contains('active')) {
                let parentGroup = btn.closest('.sub-tabs');
                if (parentGroup) { let firstBtn = parentGroup.querySelector('.sub-tab-btn:first-child'); if (firstBtn) firstBtn.click(); }
            }
        } 
    };

    const cols = [{ chk: 'chkNum', tab: 'sub-num', hTab: 'sub-hNum' }, { chk: 'chkPrice', tab: 'sub-price', hTab: 'sub-hPrice' }, { chk: 'chkMenh', tab: 'sub-menh', hTab: 'sub-hMenh' }, { chk: 'chkMang', tab: 'sub-mang', hTab: 'sub-hMang' }, { chk: 'chkData1', tab: 'sub-data1', hTab: 'sub-hData1' }, { chk: 'chkData2', tab: 'sub-data2', hTab: 'sub-hData2' }];
    cols.forEach(item => { checkCol(item.tab, item.chk); checkCol(item.hTab, item.chk); });

    const globalTexts = ['header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum'];
    globalTexts.forEach(g => { checkCol('sub-' + g, 'use_' + g); });

    if (typeof window.updateGeneralUI === 'function') window.updateGeneralUI();
    if (typeof window.toggleCanvasSizeInputs === 'function') window.toggleCanvasSizeInputs();

    // 🦓 HIỂN THỊ CÀI ĐẶT NGỰA VẰN
    let useZebra = document.getElementById('useZebra');
    let zebraContainer = document.getElementById('zebraSettingsContainer');
    if (useZebra && zebraContainer) {
        zebraContainer.style.display = useZebra.checked ? 'block' : 'none';
        const syncZebra = (chkId, grpPrefix) => {
            let chk = document.getElementById(chkId);
            let gOdd = document.getElementById('zebraOdd' + grpPrefix + 'Grp');
            let gEven = document.getElementById('zebraEven' + grpPrefix + 'Grp');
            if (chk) {
                let disp = chk.checked ? 'flex' : 'none';
                if (gOdd) gOdd.style.display = disp;
                if (gEven) gEven.style.display = disp;
            }
        };
        syncZebra('chkNum', 'Num'); syncZebra('chkPrice', 'Price'); syncZebra('chkMenh', 'Menh');
        syncZebra('chkMang', 'Mang'); syncZebra('chkData1', 'Data1'); syncZebra('chkData2', 'Data2');
    }
    
    // --- BỔ SUNG TỪ SCRIPT.JS ---
    let prefixes = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum', 'cell'];
    prefixes.forEach(p => { 
        if((p === 'menh' || p === 'mang') && typeof window.toggleShapeOptions === 'function') {
            window.toggleShapeOptions(p);
        }
    });
};

window.drawGlobalBackground = function(ctx, canvasW, canvasH) {
    let mode = document.getElementById('bgMode')?.value || 'solid';
    ctx.save();
    if (mode === 'solid') { ctx.fillStyle = document.getElementById('bgColor')?.value || '#ffffff'; ctx.fillRect(0, 0, canvasW, canvasH); } 
    else if (mode === 'gradient') {
        let c1 = document.getElementById('bgGradient1')?.value || '#ffffff'; let c2 = document.getElementById('bgGradient2')?.value || '#006680';
        let angle = parseFloat(document.getElementById('bgGradAngle')?.value || 0) * Math.PI / 180;
        let x2 = canvasW * Math.cos(angle); let y2 = canvasH * Math.sin(angle);
        let grd = ctx.createLinearGradient(0, 0, Math.abs(x2), Math.abs(y2)); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
        ctx.fillStyle = grd; ctx.fillRect(0, 0, canvasW, canvasH);
    } 
    else if (mode === 'image' && window.globalBgImage) {
        let img = window.globalBgImage; let fit = document.getElementById('bgFitMode')?.value || 'stretch';
        if (fit === 'stretch') { ctx.drawImage(img, 0, 0, canvasW, canvasH); } 
        else if (fit === 'cover') { let scale = Math.max(canvasW / img.width, canvasH / img.height); let nw = img.width * scale; let nh = img.height * scale; let nx = (canvasW - nw) / 2; let ny = (canvasH - nh) / 2; ctx.drawImage(img, nx, ny, nw, nh); } 
        else if (fit === 'contain') { let scale = Math.min(canvasW / img.width, canvasH / img.height); let nw = img.width * scale; let nh = img.height * scale; let nx = (canvasW - nw) / 2; let ny = (canvasH - nh) / 2; ctx.fillStyle = document.getElementById('bgColor')?.value || '#ffffff'; ctx.fillRect(0, 0, canvasW, canvasH); ctx.drawImage(img, nx, ny, nw, nh); }
    } else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasW, canvasH); }
    ctx.restore();
};

window.updateGeneralUI = function() {
    let sizeMode = document.getElementById('canvasSizeMode')?.value;
    let sizeWrapper = document.getElementById('customCanvasSizeWrapper');
    if (sizeWrapper) sizeWrapper.style.display = (sizeMode === 'fixed' ? 'flex' : 'none');

    let bgMode = document.getElementById('bgMode')?.value;
    let grpSolid = document.getElementById('bgSolidGrp'), grpGrad = document.getElementById('bgGradGrp'), grpImg = document.getElementById('bgImgGrp');
    if (grpSolid) grpSolid.style.display = (bgMode === 'solid' ? 'flex' : 'none');
    if (grpGrad) grpGrad.style.display = (bgMode === 'gradient' ? 'flex' : 'none');
    if (grpImg) grpImg.style.display = (bgMode === 'image' ? 'flex' : 'none');

    let bindMode = document.getElementById('bindingMode')?.value;
    let grpNorm = document.getElementById('grpMarginNormal'), grpBind = document.getElementById('grpMarginBinding');
    if (bindMode && bindMode !== 'none') { if(grpNorm) grpNorm.style.display = 'none'; if(grpBind) grpBind.style.display = 'flex'; } 
    else { if(grpNorm) grpNorm.style.display = 'flex'; if(grpBind) grpBind.style.display = 'none'; }
};

window.applyPresetSize = function(val) {
    if(!val) return; let parts = val.split('x');
    if(parts.length === 2) {
        let elW = document.getElementById('customCanvasW'), elH = document.getElementById('customCanvasH');
        if(elW) elW.value = parts[0]; if(elH) elH.value = parts[1];
        if(typeof updatePreviewImmediate === 'function') updatePreviewImmediate();
    }
};
setTimeout(window.updateGeneralUI, 100);

window.openMobileModal = function(tid) {
    if (!tid) return;
    window.isOpeningModal = true; setTimeout(() => { window.isOpeningModal = false; }, 100);

    // v26.3 ID Normalization: 'num_0' -> 'num'
    let rawId = tid;
    let cleanId = tid.split('_')[0]; 
    console.log("openMobileModal: Opening for RawID:", rawId, "CleanID:", cleanId);

    let tabId = '', subTabId = '', mTitle = '';
    const _colIds2 = ['num','price','menh','mang','data1','data2']; 
    const _headerIds2 = ['hNum','hPrice','hMenh','hMang','hData1','hData2']; 
    const _globalTxtIds2 = ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum'];

    const _colNames = {num:'SỐ', price:'GIÁ', menh:'MỆNH', mang:'MẠNG', data1:'DL 1', data2:'DL 2'}; 
    const _hNames = {hNum:'SỐ', hPrice:'GIÁ', hMenh:'MỆNH', hMang:'MẠNG', hData1:'DL 1', hData2:'DL 2'}; 
    const _txtNames = {header1:'Tiêu Đề 1', header2:'Tiêu Đề 2', footer1:'Chân Trang 1', footer2:'Chân Trang 2', ctl:'Trái-Trên', ctr:'Phải-Trên', cbl:'Trái-Dưới', cbr:'Phải-Dưới', pageNum:'Số Trang'};

    if (cleanId === 'layout') { tabId = 'tab-layout'; mTitle = '📊 LƯỚI SIM'; }
    else if (cleanId === 'general') { tabId = 'tab-general'; subTabId = 'sub-general-bg'; mTitle = '🌄 NỀN TỔNG'; }
    else if (cleanId === 'header') { tabId = 'tab-colheader'; subTabId = 'sub-hCommon'; mTitle = '🏷️ TIÊU ĐỀ'; }
    else if (cleanId === 'globaltext') { tabId = 'tab-globaltext'; subTabId = 'sub-gt-chung'; mTitle = '📝 CHỮ GÓC'; }
    else if (_colIds2.includes(cleanId)) { tabId = 'tab-layout'; subTabId = 'sub-' + cleanId; mTitle = '⚙️ CỘT ' + (_colNames[cleanId] || cleanId.toUpperCase()); }
    else if (_headerIds2.includes(cleanId)) { tabId = 'tab-colheader'; subTabId = 'sub-' + cleanId; mTitle = '🏷️ TIÊU ĐỀ ' + (_hNames[cleanId] || cleanId.toUpperCase()); }
    else if (_globalTxtIds2.includes(cleanId)) { tabId = 'tab-globaltext'; subTabId = 'sub-' + cleanId; mTitle = '✏️ ' + (_txtNames[cleanId] || cleanId.toUpperCase()); }

    console.log("openMobileModal: Resolved TabID:", tabId, "SubTabID:", subTabId);

    if (!tabId) { console.warn("openMobileModal: No TabID found for", cleanId); return; } 
    let el = document.getElementById(tabId); 
    if (!el) { console.error("openMobileModal: Element for TabID not found:", tabId); return; }

    try {
        let btn1 = document.querySelector(`.tabs button[onclick*="${tabId}"]`); if(btn1) switchTab(tabId, btn1);
        if(subTabId) { let btn2 = document.querySelector(`.sub-tabs button[onclick*="${subTabId}"]`); if(btn2) switchSubTab(subTabId, btn2); }
    } catch(e) {}

    document.querySelectorAll('.m-tab-lvl1').forEach(btn => btn.classList.remove('active'));
    let activeMobileTabBtn = document.getElementById('mTab-' + tabId);
    if (activeMobileTabBtn) { activeMobileTabBtn.classList.add('active'); try { activeMobileTabBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch(err) {} }

    let titleEl = document.getElementById('mobileModalTitle'); if (titleEl) titleEl.innerText = mTitle;
    let bodyEl = document.getElementById('mobileModalBody'); let modalEl = document.getElementById('mobileSettingModal');

    if (bodyEl && bodyEl.children.length > 0) {
        let oldEl = bodyEl.children[0];
        if (oldEl !== el) { 
            oldEl.classList.remove('active');
            if (window.placeholderNode && window.placeholderNode.parentNode) {
                window.placeholderNode.parentNode.insertBefore(oldEl, window.placeholderNode);
                window.placeholderNode.parentNode.removeChild(window.placeholderNode);
            }
        }
    }
    
    if (!bodyEl.contains(el)) {
        window.placeholderNode = document.createComment("mobile-placeholder"); 
        if (el.parentNode) el.parentNode.insertBefore(window.placeholderNode, el); 
        window.activeMobileElement = el;
        bodyEl.appendChild(el); 
    }
    
    el.classList.add('active');
    
    // V26.5: Áp dụng GUARD để chống click nhầm (double-click từ canvas nhảy vào modal)
    let contentEl = modalEl.querySelector('.mobile-modal-content');
    if (contentEl) {
        contentEl.classList.add('modal-guarding');
        setTimeout(() => { contentEl.classList.remove('modal-guarding'); }, 300);
    }
    
    if (modalEl) modalEl.style.display = 'flex';
    
    // Gắn hook Navigation Stack cho Mobile
    window.mobileStackLevel = 3; 
    if (typeof window.updateMobileNavUI === 'function') setTimeout(window.updateMobileNavUI, 50);
};

window.focusDesktopTab = function(tid) {
    if (!tid) return;
    let tabId = ''; let subTabId = ''; let cleanTid = tid.replace('sub-', '');

    const textIds = ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum']; const headerIds = ['hNum','hPrice','hMenh','hMang','hData1','hData2']; const colIds = ['num','price','menh','mang','data1','data2'];

    if (cleanTid === 'layout') { tabId = 'tab-layout'; }
    else if (cleanTid === 'general') { tabId = 'tab-general'; subTabId = 'sub-general-bg'; }
    else if (colIds.includes(cleanTid)) { tabId = 'tab-layout'; subTabId = 'sub-' + cleanTid; }
    else if (cleanTid === 'header') { tabId = 'tab-colheader'; subTabId = 'sub-hCommon'; }
    else if (headerIds.includes(cleanTid)) { tabId = 'tab-colheader'; subTabId = 'sub-' + cleanTid; }
    else if (cleanTid === 'globaltext') { tabId = 'tab-globaltext'; subTabId = 'sub-gt-chung'; }
    else if (textIds.includes(cleanTid) || cleanTid.includes('text') || (window.textBlocks && window.textBlocks.some(b => b.id === cleanTid))) { tabId = 'tab-globaltext'; subTabId = 'sub-' + cleanTid; }

    if (!tabId) return;

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    let targetTab1 = document.getElementById(tabId); if (targetTab1) targetTab1.classList.add('active');
    let btn1 = document.querySelector(`.tabs button[onclick*="${tabId}"]`); if (btn1) btn1.classList.add('active'); 

    if (subTabId && targetTab1) {
        targetTab1.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
        targetTab1.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
        let targetTab2 = document.getElementById(subTabId); if (targetTab2) targetTab2.classList.add('active');
        let btn2 = targetTab1.querySelector(`button[onclick*="'${subTabId}'"]`) || targetTab1.querySelector(`button[onclick*='"${subTabId}"']`);
        if (btn2) { btn2.classList.add('active'); try { btn2.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch(e){} }
    }

    if (typeof syncTabUX === 'function' && targetTab1) { syncTabUX(targetTab1); }
};

// --- MOBILE MODAL POINTER EVENTS FIX ---
function initModalPointerEvents() {
    // Đã gỡ bỏ logic pointer-events cũ gây lỗi không đóng được popup
    console.log("Modal events initialized.");
}


window.copyCanvas = function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng này.");
        return;
    }
    let canvas = document.getElementById('preview'); if (!canvas) return;
    window.isExporting = true; if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
    try {
        canvas.toBlob(blob => {
            let fmt = document.getElementById('exportFormat')?.value || 'image/png';
            const item = new ClipboardItem({ [fmt]: blob });
            navigator.clipboard.write([item]).then(() => { alert("✅ Đã copy ảnh vào bộ nhớ tạm! Bạn có thể dán (Ctrl+V) sang Zalo/FB."); }).catch(err => { alert("❌ Trình duyệt chặn copy ảnh trực tiếp. Vui lòng dùng 'Lưu 1 Ảnh'!"); });
        }, document.getElementById('exportFormat')?.value || 'image/png', 0.9);
    } catch (e) { alert("❌ Lỗi Copy: " + e.message); } finally {
        window.isExporting = false; if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
    }
};

window.downloadSingleImage = function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng này.");
        return;
    }
    let canvas = document.getElementById('preview'); if (!canvas) return;
    window.isExporting = true; if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
    try {
        let fmt = document.getElementById('exportFormat')?.value || 'image/png';
        let ext = fmt === 'image/jpeg' ? 'jpg' : 'png';
        let timeString = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        let dataURL = canvas.toDataURL(fmt, 0.9);
        let a = document.createElement('a'); a.href = dataURL; a.download = `Trang_${window.currentStep + 1}_${timeString}.${ext}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { alert("❌ Lỗi lưu ảnh: " + e.message); } finally {
        window.isExporting = false; if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
    }
};

window.generateAllImages = async function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng này.");
        return;
    }
    let list = typeof window.parseList === 'function' ? window.parseList() : [];
    if (list.length === 0) return alert("❌ Danh sách trống, không có gì để tải!");
    let canvas = document.getElementById('preview');
    let rows = getVal('tableRows', 10); let cols = getVal('tableCols', 2);
    let total = Math.max(1, Math.ceil(list.length / (rows * cols)));
    if (total > 20 && !confirm(`Danh sách có ${total} trang. Tải File ZIP sẽ mất một chút thời gian. Bạn có muốn tiếp tục?`)) return;

    window.isExporting = true; let originalStep = window.currentStep;
    
    try {
        const zip = new JSZip();
        let fmt = document.getElementById('exportFormat')?.value || 'image/png'; let ext = fmt === 'image/jpeg' ? 'jpg' : 'png';
        let timeString = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

        if(typeof toggleLoading === 'function') toggleLoading(true, "ĐANG NÉN ZIP", `Đang xử lý ${total} trang...`);

        for (let s = 0; s < total; s++) {
            window.currentStep = s;
            if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
            await new Promise(r => setTimeout(r, 100)); 
            let blob = await new Promise(r => canvas.toBlob(r, fmt, 0.9));
            zip.file(`Trang_${s + 1}_${timeString}.${ext}`, blob);
        }

        let content = await zip.generateAsync({ type: 'blob' });
        let url = URL.createObjectURL(content);
        let a = document.createElement('a'); a.href = url; a.download = `Bo_Anh_SIM_${timeString}.zip`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);

    } catch (e) { alert("❌ Lỗi tải ZIP: Có thể do trình duyệt chưa tải xong thư viện JSZip."); console.error(e); } finally {
        window.currentStep = originalStep; window.isExporting = false;
        if(typeof toggleLoading === 'function') toggleLoading(false);
        if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
    }
};

window.printAllPages = async function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng này.");
        return;
    }
    let list = typeof window.parseList === 'function' ? window.parseList() : [];
    if (list.length === 0) return alert("❌ Danh sách trống!");

    let canvas = document.getElementById('preview');
    let rows = getVal('tableRows', 10); let cols = getVal('tableCols', 2);
    let total = Math.max(1, Math.ceil(list.length / (rows * cols)));
    if (total > 20 && !confirm(`Bạn đang ra lệnh in ${total} trang. Tiếp tục in?`)) return;

    window.isExporting = true; let originalStep = window.currentStep;

    try {
        if(typeof toggleLoading === 'function') toggleLoading(true, "ĐANG CHUẨN BỊ IN", `Xử lý ${total} trang...`);

        let imagesData = [];
        for (let s = 0; s < total; s++) {
            window.currentStep = s;
            if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
            await new Promise(r => setTimeout(r, 150));
            imagesData.push(canvas.toDataURL("image/png", 1.0));
        }

        let oldFrame = document.getElementById('printFrame'); if (oldFrame) oldFrame.remove();

        let printFrame = document.createElement('iframe'); printFrame.id = 'printFrame'; printFrame.style.position = 'absolute'; printFrame.style.top = '-10000px'; printFrame.style.left = '-10000px'; printFrame.style.width = '210mm'; printFrame.style.height = '297mm';
        document.body.appendChild(printFrame);

        let frameDoc = printFrame.contentWindow.document;
        frameDoc.open(); frameDoc.write('<html><head><title>In Bảng Số</title><style>@page { margin: 0; size: A4 portrait; } html, body { margin: 0; padding: 0; background: white; } img { width: 210mm; max-height: 296mm; object-fit: contain; display: block; margin: 0 auto; page-break-after: always; } img.last-img { page-break-after: auto !important; }</style></head><body>');
        for (let i = 0; i < imagesData.length; i++) { let cls = (i === imagesData.length - 1) ? 'last-img' : ''; frameDoc.write(`<img src="${imagesData[i]}" class="${cls}">`); }
        frameDoc.write('</body></html>'); frameDoc.close();

        printFrame.onload = function() { setTimeout(() => { printFrame.contentWindow.focus(); printFrame.contentWindow.print(); if(typeof toggleLoading === 'function') toggleLoading(false); }, 300); };
        setTimeout(() => { try { printFrame.contentWindow.focus(); printFrame.contentWindow.print(); if(typeof toggleLoading === 'function') toggleLoading(false); } catch(err) {} }, 1500);

    } catch (e) { alert("❌ Lỗi In: " + e.message); console.error(e); if(typeof toggleLoading === 'function') toggleLoading(false); } finally {
        window.currentStep = originalStep; window.isExporting = false;
        if (typeof updatePreviewImmediate === 'function') updatePreviewImmediate(); else window.drawCanvas();
    }
};

window.exportToExcel = function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng này.");
        return;
    }
    let list = typeof window.parseList === 'function' ? window.parseList() : [];
    if (list.length === 0) return alert("❌ Danh sách trống, không có gì để xuất!");

    let table = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1"><tr style="background:#007bff; color:#fff;"><th>SỐ SIM</th><th>GIÁ BÁN</th><th>MỆNH</th><th>MẠNG</th><th>DỮ LIỆU 1</th><th>DỮ LIỆU 2</th></tr>';
    
    list.forEach(item => {
        let num = item[0] || ""; let price = typeof formatPriceString === 'function' ? formatPriceString(item[1] || "") : (item[1] || "");
        let menh = typeof getMenhFromPhone === 'function' ? getMenhFromPhone(num) : ""; let net = typeof getNetworkData === 'function' ? getNetworkData(num) : null; let mang = net ? (net.short2 || "SIM") : ""; let d1 = item[2] || ""; let d2 = item[3] || "";
        table += `<tr><td style="mso-number-format:'\\@';">${num}</td><td>${price}</td><td>${menh}</td><td>${mang}</td><td>${d1}</td><td>${d2}</td></tr>`;
    });
    table += '</table></body></html>';
    
    let blob = new Blob([table], { type: 'application/vnd.ms-excel;charset=utf-8' });
    let a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Thong_Ke_SIM_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

window.undoHistory = window.undoHistory || [];
const MAX_HISTORY = 20;

window.getConfigObject = function(includeList = false) {
    let cfg = {};
    document.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.id || ['licenseKeyInput', 'importConfig', 'bgInput', 'cellBgInput', 'cellBorderInput'].includes(el.id)) return;
        if (!includeList && el.id === 'list') return;
        cfg[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    return cfg;
};

window.saveState = function() {
    if(typeof window.getConfigObject !== 'function') return;
    let currentState = window.getConfigObject(false);
    window.undoHistory.push(JSON.stringify(currentState));
    if (window.undoHistory.length > MAX_HISTORY) window.undoHistory.shift();
    let btnUndo = document.getElementById('btnUndo'); if(btnUndo) btnUndo.innerText = `↩ Hoàn tác (${window.undoHistory.length})`;
};

window.undo = function() {
    if (window.undoHistory.length === 0) { alert("Không còn bước nào để quay lại!"); return; }
    let lastState = JSON.parse(window.undoHistory.pop());
    if(typeof window.applyConfigToUI === 'function') window.applyConfigToUI(lastState, false);
    let btnUndo = document.getElementById('btnUndo'); if(btnUndo) btnUndo.innerText = `↩ Hoàn tác (${window.undoHistory.length})`;
};

document.addEventListener('focusin', function(e) { if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'file' && e.target.id !== 'list') { window.saveState(); } });
document.addEventListener('mousedown', function(e) { if (e.target.type === 'checkbox') window.saveState(); });

// ============================================================================
// HỆ THỐNG MENU THỐNG NHẤT (V26) 
// ============================================================================
window.toggleUnifiedMenu = function() {
    let container = document.getElementById('unifiedMenuContainer');
    let list = document.getElementById('subMenuList');
    if (!container || !list) return;

    let isHidden = list.style.display === 'none' || list.style.display === '';
    
    if (isHidden) {
        let rect = container.getBoundingClientRect();
        let midX = window.innerWidth / 2;

        // CỐ ĐỊNH MENU SỔ LÊN (V26.2 - ABSOLUTE)
        // Khi list dùng position: absolute; bottom: 70px;
        // nó sẽ luôn hiển thị phía trên nút bấm chính.

        // Căn ngang (Trái / Phải) dựa trên vị trí màn hình
        if (rect.left < midX) {
            container.style.alignItems = 'flex-start';
            list.style.alignItems = 'flex-start';
            list.style.right = 'auto';
            list.style.left = '0';
        } else {
            container.style.alignItems = 'flex-end';
            list.style.alignItems = 'flex-end';
            list.style.left = 'auto';
            list.style.right = '0';
        }

        list.style.display = 'flex';
    } else {
        list.style.display = 'none';
        let exp = document.getElementById('exportSubMenu');
        if (exp) exp.style.display = 'none';
    }
};

window.toggleExportSubMenu = function() {
    let container = document.getElementById('unifiedMenuContainer');
    let exp = document.getElementById('exportSubMenu');
    if (!container || !exp) return;
    
    let isHidden = exp.style.display === 'none' || exp.style.display === '';
    
    if (isHidden) {
        let rect = container.getBoundingClientRect();
        let midX = window.innerWidth / 2;

        if (rect.left < midX) {
            // Bên trái -> Sổ menu con ra bên phải (margin-left)
            exp.style.alignItems = 'flex-start';
            exp.style.marginRight = '0';
            exp.style.marginLeft = '15px';
            exp.style.borderRight = 'none';
            exp.style.borderLeft = '2px solid #ddd';
            exp.style.paddingRight = '0';
            exp.style.paddingLeft = '15px';
            exp.style.textAlign = 'left';
        } else {
            // Bên phải -> Sổ menu con ra bên trái (margin-right)
            exp.style.alignItems = 'flex-end';
            exp.style.marginRight = '15px';
            exp.style.marginLeft = '0';
            exp.style.borderRight = '2px solid #ddd';
            exp.style.borderLeft = 'none';
            exp.style.paddingRight = '15px';
            exp.style.paddingLeft = '0';
            exp.style.textAlign = 'right';
        }
        exp.style.display = 'flex';
    } else {
        exp.style.display = 'none';
    }
};

window.openHelpModal = function() { 
    let helpOverlay = document.getElementById('helpModalOverlay'); 
    if (helpOverlay) helpOverlay.style.display = 'flex'; 
    // Đóng menu chính khi mở hướng dẫn
    let list = document.getElementById('subMenuList');
    if (list) list.style.display = 'none';
};

window.closeHelpModal = function() { 
    let helpOverlay = document.getElementById('helpModalOverlay'); 
    if (helpOverlay) helpOverlay.style.display = 'none'; 
};

window.openTemplateManager = function() {
    // Đóng menu trước
    let list = document.getElementById('subMenuList');
    if (list) list.style.display = 'none';
    
    // Gọi hàm mở giao diện mẫu chính thức trong index.html
    if (typeof window.openThemeModal === 'function') {
        window.openThemeModal();
    } else {
        let modal = document.getElementById('themeModalOverlay');
        if (modal) {
            modal.style.display = 'flex';
            if (typeof window.loadCloudTemplates === 'function') window.loadCloudTemplates();
        } else {
            alert("Không tìm thấy giao diện Quản Lý Mẫu!");
        }
    }
};


// Đóng menu khi click ra ngoài
document.addEventListener('click', (e) => {
    let container = document.querySelector('.unified-menu-container');
    let list = document.getElementById('subMenuList');
    if (container && list && list.style.display === 'flex') {
        if (!container.contains(e.target)) {
            list.style.display = 'none';
            let exp = document.getElementById('exportSubMenu');
            if (exp) exp.style.display = 'none';
        }
    }
    
    let helpOverlay = document.getElementById('helpModalOverlay'); 
    if (helpOverlay && e.target === helpOverlay) { window.closeHelpModal(); } 
});

// ============================================================================
// HỆ THỐNG PHÂN TRANG (PREVIEW TỚI / LUI / NHẬP SỐ TRANG) 
// ============================================================================
window.currentStep = 0; 
window.updatePagination = function() {
    let r = parseInt(window.getVal('tableRows', 10)); let c = parseInt(window.getVal('tableCols', 2));  
    let list = typeof window.parseList === 'function' ? window.parseList() : []; let listLen = list.length;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    if (window.currentStep >= tot) { window.currentStep = Math.max(0, tot - 1); }
    let pInp = document.getElementById('pageInput'); if (pInp && document.activeElement !== pInp) { pInp.value = window.currentStep + 1; }
    let tTxt = document.getElementById('totalPagesText'); if(tTxt) tTxt.innerText = tot;
};
window.prevStep = function() { if(window.currentStep > 0) { window.currentStep--; if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else window.drawCanvas(); } };
window.nextStep = function() {
    let r = parseInt(window.getVal('tableRows', 10)); let c = parseInt(window.getVal('tableCols', 2));
    let listLen = typeof window.parseList === 'function' ? window.parseList().length : 0;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    if(window.currentStep < tot - 1) { window.currentStep++; if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else window.drawCanvas(); }
};
window.goToPage = function(v) {
    let p = parseInt(v); if (isNaN(p)) return; if (p < 1) p = 1;
    let r = parseInt(window.getVal('tableRows', 10)); let c = parseInt(window.getVal('tableCols', 2));
    let listLen = typeof window.parseList === 'function' ? window.parseList().length : 0;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    window.currentStep = Math.max(0, Math.min(p - 1, tot - 1));
    if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else window.drawCanvas();
};
document.addEventListener('input', function(e) { if (e.target && e.target.id === 'pageInput') { window.goToPage(e.target.value); } });
window.showBlueprintMode = false; 
window.toggleBlueprintMode = function() { window.showBlueprintMode = !window.showBlueprintMode; if(typeof window.drawCanvas === 'function') window.drawCanvas(); };
window.updatePreview = function() { if(typeof window.drawCanvas === 'function') window.drawCanvas(); };
window.updatePreviewImmediate = function() { if(typeof window.drawCanvas === 'function') window.drawCanvas(); };

window.toggleShapeOptions = function(prefix) {
    let type = document.getElementById(prefix + 'ShapeType')?.value || 'none';
    let opts = document.getElementById(prefix + 'ShapeOptions');
    if (!opts) return;
    
    if (type === 'none' || type === 'text_only') {
        opts.style.display = 'none';
    } else {
        opts.style.display = 'block';
        
        let swRow = document.getElementById(prefix + 'ShapeSizeRow');
        if (swRow) {
            swRow.style.display = 'flex';
            let autoW = document.getElementById(prefix + 'ShapeAutoW');
            let autoH = document.getElementById(prefix + 'ShapeAutoH');
            let inpW = document.getElementById(prefix + 'ShapeW');
            let inpH = document.getElementById(prefix + 'ShapeH');
            if (type.includes('expand')) {
                if (autoW && !autoW.dataset.init) { autoW.checked = true; autoW.dataset.init = "1"; }
                if (autoH && !autoH.dataset.init) { autoH.checked = true; autoH.dataset.init = "1"; }
            }
            if (inpW && autoW) { inpW.disabled = autoW.checked; inpW.style.opacity = autoW.checked ? '0.5' : '1'; }
            if (inpH && autoH) { inpH.disabled = autoH.checked; inpH.style.opacity = autoH.checked ? '0.5' : '1'; }
        }

        let radGrp = document.getElementById(prefix + 'ShapeRadiusGrp');
        if (radGrp) {
            const allowRadius = ['rect_round_expand', 'rect_round_tight', 'rect_round', 'rect_square', 'teardrop'];
            radGrp.style.display = (allowRadius.includes(type) || type.includes('round')) ? 'inline-block' : 'none';
        }
    }
};

// --- 7. QUẢN LÝ MẪU (Đã chuyển sang js/configs.js) ---

/**
 * Nạp mẫu thiết kế mặc định (Mẫu 1)
 */
window.loadDefaultTemplate = function() {
    window.loadBuiltinTemplate("mau_vip_1");
};

/**
 * Nạp mẫu thiết kế từ kho dữ liệu mẫu có sẵn
 * @param {string} key - ID của mẫu (mau_vip_1, mau_vip_2...)
 */
window.loadBuiltinTemplate = function(key) {
    // Nếu không chọn mã (chọn dòng đầu tiên hoặc gọi qua loadDefaultTemplate)
    if (!key || key === "") key = "mau_vip_1";
    
    const templateData = window.builtinTemplatesData[key];
    
    // Kiểm tra xem mẫu đã có dữ liệu chưa
    if (!templateData || Object.keys(templateData).length === 0) {
        alert("❌ Mẫu này hiện chưa có dữ liệu thiết kế!\n\nHướng dẫn: Bạn hãy dán nội dung file .lite vào biến 'builtinTemplatesData' trong file js/configs.js.");
        return;
    }

    try {
        // Nạp cấu hình vào UI (hàm applyConfigToUI đã có sẵn trong index.html)
        if (typeof window.applyConfigToUI === 'function') {
            window.applyConfigToUI(templateData, true); // true: là nạp mẫu (không đè danh sách SỐ)
            
            // Cập nhật lại toàn bộ giao diện và Preview
            if (typeof window.updateUI === 'function') window.updateUI();
            if (typeof window.drawCanvas === 'function') window.drawCanvas();
            
        } else {
            console.error("❌ Không tìm thấy hàm applyConfigToUI!");
        }
    } catch (err) {
        console.error("❌ Lỗi khi nạp mẫu:", err);
        alert("❌ Có lỗi khi nạp dữ liệu mẫu này!");
    }
};

// Đảm bảo updatePreviewImmediate gọi drawCanvas

// ============================================================================
// 🚀 MÃ NGUỒN CHUYỂN TỪ INDEX.HTML (MODULARIZED)
// ============================================================================

// --- A0. HÀM TIỆN ÍCH TOÀN CỤC ---
window.setLocalImage = function (inputEl, globalVarName, statusId) {
    let file = inputEl.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function (e) {
        let img = new Image();
        img.onload = function () {
            window[globalVarName] = img;
            if (globalVarName === 'globalBgImage') window.bgImage = img;
            let statusEl = document.getElementById(statusId);
            if (statusEl) statusEl.innerHTML = '✅ Đã nạp ảnh';
            if (typeof window.updateUI === 'function') window.updateUI();
            if (typeof window.drawCanvas === 'function') window.drawCanvas();
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.removeImage = function (globalVarName, inputId, statusId) {
    window[globalVarName] = null;
    if (globalVarName === 'globalBgImage') window.bgImage = null;
    let inputEl = document.getElementById(inputId);
    if (inputEl) inputEl.value = '';
    let statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.innerHTML = '❌ Chưa có ảnh';
    if (typeof window.drawCanvas === 'function') window.drawCanvas();
    if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
};

window.pasteList = async function () {
    try {
        let text = await navigator.clipboard.readText();
        let listEl = document.getElementById('list');
        if (listEl && text) {
            listEl.value = text;
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
            if (typeof window.debouncedSave === 'function') window.debouncedSave();
        }
    } catch (e) {
        alert('❌ Không thể đọc clipboard! Hãy dán (Ctrl+V) trực tiếp vào ô nhập liệu.');
    }
};

// --- A. KHỞI TẠO DOM & SỰ KIỆN CƠ BẢN ---
window.customFonts = [];
window.initFontSelectors = function (forceRefresh = false) {
    document.querySelectorAll('.font-selector').forEach(sel => {
        if (!forceRefresh && sel.children.length > 0) return;
            let currentVal = sel.value;
            sel.innerHTML = '';
            const allFonts = [...(window.sysFonts || []), ...window.customFonts];
            allFonts.forEach(f => {
                let opt = document.createElement('option');
                opt.value = f; opt.innerText = f;
                opt.style.fontFamily = `"${f}", sans-serif`;
                sel.appendChild(opt);
            });
            if (forceRefresh && sel.dataset.lastUpload) {
                sel.value = sel.dataset.lastUpload;
                delete sel.dataset.lastUpload;
            } else {
                sel.value = currentVal || allFonts[0];
            }
        });
    };


window.handleGlobalFontUpload = function (event) {
    let file = event.target.files[0];
    if (!file) return;
    let fontName = file.name.split('.')[0].replace(/[^a-z0-9]/gi, '_');
    let reader = new FileReader();
    reader.onload = async function (e) {
        try {
            let fontFace = new FontFace(fontName, e.target.result);
            await fontFace.load();
            document.fonts.add(fontFace);
            if (!window.customFonts.includes(fontName)) window.customFonts.push(fontName);
            document.querySelectorAll('.font-selector').forEach(sel => { sel.dataset.lastUpload = fontName; });
            window.initFontSelectors(true);
            if (typeof window.drawCanvas === 'function') window.drawCanvas();
            alert("✅ Đã nạp font: " + fontName);
        } catch (err) { alert("❌ Lỗi nạp font: " + err.message); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

window.initFontSelectors();

window.setupAdvancedUploader = function (inputId, globalVarName) {
    let inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    let newEl = inputEl.cloneNode(true);
    inputEl.parentNode.replaceChild(newEl, inputEl);
    newEl.addEventListener('change', function (e) {
        let file = e.target.files[0];
        if (!file) return;
        let reader = new FileReader();
        reader.onload = function (event) {
            let img = new Image();
            img.onload = function () {
                window[globalVarName] = img;
                let modeSelectId = inputId.replace('Input', 'Mode');
                let modeSelect = document.getElementById(modeSelectId);
                if (modeSelect) { modeSelect.value = 'image'; modeSelect.dispatchEvent(new Event('change')); }
                let statusId = (globalVarName === 'bgImage') ? 'mainBgStatus' : (globalVarName === 'cellBgImage' ? 'cellBgStatus' : 'cellBorderStatus');
                let statusEl = document.getElementById(statusId);
                if (statusEl) statusEl.innerHTML = "✅ Đã nạp ảnh";
                if (typeof window.updateUI === 'function') window.updateUI();
                if (typeof window.drawCanvas === 'function') window.drawCanvas();
                if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// --- B. QUICK SLIDER ---
let originalValue = 0; let currentEditingInput = null; let longPressTimer = null;
window.closeQuickSlider = function() {
    const qsContainer = document.getElementById('quickSliderContainer');
    if (qsContainer) {
        qsContainer.style.display = 'none';
        currentEditingInput = null;
        qsContainer.style.top = ''; qsContainer.style.left = '50%'; qsContainer.style.bottom = '20px'; qsContainer.style.transform = 'translateX(-50%)';
    }
};

document.addEventListener('focusin', e => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        const input = e.target;
        if (input.id === 'quickSliderValueInput' || input.id === 'pageInput') return;
        currentEditingInput = input; originalValue = parseFloat(input.value) || 0;
        const sliderContainer = document.getElementById('quickSliderContainer');
        const slider = document.getElementById('quickSlider');
        const sliderInput = document.getElementById('quickSliderValueInput');
        const sliderLabel = document.getElementById('quickSliderLabel');
        let labelText = "Chỉnh thông số";
        const row = input.closest('.setting-row');
        if (row) { const lb = row.querySelector('label'); if (lb) labelText = lb.innerText; }
        sliderLabel.innerText = labelText;
        let cv = parseFloat(input.value) || 0;
        let min = 0, max = 100, step = 1;
        if (input.id.includes('ScaleY')) { min = 0.1; max = 3; step = 0.1; }
        else if (input.id.includes('Angle')) { min = -360; max = 360; step = 1; }
        else if (input.id.includes('Size') || input.id.includes('TextScale')) { min = 8; max = 150; step = 1; }
        else if (input.id.includes('W') || input.id.includes('H') || input.id.includes('Width') || input.id.includes('Height')) { min = 0; max = 800; step = 1; }
        else if (input.id.includes('X') || input.id.includes('Y')) { min = -500; max = 500; step = 1; }
        slider.min = min; slider.max = max; slider.step = step;
        slider.value = cv; if (sliderInput) sliderInput.value = cv;
        sliderContainer.style.display = 'block';
        const updateAll = (nv) => {
            let v = parseFloat(nv); if (isNaN(v)) v = 0;
            if (input.value != v) input.value = v;
            if (slider.value != v) slider.value = v;
            if (sliderInput && sliderInput.value != v) sliderInput.value = v;
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
            if (typeof window.debouncedSave === 'function') window.debouncedSave();
        };
        slider.oninput = function () { updateAll(this.value); };
        if (sliderInput) {
            sliderInput.oninput = function () { updateAll(this.value); };
            sliderInput.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); updateAll(this.value); } };
        }
        const setupBtn = (bid, d) => {
            const b = document.getElementById(bid); if (!b) return;
            const start = (ev) => { ev.preventDefault(); let val = parseFloat(input.value); updateAll((val + d).toFixed(step < 1 ? 1 : 0)); longPressTimer = setInterval(() => { let v = parseFloat(input.value); updateAll((v + d).toFixed(step < 1 ? 1 : 0)); }, 80); };
            const stop = () => clearInterval(longPressTimer);
            b.ontouchstart = start; b.ontouchend = stop; b.onmousedown = start; b.onmouseup = stop; b.onmouseleave = stop;
        };
        setupBtn('btnSliderMinus', -step); setupBtn('btnSliderPlus', step);
        document.getElementById('btnSliderReset').onclick = (ev) => { ev.preventDefault(); updateAll(originalValue); };
    }
});

document.addEventListener('mousedown', e => {
    const container = document.getElementById('quickSliderContainer');
    if (container && container.style.display === 'block') {
        if (!container.contains(e.target) && e.target !== currentEditingInput) { window.closeQuickSlider(); }
    }
});

// ĐỒNG BỘ NGƯỢC: Khi gõ trực tiếp vào ô input gốc, thanh trượt phải chạy theo
document.addEventListener('input', e => {
    if (typeof currentEditingInput !== 'undefined' && e.target === currentEditingInput) {
        const slider = document.getElementById('quickSlider');
        const sliderInput = document.getElementById('quickSliderValueInput');
        let v = parseFloat(e.target.value) || 0;
        if (slider && parseFloat(slider.value) !== v) slider.value = v;
        if (sliderInput && parseFloat(sliderInput.value) !== v) sliderInput.value = v;
    }
});

// --- C. HỆ THỐNG ĐÁM MÂY ---
// --- C. HỆ THỐNG ĐÁM MÂY (URL đã chuyển sang js/configs.js) ---
window.allTemplates = []; window.cloudBgData = []; window.currentBgTarget = 'global';

window.openThemeModal = function () {
    const modal = document.getElementById('themeModalOverlay');
    if (modal) { modal.style.display = 'flex'; window.loadCloudTemplates(); }
};
window.closeThemeModal = function () {
    let modal = document.getElementById('themeModalOverlay');
    if (modal) modal.style.display = 'none';
};
document.getElementById('themeModalOverlay')?.addEventListener('click', function (e) { if (e.target === this) window.closeThemeModal(); });

window.toggleLoading = function(show, actionText = "Đang xử lý", mainText = "Vui lòng chờ") {
    const loader = document.getElementById('globalLoading');
    const act = document.getElementById('loadingAction');
    const txt = document.getElementById('loadingText');
    if (loader) {
        if (show) { loader.style.display = 'flex'; act.innerText = actionText; txt.innerText = mainText; }
        else { loader.style.opacity = '0'; setTimeout(() => { loader.style.display = 'none'; loader.style.opacity = '1'; }, 300); }
    }
};

window.loadCloudTemplates = async function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        const listContainer = document.getElementById('cloudTemplatesList');
        if (listContainer) listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px 0; font-size: 14px; color: #e74c3c; font-weight: bold;">⚠ VUI LÒNG KÍCH HOẠT BẢN QUYỀN ĐỂ SỬ DỤNG KHO MẪU</div>';
        return;
    }
    const listContainer = document.getElementById('cloudTemplatesList');
    if (!listContainer) return;
    try {
        listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px 0; font-size: 12px; color: #888;">⏳ Đang đồng bộ Kho mẫu đám mây...</div>';
        const resp = await fetch(window.CLOUD_JSON_URL + "?type=template");
        window.allTemplates = await resp.json();
        window.renderTemplates(window.allTemplates);
    } catch (err) {
        listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px 0; font-size: 12px; color: #e74c3c;">❌ Lỗi kết nối máy chủ!</div>';
    }
};

window.liveSearch = function(inputId, listId) {
    let input = document.getElementById(inputId);
    if (!input) return;
    let filter = input.value.toLowerCase();
    let listContainer = document.getElementById(listId);
    if (!listContainer) return;
    
    // Tìm các thẻ mẫu hoặc ảnh nền
    let cards = listContainer.querySelectorAll('.cloud-item-card, .cloud-bg-card');
    cards.forEach(card => {
        let text = card.textContent || card.innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
};

window.renderTemplates = function(data) {
    const listContainer = document.getElementById('cloudTemplatesList');
    if (!listContainer) return;
    listContainer.innerHTML = data.map(pt => {
        let thumb = pt.thumb || "";
        if (thumb.includes('drive.google.com')) {
            let m = thumb.match(/[-\w]{25,}/);
            if (m) thumb = `https://drive.google.com/thumbnail?id=${m[0]}&sz=w400`;
        }
        return `<div class="cloud-item-card" onclick="importFromCloudID('${pt.id}', '${pt.name.replace(/'/g, "\\")}')">
            <div class="cloud-item-thumb">
                <img src="${thumb}" onerror="this.src='https://placehold.co/200x120?text=No+Preview'">
                <div class="cloud-item-badge">HOT</div>
            </div>
            <div class="cloud-item-info">
                <b class="cloud-item-title">${pt.name}</b>
                <div class="cloud-item-tags">${pt.tags || '#VIP #PRO'}</div>
            </div>
            <div class="cloud-item-action">SỬ DỤNG NGAY</div>
        </div>`;
    }).join('');
};

window.openBgCloudModal = function (target, statusId = null) {
    window.currentBgTarget = target; window.currentStatusId = statusId;
    const modal = document.getElementById('modal-bg-cloud');
    if (modal) { modal.style.display = 'flex'; window.loadCloudBackgrounds(); }
};

window.loadCloudBackgrounds = async function() {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        const gallery = document.getElementById('bgCloudList');
        if (gallery) gallery.innerHTML = "<div style='grid-column:1/-1; text-align:center; color: #e74c3c; font-weight: bold;'>⚠ VUI LÒNG KÍCH HOẠT BẢN QUYỀN</div>";
        return;
    }
    const gallery = document.getElementById('bgCloudList');
    if (!gallery) return;
    try {
        gallery.innerHTML = "<div style='grid-column:1/-1; text-align:center;'>⏳ Đang tải...</div>";
        const resp = await fetch(window.CLOUD_JSON_URL + "?type=bg");
        window.cloudBgData = await resp.json();
        window.renderBackgrounds(window.cloudBgData);
    } catch (err) { gallery.innerHTML = "Lỗi tải kho nền."; }
};

window.renderBackgrounds = function(data) {
    const gallery = document.getElementById('bgCloudList'); if (!gallery) return;
    gallery.innerHTML = data.map(bg => `<div class="cloud-bg-card" onclick="window.handleCloudItemClick(this, '${bg.id}', 'image')">
        <div class="local-loading-overlay"><div class="local-spinner"></div></div>
        <div class="cloud-bg-thumb">
            <img src="https://drive.google.com/thumbnail?id=${bg.id}&sz=w400" onerror="this.src='https://placehold.co/200x120?text=Lỗi+Ảnh'">
        </div>
        <div class="cloud-bg-info">
            <b title="${bg.name}">${bg.name}</b>
            <div style="font-size:9px; color:#f1c40f; margin-top:2px;">${bg.tags || '#Background'}</div>
        </div>
    </div>`).join('');
};

window.handleCloudItemClick = function (element, fileId, type) {
    const overlay = element.querySelector('.local-loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    element.parentElement.style.pointerEvents = 'none';
    if (type === 'image') window.applyCloudBackground(fileId, overlay, element.parentElement);
    else window.importFromCloudID(fileId, overlay, element.parentElement);
};
window.importFromCloudID = async function(id, nameOrOverlay, galleryElement) {
    let name = typeof nameOrOverlay === 'string' ? nameOrOverlay : "mẫu được chọn";
    let overlay = typeof nameOrOverlay === 'object' ? nameOrOverlay : null;
    let gallery = galleryElement || null;

    if(!confirm("Bạn có chắc muốn nạp " + name + "?\nDữ liệu hiện tại của bạn sẽ bị thay thế hoàn toàn!")) {
        if(overlay) overlay.style.display = 'none';
        if(gallery) gallery.style.pointerEvents = 'auto';
        return;
    }
    
    window.toggleLoading(true, "Đang nạp", "Tải mẫu đám mây...");
    try {
        let resp = await fetch(window.CLOUD_JSON_URL + "?action=get_image&id=" + id);
        let rawText = await resp.text();
        
        let textToParse = rawText;
        if (rawText.includes("base64,")) {
            let b64 = rawText.split("base64,")[1];
            b64 = b64.replace(/['"]/g, '').trim();
            try { textToParse = decodeURIComponent(escape(atob(b64))); } catch(e) { textToParse = atob(b64); }
        }
        
        let data = {};
        try { 
            data = JSON.parse(textToParse); 
        } catch(e) { 
            if (textToParse.includes("PNG") || textToParse.includes("JFIF") || textToParse.includes("Exif")) {
                alert("LỖI LIÊN KẾT NHẦM FILE:\nID bạn khai báo trong cơ sở dữ liệu đám mây đang trỏ đến một tệp Hình Ảnh (PNG/JPG) thay vì tệp Cấu hình Template (.lite).\n\nVui lòng mở Google Drive, copy đúng ID của tệp '.lite' bạn vừa xuất và cập nhật lại vào danh sách!");
                window.toggleLoading(false);
                if(overlay) overlay.style.display = 'none';
                if(gallery) gallery.style.pointerEvents = 'auto';
                return;
            }
            data = { config: textToParse }; 
        }

        let cfg = null;
        if (data && data.config) {
            cfg = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
        } else if (data && Object.keys(data).length > 5) {
            cfg = data; // Raw config object
        }
        
        if (cfg && typeof cfg === 'object') {
            if (typeof window.applyConfigToUI === 'function') window.applyConfigToUI(cfg, true);
            if (typeof window.closeThemeModal === 'function') window.closeThemeModal();
        } else {
            alert("Dữ liệu mẫu bị lỗi hoặc sai định dạng!");
        }
    } catch(err) {
        console.error(err);
        alert("Lỗi kết nối khi nạp mẫu đám mây!\n" + err.message);
    }
    window.toggleLoading(false);
    if(overlay) overlay.style.display = 'none';
    if(gallery) gallery.style.pointerEvents = 'auto';
};

window.applyCloudBackground = async function(fileId, loaderOverlay, galleryElement) {
    try {
        let resp = await fetch(window.CLOUD_JSON_URL + "?action=get_image&id=" + fileId);
        let text = await resp.text();
        let dataUrl = text;
        try { 
            let json = JSON.parse(text); 
            if (json.image) dataUrl = json.image; 
            else if (json.data) dataUrl = json.data;
        } catch(e) {}
        dataUrl = dataUrl.replace(/^["']|["']$/g, ''); // Xóa nháy kép bọc thừa nếu có
        
        let img = new Image(); img.crossOrigin = "anonymous"; 
        img.onload = () => {
            const target = window.currentBgTarget;
            if (target === 'global') { window.bgImage = img; window.globalBgImage = img; }
            else if (target === 'cellBgImage') window.cellBgImage = img;
            else if (target === 'cellBorderImage') window.cellBorderImage = img;
            else window[target] = img;
            if (window.currentStatusId) { let st = document.getElementById(window.currentStatusId); if (st) st.innerHTML = '☁️ Đang dùng ảnh Mây'; }
            if (typeof window.drawCanvas === 'function') window.drawCanvas();
            if (loaderOverlay) loaderOverlay.style.display = 'none';
            if (galleryElement) galleryElement.style.pointerEvents = 'auto';
            document.querySelectorAll('#bgCloudModalOverlay, #modal-bg-cloud').forEach(m => m.style.display = 'none');
        };
        img.onerror = () => {
            alert("Lỗi định dạng ảnh mây (base64 không hợp lệ).");
            if (loaderOverlay) loaderOverlay.style.display = 'none';
            if (galleryElement) galleryElement.style.pointerEvents = 'auto';
        };
        img.src = dataUrl;
    } catch (err) { 
        if (loaderOverlay) loaderOverlay.style.display = 'none';
        if (galleryElement) galleryElement.style.pointerEvents = 'auto'; 
        alert("Lỗi kết nối tải ảnh đám mây!"); 
    }
};

// --- 7. HỆ THỐNG QUẢN LÝ MẪU ---
window.compressImage = function (imgElement, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        try {
            if (!imgElement || !imgElement.naturalWidth) { resolve(null); return; }
            let canvas = document.createElement('canvas'); let ctx = canvas.getContext('2d');
            let ow = imgElement.naturalWidth; let oh = imgElement.naturalHeight;
            let sc = 1; if (ow > maxWidth) sc = maxWidth / ow;
            canvas.width = Math.round(ow * sc); canvas.height = Math.round(oh * sc);
            ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) { resolve(imgElement.src.startsWith('data:image') ? imgElement.src : null); }
    });
};

window.exportConfig = async function () {
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng Xuất File.");
        return;
    }
    let cfg = {}; let inputs = document.querySelectorAll('.col-settings input, .col-settings select');
    inputs.forEach(el => {
        if (!el.id || el.type === 'file' || el.id.includes('search')) return;
        cfg[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    cfg.savedImages = {};
    const keys = ['globalBgImage', 'bgImage', 'cellBgImage', 'cellBorderImage'];
    const pfx = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum'];
    pfx.forEach(p => keys.push(p + 'ColorImage', p + 'BgImage', p + 'BorderImage', p + 'ShapeBorderImage'));
    if (typeof window.toggleLoading === 'function') window.toggleLoading(true, "ĐANG NÉN ẢNH", "Chuẩn bị xuất file .lite...");
    let cnt = 0;
    for (let k of keys) {
        if (window[k] && window[k] instanceof Image && window[k].complete && window[k].naturalWidth > 0) {
            let res = await window.compressImage(window[k], 800, 0.7);
            if (res) { let skey = (k === 'globalBgImage') ? 'bgImage' : k; cfg.savedImages[skey] = res; cnt++; }
        }
    }
    if (typeof window.toggleLoading === 'function') window.toggleLoading(false);
    let blob = new Blob([JSON.stringify(cfg)], { type: 'application/json' });
    let dl = document.createElement('a'); dl.href = URL.createObjectURL(blob);
    let d = new Date(); dl.download = `Mau_Thiet_Ke_VIP_${d.getDate()}_${d.getMonth()+1}_${d.getFullYear()}.lite`;
    document.body.appendChild(dl); dl.click(); setTimeout(() => { document.body.removeChild(dl); URL.revokeObjectURL(dl.href); }, 500);
    alert(`✅ Đã xuất file .lite thành công!\n📦 Đã nén ${cnt} hình ảnh`);
};

window.handleImport = function (event) {
    let file = event.target.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = function (e) {
        try {
            let raw = e.target.result.trim(); let cfg;
            try { cfg = JSON.parse(raw); } catch (je) {
                const b = atob(raw); const bytes = new Uint8Array(b.length);
                for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
                cfg = JSON.parse(new TextDecoder().decode(bytes));
            }
            window.applyConfigToUI(cfg, true);
        } catch (err) { alert('❌ Lỗi: File không đúng định dạng!'); }
        event.target.value = '';
    };
    reader.readAsText(file);
};

window.applyConfigToUI = function (cfg, isTemplate = false) {
    let inputs = document.querySelectorAll('.col-settings input, .col-settings select, #list, #filterMenh');
    inputs.forEach(el => {
        if (!el.id || el.type === 'file' || el.id.includes('search')) return;
        if (isTemplate && (el.id === 'list' || el.id === 'filterMenh')) return;
        if (cfg.hasOwnProperty(el.id)) {
            if (el.type === 'checkbox') el.checked = cfg[el.id];
            else el.value = cfg[el.id];
            if (el.id === 'list' && typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
        } else if (el.type === 'checkbox') { el.checked = (el.id === 'showHeaderRow'); }
        else if (el.tagName === 'SELECT' && el.id.includes('ShapeType')) { el.value = 'none'; }
    });
    window.globalBgImage = null; window.bgImage = null; window.cellBgImage = null; window.cellBorderImage = null;
    if (cfg.savedImages && Object.keys(cfg.savedImages).length > 0) {
        let keys = Object.keys(cfg.savedImages); let total = keys.length; let loaded = 0;
        if (typeof window.toggleLoading === 'function') window.toggleLoading(true, "ĐANG KHÔI PHỤC", `Nạp ${total} hình ảnh...`);
        keys.forEach(k => {
            let img = new Image();
            img.onload = () => {
                if (k === 'bgImage') { window.bgImage = img; window.globalBgImage = img; } else window[k] = img;
                let sid = (k === 'bgImage') ? 'mainBgStatus' : (k === 'cellBgImage' ? 'cellBgStatus' : 'cellBorderStatus');
                let sel = document.getElementById(sid); if (sel) sel.innerHTML = "✅ Đã nạp ảnh từ file Lite";
                loaded++; if (loaded === total) finish();
            };
            img.onerror = () => { loaded++; if (loaded === total) finish(); };
            img.src = cfg.savedImages[k];
        });
        function finish() {
            if (typeof window.toggleLoading === 'function') setTimeout(() => window.toggleLoading(false), 300);
            if (typeof window.updateUI === 'function') window.updateUI();
            if (typeof window.drawCanvas === 'function') window.drawCanvas();
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
        }
    } else {
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof window.drawCanvas === 'function') window.drawCanvas();
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
    }
};

window.createNewLite = function () {
    if (confirm('Tạo mới sẽ xóa toàn bộ cài đặt hiện tại trên màn hình. Bạn có chắc không?')) {
        document.querySelectorAll('.col-settings input[type="checkbox"]').forEach(el => el.checked = false);
        document.querySelectorAll('.col-settings input[type="color"]').forEach(el => {
            if (el.id.includes('Bg') || el.id.includes('ColorGradient1')) el.value = '#ffffff';
            else el.value = '#000000';
        });
        document.querySelectorAll('.col-settings input[type="text"]').forEach(el => el.value = '');
        window.globalBgImage = null; window.bgImage = null; window.cellBgImage = null; window.cellBorderImage = null;
        ['mainBgStatus', 'cellBgStatus'].forEach(id => { let el = document.getElementById(id); if (el) el.innerHTML = '❌ Chưa có ảnh'; });
        if (document.getElementById('chkNum')) document.getElementById('chkNum').checked = true;
        if (document.getElementById('chkPrice')) document.getElementById('chkPrice').checked = true;
        if (document.getElementById('cellBgTrans')) document.getElementById('cellBgTrans').checked = true;
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof window.drawCanvas === 'function') window.drawCanvas();
        window.closeThemeModal();
    }
};

window.resetToDefault = function () { if (confirm('Khôi phục về trạng thái gốc mặc định của phần mềm?')) { location.reload(); } };

// --- AUTO-SAVE & SESSION RECOVERY ---
window.saveSession = async function () {
    try {
        let cfg = {}; 
        // Lấy tất cả input/select trong cài đặt và mobile modal
        let inputs = document.querySelectorAll('.col-settings input, .col-settings select, #list, #mobileModalBody input, #mobileModalBody select');
        inputs.forEach(el => {
            if (!el.id || el.type === 'file' || el.id.includes('search')) return;
            cfg[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
        });
        
        // Ngăn chặn lưu đè nếu không tìm thấy dữ liệu (tránh lỗi khi modal đang tải)
        if (Object.keys(cfg).length < 5) return;
        
        localStorage.setItem('VIP_SIM_TOOL_SESSION_DATA', JSON.stringify(cfg));
        const keys = ['globalBgImage', 'bgImage', 'cellBgImage', 'cellBorderImage'];
        const pfx = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum'];
        pfx.forEach(p => keys.push(p + 'ColorImage', p + 'BgImage', p + 'BorderImage', p + 'ShapeBorderImage'));
        for (let k of keys) {
            if (window[k] && window[k] instanceof Image && window[k].src.startsWith('data:image')) {
                try { localStorage.setItem('VIP_SIM_TOOL_IMG_' + k, window[k].src); } catch (e) {}
            }
        }
    } catch (err) {}
};

let saveTimeout = null;
window.debouncedSave = function () { clearTimeout(saveTimeout); saveTimeout = setTimeout(window.saveSession, 1500); };

window.restoreSession = function () {
    try {
        let raw = localStorage.getItem('VIP_SIM_TOOL_SESSION_DATA'); if (!raw) return false;
        let cfg = JSON.parse(raw); if (!cfg) return false;
        window.applyConfigToUI(cfg);
        const keys = ['globalBgImage', 'bgImage', 'cellBgImage', 'cellBorderImage'];
        const pfx = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum'];
        pfx.forEach(p => keys.push(p + 'ColorImage', p + 'BgImage', p + 'BorderImage', p + 'ShapeBorderImage'));
        keys.forEach(k => {
            let s = localStorage.getItem('VIP_SIM_TOOL_IMG_' + k);
            if (s) {
                let img = new Image(); img.onload = () => {
                    if (k === 'globalBgImage' || k === 'bgImage') { window.globalBgImage = img; window.bgImage = img; }
                    else window[k] = img;
                    if (typeof window.drawCanvas === 'function') window.drawCanvas();
                }; img.src = s;
            }
        });
        let t = document.createElement('div'); t.style = "position:fixed; bottom:20px; left:20px; background:rgba(46, 204, 113, 0.9); color:white; padding:10px 20px; border-radius:50px; font-weight:bold; z-index:9999;";
        t.innerHTML = "✨ Đã khôi phục phiên làm việc!"; document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
        return true;
    } catch (err) { return false; }
};

// --- STARTUP LOGIC ---
function initStartupLogic() {
    setTimeout(() => {
        const restored = window.restoreSession();
        if (!restored && typeof window.loadDefaultTemplate === 'function') window.loadDefaultTemplate();
    }, 400);

    setInterval(() => {
        const canvas = document.getElementById('preview');
        const sizeDisplay = document.getElementById('canvasSizeDisplay');
        if (canvas && sizeDisplay && canvas.width > 0) {
            const currentText = `Size: ${canvas.width} x ${canvas.height} px`;
            if (sizeDisplay.innerText !== currentText) sizeDisplay.innerText = currentText;
        }
    }, 500);
}

// --- MOBILE SIM LIST MODAL ---
window.openSimListModal = function() {
    let listEl = document.getElementById('list');
    let mListArea = document.getElementById('mobileListArea');
    let modal = document.getElementById('mobileSimListModal');
    if (listEl && mListArea && modal) {
        mListArea.value = listEl.value;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeSimListModal = function() {
    let modal = document.getElementById('mobileSimListModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
};

window.applySimList = function() {
    let listEl = document.getElementById('list');
    let mListArea = document.getElementById('mobileListArea');
    if (listEl && mListArea) {
        listEl.value = mListArea.value;
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
        if (typeof window.debouncedSave === 'function') window.debouncedSave();
    }
    window.closeSimListModal();
};

window.pasteToMobileList = async function() {
    try {
        let text = await navigator.clipboard.readText();
        let mListArea = document.getElementById('mobileListArea');
        if (mListArea && text) mListArea.value = text;
    } catch (e) { alert('❌ Không thể truy cập bộ nhớ tạm!'); }
};

// --- HELP MODAL ---
window.openHelpModal = function() {
    const modal = document.getElementById('helpModalOverlay');
    if (modal) modal.style.display = 'flex';
};
window.closeHelpModal = function() {
    const modal = document.getElementById('helpModalOverlay');
    if (modal) modal.style.display = 'none';
};



// --- PALETTE SYSTEM ---
window.togglePalette = function(isShow) {
    const modal = document.getElementById('paletteModalOverlay');
    if (modal) modal.style.display = isShow ? 'flex' : 'none';
};

window.generateColTab = function(prefix, title, defX, hasShape, defW, defBg) {
    let html = `
    <div id="sub-${prefix}" class="sub-tab-content">
        <div class="sub-tabs">
            <button class="sub-sub-tab-btn active" onclick="switchSubSubTab('ssub-${prefix}-pos', this)">📐 Vị Trí</button>
            <button class="sub-sub-tab-btn" onclick="switchSubSubTab('ssub-${prefix}-format', this)">📝 Chữ & Bóng</button>
            <button class="sub-sub-tab-btn" onclick="switchSubSubTab('ssub-${prefix}-bg', this)">🎨 Nền Ô</button>
            ${hasShape ? `<button class="sub-sub-tab-btn" style="color: #e74c3c; font-weight: bold;" onclick="switchSubSubTab('ssub-${prefix}-shape', this)">💎 Khối Độc Lập</button>` : ''}
        </div>

        <div id="ssub-${prefix}-pos" class="sub-sub-tab-content active">
            <div class="setting-box"><div class="setting-title">📐 Vị Trí & Kích Thước</div>
            <div class="setting-row"><label>Kích thước</label><div class="setting-inputs"><span>W:</span><input type="number" id="${prefix}W" value="${defW}"><span>H:</span><input type="number" id="${prefix}H" value="50"></div></div>
            <div class="setting-row"><label>Lệch vị trí</label><div class="setting-inputs"><span>X:</span><input type="number" id="${prefix}X" value="${defX}"><span>Y:</span><input type="number" id="${prefix}Y" value="0"></div></div>
            <div class="setting-row"><label>Xoay (Góc)</label><div class="setting-inputs"><span>∠:</span><input type="number" id="${prefix}Angle" value="0" style="width:45px;"> <input type="range" min="-180" max="180" value="0" oninput="document.getElementById('${prefix}Angle').value=this.value; typeof updatePreview === 'function' ? updatePreview() : drawCanvas()" style="flex:1;"></div></div>
            <div class="setting-row"><label>Khóa/Canh</label><div class="setting-inputs"><select id="${prefix}AlignX"><option value="left" ${prefix === 'num' ? 'selected' : ''}>Trái</option><option value="center" ${prefix === 'price' || prefix === 'data1' || prefix === 'data2' ? 'selected' : ''}>Giữa</option><option value="right" ${prefix === 'menh' || prefix === 'mang' ? 'selected' : ''}>Phải</option></select><select id="${prefix}AlignY"><option value="top">Trên</option><option value="middle" selected>Giữa</option><option value="bottom">Dưới</option></select><label style="color:red;"><input type="checkbox" id="${prefix}Locked">🔒 Khóa</label></div></div>
            </div>
        </div>

        <div id="ssub-${prefix}-format" class="sub-sub-tab-content">
            <div class="setting-box"><div class="setting-title" style="background:#2ecc71;">🔠 Định Dạng Chữ</div>
            <div class="setting-row"><label>Font & Cỡ</label><div class="setting-inputs"><select id="${prefix}Font" class="font-selector" style="max-width:110px;"></select><button type="button" class="btn-mini" style="background:#8e44ad; padding:2px 8px; font-weight:bold;" onclick="document.getElementById('globalFontInput').click()" title="Tải font riêng (.ttf, .otf)">+ Font</button><span>Size:</span><input type="number" id="${prefix}Size" value="24"><span>Dãn:</span><input type="number" id="${prefix}ScaleY" value="1" step="0.1" style="width:40px;"></div></div>
            <div class="setting-row"><label>Canh & Lệch</label><div class="setting-inputs"><select id="${prefix}TextAlign"><option value="left">Trái</option><option value="center" selected>Giữa</option><option value="right">Phải</option></select><span>Pad:</span><input type="number" id="${prefix}TextPad" value="5"><span>X:</span><input type="number" id="${prefix}TextX" value="0"><span>Y:</span><input type="number" id="${prefix}TextY" value="0"></div></div>
            <div class="setting-row"><label>Màu Chữ</label><div class="setting-inputs">
                <select id="${prefix}ColorMode" onchange="document.getElementById('${prefix}ColorSolidGrp').style.display = this.value === 'solid' ? 'flex' : 'none'; document.getElementById('${prefix}ColorGradGrp').style.display = this.value === 'gradient' ? 'flex' : 'none'; document.getElementById('${prefix}ColorImgGrp').style.display = this.value === 'image' ? 'flex' : 'none'; typeof updatePreview === 'function' ? updatePreview() : drawCanvas();"><option value="solid" selected>Màu trơn</option><option value="gradient">Gradient</option><option value="image">Lồng Ảnh</option></select>
            </div></div>
            <div class="setting-row" id="${prefix}ColorSolidGrp"><label>Màu trơn</label><div class="setting-inputs"><input type="color" id="${prefix}Color" value="#000000" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"></div></div>
            <div class="setting-row" id="${prefix}ColorGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="${prefix}ColorGradient1" value="#000000" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>➔</span><input type="color" id="${prefix}ColorGradient2" value="#ff0000" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>Góc:</span><input type="number" id="${prefix}ColorGradAngle" value="0" style="width:40px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"></div></div>
            <div class="setting-row" id="${prefix}ColorImgGrp" style="display:none;"><label>Ảnh lồng</label><div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                <div style="display:flex; gap:5px; width:100%;">
                    <input type="file" id="${prefix}ColorInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}ColorImage', '${prefix}ColorStatus')">
                    <button type="button" onclick="openBgCloudModal('${prefix}ColorImage', '${prefix}ColorStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                    <button type="button" onclick="removeImage('${prefix}ColorImage', '${prefix}ColorInput', '${prefix}ColorStatus')" class="btn-remove">✕</button>
                </div>
                <div id="${prefix}ColorStatus" class="status-info">❌ Chưa có ảnh</div>
            </div></div>
            <div class="setting-row"><label>Trang trí</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}Bold" checked><b>B</b></label><label><input type="checkbox" id="${prefix}Italic"><i>I</i></label><label><input type="checkbox" id="${prefix}Underline"><u>U</u></label><label><input type="checkbox" id="${prefix}Stroke">Viền</label><input type="color" id="${prefix}StrokeColor" value="#ffffff"><input type="number" id="${prefix}StrokeWidth" value="1"></div></div>
            </div>
            <div class="setting-box" style="border: 1px solid #27ae60;"><div class="setting-title" style="background:#e8f4e8; color:#27ae60;">⛅ BÓNG CHỮ RIÊNG</div><div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}ObjShadow"> Bật bóng chữ</label><span>X:</span><input type="number" id="${prefix}ObjShadowX" value="3"><span>Y:</span><input type="number" id="${prefix}ObjShadowY" value="3"><span>Mờ:</span><input type="number" id="${prefix}ObjShadowBlur" value="5"><input type="color" id="${prefix}ObjShadowColor" value="#000000"></div></div></div>
            ${prefix === 'price' ? `
            <div class="setting-box" style="background:#fafffa; border: 1px solid #2ecc71; margin-top: 10px;">
                <div class="setting-title" style="background:#2ecc71;">✂️ ĐỊNH DẠNG GIÁ</div>
                <div class="setting-row"><label>Kèm chữ</label><div class="setting-inputs"><span>Đầu:</span><input type="text" id="pricePrefix" value="" style="width:50px;" oninput="drawCanvas()"><span>Cuối:</span><input type="text" id="priceSuffix" value="đ" style="width:50px;" oninput="drawCanvas()"></div></div>
                <div class="setting-row"><label>Rút gọn</label><div class="setting-inputs"><select id="priceFormatMode" style="flex:1;" onchange="drawCanvas()"><option value="auto_compact">Rút gọn: 5.5Tr</option><option value="auto_slang">Tiếng lóng: 5Tr5</option><option value="auto_k">Quy ra K: 500K</option><option value="auto" selected>Cơ bản: 5.5 Tr</option><option value="dot">Dấu chấm: 5.000</option><option value="comma">Dấu phẩy: 5,000</option></select></div></div>
            </div>
            ` : ''}
            ${prefix === 'menh' ? `
            <div class="setting-box" style="background:#fffcf0; border: 1px solid #f39c12; margin-top: 10px;">
                <div class="setting-title" style="background:#f39c12;">✂️ ĐỊNH DẠNG MỆNH</div>
                <div class="setting-row"><label>Kiểu chữ</label><div class="setting-inputs"><select id="menhMode" style="flex:1;" onchange="drawCanvas()"><option value="proper" selected>Viết hoa đầu (Thuỷ)</option><option value="upper">Viết hoa hết (THUỶ)</option><option value="short">Chữ cái đầu (T)</option></select></div></div>
                <div class="setting-row"><label>Kèm chữ</label><div class="setting-inputs"><span>Đầu:</span><input type="text" id="menhPrefix" value="" style="width:60px;" oninput="drawCanvas()"><span>Cuối:</span><input type="text" id="menhSuffix" value="" style="width:60px;" oninput="drawCanvas()"></div></div>
            </div>
            ` : ''}
            ${prefix === 'mang' ? `
            <div class="setting-box" style="background:#f0fbff; border: 1px solid #3498db; margin-top: 10px;">
                <div class="setting-title" style="background:#3498db;">✂️ ĐỊNH DẠNG MẠNG</div>
                <div class="setting-row"><label>Kiểu chữ</label><div class="setting-inputs"><select id="mangMode" style="flex:1;" onchange="drawCanvas()"><option value="proper" selected>Viết hoa đầu (từ short2)</option><option value="short2">Viết hoa hết (từ short2)</option><option value="key">Rút gọn (VT, VN)</option><option value="short1">Dữ liệu chuẩn (short1)</option></select></div></div>
                <div class="setting-row"><label>Kèm chữ</label><div class="setting-inputs"><span>Đầu:</span><input type="text" id="mangPrefix" value="" style="width:60px;" oninput="drawCanvas()"><span>Cuối:</span><input type="text" id="mangSuffix" value="" style="width:60px;" oninput="drawCanvas()"></div></div>
            </div>
            ` : ''}
        </div>

        <div id="ssub-${prefix}-bg" class="sub-sub-tab-content">             
            <div class="setting-box">
                <div class="setting-title" style="background:#3498db;">🎨 NỀN Ô KHUNG</div>
                <div class="setting-row"><label>Kiểu nền</label><div class="setting-inputs">
                    <select id="${prefix}BgMode" onchange="document.getElementById('${prefix}BgSolidGrp').style.display = this.value === 'solid' ? 'flex' : 'none'; document.getElementById('${prefix}BgGradGrp').style.display = this.value === 'gradient' ? 'flex' : 'none'; document.getElementById('${prefix}BgImgGrp').style.display = this.value === 'image' ? 'flex' : 'none'; typeof updatePreview === 'function' ? updatePreview() : drawCanvas();"><option value="solid" selected>Màu trơn</option><option value="gradient">Gradient</option><option value="image">Ảnh lót</option></select>
                    <label><input type="checkbox" id="${prefix}BgTrans" checked>Ẩn</label>
                </div></div>
                <div class="setting-row" id="${prefix}BgSolidGrp"><label>Màu lót</label><div class="setting-inputs"><input type="color" id="${prefix}Bg" value="${defBg}" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"></div></div>
                <div class="setting-row" id="${prefix}BgGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="${prefix}BgGradient1" value="${defBg}" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>➔</span><input type="color" id="${prefix}BgGradient2" value="#007bff" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>Góc:</span><input type="number" id="${prefix}BgGradAngle" value="0" style="width:40px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"></div></div>
                <div class="setting-row" id="${prefix}BgImgGrp" style="display:none;"><label>Ảnh nền</label><div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="file" id="${prefix}BgInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}BgImage', '${prefix}BgStatus')">
                        <button type="button" onclick="openBgCloudModal('${prefix}BgImage', '${prefix}BgStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                        <button type="button" onclick="removeImage('${prefix}BgImage', '${prefix}BgInput', '${prefix}BgStatus')" class="btn-remove">✕</button>
                    </div>
                    <div id="${prefix}BgStatus" class="status-info">❌ Chưa có ảnh</div>
                </div></div>
            </div>
            <div class="setting-box">
                <div class="setting-title" style="background:#f39c12;">🔲 VIỀN Ô KHUNG</div>
                <div class="setting-row"><label>Kiểu viền</label><div class="setting-inputs">
                    <select id="${prefix}BorderMode" onchange="document.getElementById('${prefix}BorderSolidGrp').style.display = this.value === 'solid' ? 'flex' : 'none'; document.getElementById('${prefix}BorderGradGrp').style.display = this.value === 'gradient' ? 'flex' : 'none'; document.getElementById('${prefix}BorderImgGrp').style.display = this.value === 'image' ? 'flex' : 'none'; typeof updatePreview === 'function' ? updatePreview() : drawCanvas();"><option value="solid" selected>Màu trơn</option><option value="gradient">Gradient</option><option value="image">Ảnh</option></select>
                    <label><input type="checkbox" id="${prefix}BorderTrans" checked>Ẩn</label>
                </div></div>
                <div class="setting-row" id="${prefix}BorderSolidGrp"><label>Màu viền</label><div class="setting-inputs"><input type="color" id="${prefix}BorderColor" value="#007bff" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"></div></div>
                <div class="setting-row" id="${prefix}BorderGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="${prefix}BorderGradient1" value="#007bff" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>➔</span><input type="color" id="${prefix}BorderGradient2" value="#ff0000" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>Góc:</span><input type="number" id="${prefix}BorderGradAngle" value="0" style="width:40px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"></div></div>
                <div class="setting-row" id="${prefix}BorderImgGrp" style="display:none;"><label>Ảnh viền</label><div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="file" id="${prefix}BorderInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}BorderImage', '${prefix}BorderStatus')">
                        <button type="button" onclick="openBgCloudModal('${prefix}BorderImage', '${prefix}BorderStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                        <button type="button" onclick="removeImage('${prefix}BorderImage', '${prefix}BorderInput', '${prefix}BorderStatus')" class="btn-remove">✕</button>
                    </div>
                    <div id="${prefix}BorderStatus" class="status-info">❌ Chưa có ảnh</div>
                </div></div>
                <div class="setting-row"><label>Dày/Bo</label><div class="setting-inputs"><span>Dày:</span><input type="number" id="${prefix}BorderW" value="2" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><span>Bo(R):</span><input type="number" id="${prefix}Radius" value="8" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><select id="${prefix}BorderStyle" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"><option value="solid">Liền</option><option value="dashed">Đứt</option><option value="dotted">Chấm</option><option value="double">Đôi</option></select></div></div>
            </div>
            <div class="setting-box" style="border: 1px solid #d35400;">
                <div class="setting-title" style="background:#fffcf0; color:#d35400;">📦 BÓNG NỀN Ô</div>
                <div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}BoxShadow" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"> Bật bóng Nền</label><span>X:</span><input type="number" id="${prefix}BoxShadowX" value="5"><span>Y:</span><input type="number" id="${prefix}BoxShadowY" value="5"><span>Mờ:</span><input type="number" id="${prefix}BoxShadowBlur" value="10"><input type="color" id="${prefix}BoxShadowColor" value="#000000"></div></div>
            </div>
            <div class="setting-box" style="border: 1px solid #e67e22;">
                <div class="setting-title" style="background:#fdf2e9; color:#e67e22;">🔲 BÓNG NÉT VIỀN</div>
                <div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}BorderShadow" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"> Bật bóng Viền</label><span>X:</span><input type="number" id="${prefix}BorderShadowX" value="2"><span>Y:</span><input type="number" id="${prefix}BorderShadowY" value="2"><span>Mờ:</span><input type="number" id="${prefix}BorderShadowBlur" value="4"><input type="color" id="${prefix}BorderShadowColor" value="#000000"></div></div>
            </div>
        </div>

        ${hasShape ? `
        <div id="ssub-${prefix}-shape" class="sub-sub-tab-content">
            <div class="setting-box" style="border: 2px solid #e74c3c;">
                <div class="setting-title" style="background:#fff0f0; color:#e74c3c; display: flex; justify-content: space-between; align-items: center;">
                    <span>💎 THIẾT KẾ KHỐI ĐỘC LẬP</span>
                    <label style="font-size: 11px; cursor: pointer; color: #e74c3c; display: flex; align-items: center; gap: 4px;">
                        <input type="checkbox" id="${prefix}Shape3D" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"> BẬT BÓNG 3D
                    </label>
                </div>
                
                <div class="setting-row">
                    <label>1. Chọn dáng</label>
                    <div class="setting-inputs">
                        <select id="${prefix}ShapeType" onchange="toggleShapeOptions('${prefix}'); typeof updatePreview === 'function' ? updatePreview() : drawCanvas()" style="font-weight:bold; color:#e74c3c;">
                            <option value="none" selected>Không dùng khối</option>
                            <option value="text_only">Chữ theo màu mạng</option>
                            <option disabled>--- Nền Bo/Vuông Mới ---</option>
                            <option value="rect_round_tight">Vuông bo tròn (Gần khít)</option>
                            <option disabled>--- Các Loại Khối Cũ ---</option>
                            <option value="circle">Hình tròn</option>
                            <option value="diamond">Hình Thoi</option>
                            <option value="pentagon">Ngũ giác (5)</option>
                            <option value="hexagon">Lục giác (6)</option>
                            <option value="octagon">Bát giác (8)</option>
                            <option value="teardrop">Giọt nước</option>
                            <option value="star">Ngôi sao</option>
                        </select>
                    </div>
                </div>

                <div id="${prefix}ShapeOptions" style="display: none; border-top: 1px dashed #e74c3c; padding-top: 10px; margin-top: 8px;">
                    
                    <div class="setting-row" id="${prefix}ShapeSizeRow">
                        <label>5. KÍCH THƯỚC</label>
                        <div class="setting-inputs" style="flex-wrap: wrap; gap: 5px;">
                            <div style="display:flex; align-items:center; gap:3px; background:#fafffa; padding:2px 5px; border-radius:4px; border:1px solid #2ecc71;">
                                <span>W:</span><input type="number" id="${prefix}ShapeW" value="45" style="width:45px;" oninput="drawCanvas()">
                                <label style="font-size:10px; color:#27ae60; cursor:pointer; font-weight:bold;"><input type="checkbox" id="${prefix}ShapeAutoW" onchange="toggleShapeOptions('${prefix}'); drawCanvas()"> AUTO</label>
                            </div>
                            <div style="display:flex; align-items:center; gap:3px; background:#fafffa; padding:2px 5px; border-radius:4px; border:1px solid #2ecc71;">
                                <span>H:</span><input type="number" id="${prefix}ShapeH" value="45" style="width:45px;" oninput="drawCanvas()">
                                <label style="font-size:10px; color:#27ae60; cursor:pointer; font-weight:bold;"><input type="checkbox" id="${prefix}ShapeAutoH" onchange="toggleShapeOptions('${prefix}'); drawCanvas()"> AUTO</label>
                            </div>
                        </div>
                    </div>

                    <div class="setting-box" style="border: 1px solid #f39c12; margin-top: 10px;">
                        <div class="setting-title" style="background:#fdf2e9; color:#f39c12;">🔲 VIỀN KHỐI</div>
                        
                        <div class="setting-row">
                            <label>Kiểu viền</label>
                            <div class="setting-inputs">
                                <select id="${prefix}ShapeBorderMode" onchange="document.getElementById('${prefix}ShapeBorderSolidGrp').style.display = this.value === 'solid' ? 'flex' : 'none'; document.getElementById('${prefix}ShapeBorderGradGrp').style.display = this.value === 'gradient' ? 'flex' : 'none'; document.getElementById('${prefix}ShapeBorderImgGrp').style.display = this.value === 'image' ? 'flex' : 'none'; typeof updatePreview === 'function' ? updatePreview() : drawCanvas();">
                                    <option value="solid" selected>Màu trơn</option>
                                    <option value="gradient">Gradient</option>
                                    <option value="image">Lồng Ảnh</option>
                                </select>
                                <label><input type="checkbox" id="${prefix}ShapeBorderTrans" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"> Ẩn</label>
                            </div>
                        </div>

                        <div class="setting-row" id="${prefix}ShapeBorderSolidGrp">
                            <label>Màu viền</label>
                            <div class="setting-inputs">
                                <input type="color" id="${prefix}ShapeBorderColor" value="#ffffff" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                            </div>
                        </div>

                        <div class="setting-row" id="${prefix}ShapeBorderGradGrp" style="display:none;">
                            <label>Gradient</label>
                            <div class="setting-inputs">
                                <input type="color" id="${prefix}ShapeBorderGradient1" value="#007bff" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span>➔</span>
                                <input type="color" id="${prefix}ShapeBorderGradient2" value="#ff0000" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span>Góc:</span><input type="number" id="${prefix}ShapeBorderGradAngle" value="0" style="width:40px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                            </div>
                        </div>

                        <div class="setting-row" id="${prefix}ShapeBorderImgGrp" style="display:none;">
                            <label>Ảnh lồng</label>
                            <div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                                <div style="display:flex; gap:5px; width:100%;">
                                    <input type="file" id="${prefix}ShapeBorderInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}ShapeBorderImage', '${prefix}ShapeBorderStatus')">
                                    <button type="button" onclick="openBgCloudModal('${prefix}ShapeBorderImage', '${prefix}ShapeBorderStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                                    <button type="button" onclick="removeImage('${prefix}ShapeBorderImage', '${prefix}ShapeBorderInput', '${prefix}ShapeBorderStatus')" class="btn-remove">✕</button>
                                </div>
                                <div id="${prefix}ShapeBorderStatus" class="status-info">❌ Chưa có ảnh</div>
                            </div>
                        </div>

                        <div class="setting-row">
                            <label>Dày/Bo</label>
                            <div class="setting-inputs">
                                <span>Dày:</span><input type="number" id="${prefix}ShapeBorderW" value="2" style="width:40px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span id="${prefix}ShapeRadiusGrp" style="display:none;">
                                    <span>Bo(R):</span><input type="number" id="${prefix}ShapeRadius" value="0" style="width:40px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                </span>
                                <select id="${prefix}ShapeBorderStyle" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                    <option value="solid">Liền</option><option value="dashed">Đứt</option><option value="dotted">Chấm</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="setting-box" style="border: 1px solid #d35400; margin-top: 10px;">
                        <div class="setting-title" style="background:#fffcf0; color:#d35400;">📦 BÓNG KHỐI</div>
                        <div class="setting-row">
                            <label>Trạng thái</label>
                            <div class="setting-inputs">
                                <input type="checkbox" id="${prefix}ShapeBoxShadow" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"> <span>Bật</span>
                                <span>X:</span><input type="number" id="${prefix}ShapeBoxShadowX" value="2" style="width:35px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span>Y:</span><input type="number" id="${prefix}ShapeBoxShadowY" value="2" style="width:35px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span>Mờ:</span><input type="number" id="${prefix}ShapeBoxShadowBlur" value="4" style="width:35px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <input type="color" id="${prefix}ShapeBoxShadowColor" value="#000000" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                            </div>
                        </div>
                    </div>

                    <div class="setting-box" style="border: 1px solid #e67e22; margin-top: 10px;">
                        <div class="setting-title" style="background:#fdf2e9; color:#e67e22;">🔲 BÓNG NÉT VIỀN</div>
                        <div class="setting-row">
                            <label>Trạng thái</label>
                            <div class="setting-inputs">
                                <input type="checkbox" id="${prefix}ShapeBorderShadow" onchange="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()"> <span>Bật</span>
                                <span>X:</span><input type="number" id="${prefix}ShapeBorderShadowX" value="0" style="width:35px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span>Y:</span><input type="number" id="${prefix}ShapeBorderShadowY" value="0" style="width:35px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <span>Mờ:</span><input type="number" id="${prefix}ShapeBorderShadowBlur" value="3" style="width:35px;" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                                <input type="color" id="${prefix}ShapeBorderShadowColor" value="#ffffff" oninput="typeof updatePreview === 'function' ? updatePreview() : drawCanvas()">
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        ` : ''}
    </div>`;
    return html;
};

window.generateHeaderTab = function(prefix, title, defX, defW, defY = 0, ax = 'center', ay = 'top') {
    let html = `
        <div id="sub-${prefix}" class="sub-tab-content">
            <div class="sub-tabs">
                <button class="sub-sub-tab-btn active" onclick="switchSubSubTab('ssub-${prefix}-pos', this)">📐 Vị Trí</button>
                <button class="sub-sub-tab-btn" onclick="switchSubSubTab('ssub-${prefix}-format', this)">📝 Định Dạng</button>
                <button class="sub-sub-tab-btn" onclick="switchSubSubTab('ssub-${prefix}-bg', this)">🎨 Nền & Viền</button>
            </div>
            <div id="ssub-${prefix}-format" class="sub-sub-tab-content">
                <div class="setting-box"><div class="setting-title" style="background:#2ecc71;">🔠 Định Dạng Chữ</div>
                <div class="setting-row"><label style="color:#e74c3c;">Tên hiển thị</label><div class="setting-inputs"><input type="text" id="${prefix}Text" value="${title}" class="flex-1"></div></div>
                <div class="setting-row"><label>Font & Cỡ</label><div class="setting-inputs"><select id="${prefix}Font" class="font-selector" style="max-width:110px;"></select><button type="button" class="btn-mini" style="background:#8e44ad; padding:2px 8px; font-weight:bold;" onclick="document.getElementById('globalFontInput').click()" title="Tải font riêng (.ttf, .otf)">+ Font</button><span>Size:</span><input type="number" id="${prefix}Size" value="24"><span>Dãn:</span><input type="number" id="${prefix}ScaleY" value="1" step="0.1" style="width:40px;"></div></div>
                <div class="setting-row"><label>Canh & Lệch</label><div class="setting-inputs"><select id="${prefix}TextAlign"><option value="left">Trái</option><option value="center" selected>Giữa</option><option value="right">Phải</option></select><span>Pad:</span><input type="number" id="${prefix}TextPad" value="5"><span>X:</span><input type="number" id="${prefix}TextX" value="0"><span>Y:</span><input type="number" id="${prefix}TextY" value="0"></div></div>
                <div class="setting-row"><label>Màu Chữ</label><div class="setting-inputs"><select id="${prefix}ColorMode" onchange="updateUI()"><option value="solid" selected>Màu trơn</option><option value="gradient">Gradient</option><option value="image">Lồng Ảnh</option></select></div></div>
                <div class="setting-row" id="${prefix}ColorSolidGrp"><label>Màu trơn</label><div class="setting-inputs"><input type="color" id="${prefix}Color" value="#000000"></div></div>
                <div class="setting-row" id="${prefix}ColorGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="${prefix}ColorGradient1" value="#000000"><span>➔</span><input type="color" id="${prefix}ColorGradient2" value="#ff0000"><span>Góc:</span><input type="number" id="${prefix}ColorGradAngle" value="0" style="width:40px;"></div></div>
                <div class="setting-row" id="${prefix}ColorImgGrp" style="display:none;"><label>Ảnh lồng</label><div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="file" id="${prefix}ColorInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}ColorImage', '${prefix}ColorStatus')">
                        <button type="button" onclick="openBgCloudModal('${prefix}ColorImage', '${prefix}ColorStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                        <button type="button" onclick="removeImage('${prefix}ColorImage', '${prefix}ColorInput', '${prefix}ColorStatus')" class="btn-remove">✕</button>
                    </div>
                    <div id="${prefix}ColorStatus" class="status-info">❌ Chưa có ảnh</div>
                </div></div>
                <div class="setting-row"><label>Trang trí</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}Bold" checked><b>B</b></label><label><input type="checkbox" id="${prefix}Italic"><i>I</i></label><label><input type="checkbox" id="${prefix}Underline"><u>U</u></label><label><input type="checkbox" id="${prefix}Stroke">Viền</label><input type="color" id="${prefix}StrokeColor" value="#ffffff"><input type="number" id="${prefix}StrokeWidth" value="1"></div></div>
                </div>
                <div class="setting-box" style="border: 1px solid #27ae60;"><div class="setting-title" style="background:#e8f4e8; color:#27ae60;">⛅ BÓNG CHỮ (ObjShadow)</div><div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}ObjShadow"> Bật bóng chữ</label><span>X:</span><input type="number" id="${prefix}ObjShadowX" value="3"><span>Y:</span><input type="number" id="${prefix}ObjShadowY" value="3"><span>Mờ:</span><input type="number" id="${prefix}ObjShadowBlur" value="5"><input type="color" id="${prefix}ObjShadowColor" value="#000000"></div></div></div>
            </div>
            <div id="ssub-${prefix}-pos" class="sub-sub-tab-content active">
                <div class="setting-box"><div class="setting-title">📐 Vị Trí & Kích Thước</div>
                <div class="setting-row"><label>Kích thước</label><div class="setting-inputs"><span>W:</span><input type="number" id="${prefix}W" value="${defW}"><span>H:</span><input type="number" id="${prefix}H" value="40"></div></div>
                <div class="setting-row"><label>Lệch khối</label><div class="setting-inputs"><span>X:</span><input type="number" id="${prefix}X" value="${defX}"><span>Y:</span><input type="number" id="${prefix}Y" value="${defY}"></div></div>
                <div class="setting-row"><label>Xoay (Góc)</label><div class="setting-inputs"><span>∠:</span><input type="number" id="${prefix}Angle" value="0" style="width:45px;"> <input type="range" min="-180" max="180" value="0" oninput="document.getElementById('${prefix}Angle').value=this.value; typeof updatePreview === 'function' ? updatePreview() : drawCanvas()" style="flex:1;"></div></div>
                <div class="setting-row"><label>Khóa/Canh</label><div class="setting-inputs">
                    <select id="${prefix}AlignX" onchange="drawCanvas(); updateUI();" style="flex:1; padding:5px; border-radius:6px; border:1px solid #ddd;">
                        <option value="left" ${ax === 'left' ? 'selected' : ''}>Ngang: Trái</option>
                        <option value="center" ${ax === 'center' ? 'selected' : ''}>Ngang: Giữa</option>
                        <option value="right" ${ax === 'right' ? 'selected' : ''}>Ngang: Phải</option>
                        <option value="auto" ${ax === 'auto' ? 'selected' : ''}>✨ Auto (Lật gáy)</option>
                    </select>
                    <select id="${prefix}AlignY" onchange="drawCanvas(); updateUI();" style="flex:1; padding:5px; border-radius:6px; border:1px solid #ddd;"><option value="top" ${ay === 'top' ? 'selected' : ''}>Dọc: Trên</option><option value="middle" ${ay === 'middle' ? 'selected' : ''}>Dọc: Giữa</option><option value="bottom" ${ay === 'bottom' ? 'selected' : ''}>Dọc: Dưới</option></select>
                    <label style="color:red; background:#fff; padding:5px 8px; border-radius:6px; border:1px solid #ddd; cursor:pointer;"><input type="checkbox" id="${prefix}Locked"> Khóa</label>
                </div></div>
                </div>
            </div>
            <div id="ssub-${prefix}-bg" class="sub-sub-tab-content">
                <div class="setting-box"><div class="setting-title" style="background:#e74c3c;">🎨 NỀN Ô KHUNG</div>
                <div class="setting-row"><label>Kiểu nền</label><div class="setting-inputs"><select id="${prefix}BgMode" onchange="updateUI()"><option value="solid" selected>Màu trơn</option><option value="gradient">Gradient</option><option value="image">Ảnh lót</option></select><label><input type="checkbox" id="${prefix}BgTrans" checked>Ẩn</label></div></div>
                <div class="setting-row" id="${prefix}BgSolidGrp"><label>Màu lót</label><div class="setting-inputs"><input type="color" id="${prefix}Bg" value="#ffffff"></div></div>
                <div class="setting-row" id="${prefix}BgGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="${prefix}BgGradient1" value="#ffffff"><span>➔</span><input type="color" id="${prefix}BgGradient2" value="#007bff"><span>Góc:</span><input type="number" id="${prefix}BgGradAngle" value="0" style="width:40px;"></div></div>
                <div class="setting-row" id="${prefix}BgImgGrp" style="display:none;"><label>Ảnh nền</label><div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="file" id="${prefix}BgInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}BgImage', '${prefix}BgStatus')">
                        <button type="button" onclick="openBgCloudModal('${prefix}BgImage', '${prefix}BgStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                        <button type="button" onclick="removeImage('${prefix}BgImage', '${prefix}BgInput', '${prefix}BgStatus')" class="btn-remove">✕</button>
                    </div>
                    <div id="${prefix}BgStatus" class="status-info">❌ Chưa có ảnh</div>
                </div></div>
                </div>
                <div class="setting-box"><div class="setting-title" style="background:#f39c12;">🔲 VIỀN Ô KHUNG</div>
                <div class="setting-row"><label>Kiểu viền</label><div class="setting-inputs"><select id="${prefix}BorderMode" onchange="updateUI()"><option value="solid" selected>Màu trơn</option><option value="gradient">Gradient</option><option value="image">Ảnh</option></select><label><input type="checkbox" id="${prefix}BorderTrans" checked>Ẩn</label></div></div>
                <div class="setting-row" id="${prefix}BorderSolidGrp"><label>Màu viền</label><div class="setting-inputs"><input type="color" id="${prefix}BorderColor" value="#007bff"></div></div>
                <div class="setting-row" id="${prefix}BorderGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="${prefix}BorderGradient1" value="#007bff"><span>➔</span><input type="color" id="${prefix}BorderGradient2" value="#ff0000"><span>Góc:</span><input type="number" id="${prefix}BorderGradAngle" value="0" style="width:40px;"></div></div>
                <div class="setting-row" id="${prefix}BorderImgGrp" style="display:none;"><label>Ảnh viền</label><div class="setting-inputs" style="flex-direction:column; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="file" id="${prefix}BorderInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, '${prefix}BorderImage', '${prefix}BorderStatus')">
                        <button type="button" onclick="openBgCloudModal('${prefix}BorderImage', '${prefix}BorderStatus')" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                        <button type="button" onclick="removeImage('${prefix}BorderImage', '${prefix}BorderInput', '${prefix}BorderStatus')" class="btn-remove">✕</button>
                    </div>
                    <div id="${prefix}BorderStatus" class="status-info">❌ Chưa có ảnh</div>
                </div></div>
                <div class="setting-row"><label>Dày/Bo</label><div class="setting-inputs"><span>Dày:</span><input type="number" id="${prefix}BorderW" value="2"><span>Bo(R):</span><input type="number" id="${prefix}Radius" value="8"><select id="${prefix}BorderStyle"><option value="solid">Liền</option><option value="dashed">Đứt</option><option value="dotted">Chấm</option><option value="double">Đôi</option></select></div></div></div>
                <div class="setting-box" style="border: 1px solid #d35400;"><div class="setting-title" style="background:#fffcf0; color:#d35400;">📦 BÓNG NỀN Ô</div><div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}BoxShadow"> Bật bóng Nền</label><span>X:</span><input type="number" id="${prefix}BoxShadowX" value="5"><span>Y:</span><input type="number" id="${prefix}BoxShadowY" value="5"><span>Mờ:</span><input type="number" id="${prefix}BoxShadowBlur" value="10"><input type="color" id="${prefix}BoxShadowColor" value="#000000"></div></div></div>
                <div class="setting-box" style="border: 1px solid #e67e22;"><div class="setting-title" style="background:#fdf2e9; color:#e67e22;">🔲 BÓNG NÉT VIỀN</div><div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="${prefix}BorderShadow"> Bật bóng Viền</label><span>X:</span><input type="number" id="${prefix}BorderShadowX" value="2"><span>Y:</span><input type="number" id="${prefix}BorderShadowY" value="2"><span>Mờ:</span><input type="number" id="${prefix}BorderShadowBlur" value="4"><input type="color" id="${prefix}BorderShadowColor" value="#000000"></div></div></div>
            </div>
        </div>`;
    return html;
};

// --- INITIALIZE DYNAMIC UI ---
window.initDynamicUI = function() {
    const container = document.getElementById('dynamic-tabs-container');
    if (!container) return;

    let layoutHtml = `<div id="tab-layout" class="tab-content active"><div class="sub-tabs"><button class="sub-tab-btn active" onclick="switchSubTab('sub-luoi-chung', this)">Lưới Chung</button><button class="sub-tab-btn" onclick="switchSubTab('sub-num', this)">SỐ</button><button class="sub-tab-btn" onclick="switchSubTab('sub-price', this)">GIÁ</button><button class="sub-tab-btn" onclick="switchSubTab('sub-menh', this)">MỆNH</button><button class="sub-tab-btn" onclick="switchSubTab('sub-mang', this)">MẠNG</button><button class="sub-tab-btn" onclick="switchSubTab('sub-data1', this)">DL 1</button><button class="sub-tab-btn" onclick="switchSubTab('sub-data2', this)">DL 2</button></div>`;

    layoutHtml += `<div id="sub-luoi-chung" class="sub-tab-content active">
    <div class="sub-tabs" style="background:#eee; margin-bottom:15px;">
        <button class="sub-sub-tab-btn active" onclick="switchSubSubTab('sub-sub-luoi-size', this)">📏 Kích Thước</button>
        <button class="sub-sub-tab-btn" onclick="switchSubSubTab('sub-sub-luoi-style', this)">🎨 Nền & Viền</button>
        <button class="sub-sub-tab-btn" onclick="switchSubSubTab('sub-sub-luoi-zebra', this)">🦓 Ngựa Vằn</button>
    </div>

    <div id="sub-sub-luoi-size" class="sub-sub-tab-content active">
        <div class="setting-box"><div class="setting-title">📏 Kích Thước Lưới</div>
            <div class="setting-row"><label>Cột hiển thị</label><div class="setting-inputs"><label><input type="checkbox" id="chkNum" checked onchange="updateUI()">Số</label><label><input type="checkbox" id="chkPrice" checked onchange="updateUI()">Giá</label><label><input type="checkbox" id="chkMenh" checked onchange="updateUI()">Mệnh</label><label><input type="checkbox" id="chkMang" checked onchange="updateUI()">Mạng</label><label><input type="checkbox" id="chkData1" checked onchange="updateUI()">DL1</label><label><input type="checkbox" id="chkData2" checked onchange="updateUI()">DL2</label></div></div>
            <div class="setting-row"><label>Ô Lưới</label><div class="setting-inputs"><span>W:</span><input type="number" id="cellW" value="380"><span>H:</span><input type="number" id="cellH" value="60"></div></div>
            <div class="setting-row"><label>Số lượng</label><div class="setting-inputs"><span>Cột:</span><input type="number" id="tableCols" value="2"><span>Dòng:</span><input type="number" id="tableRows" value="10"></div></div>
            <div class="setting-row"><label>Cách nhau</label><div class="setting-inputs"><span>Cột:</span><input type="number" id="tableGap" value="15"><span>Dòng:</span><input type="number" id="rowGap" value="10"></div></div>
        </div>
    </div>

    <div id="sub-sub-luoi-style" class="sub-sub-tab-content">
        <div class="setting-box">
            <div class="setting-title" style="background:#f39c12;">🎨 NỀN Ô LƯỚI & BÓNG CELL</div>
            <div class="setting-row"><label>Nền Ô Lưới</label><div class="setting-inputs">
                <select id="cellBgMode" onchange="document.getElementById('cellBgSolidGrp').style.display = this.value === 'solid' ? 'flex' : 'none'; document.getElementById('cellBgGradGrp').style.display = this.value === 'gradient' ? 'flex' : 'none'; document.getElementById('cellBgImgGrp').style.display = this.value === 'image' ? 'flex' : 'none'; updateUI();">
                    <option value="solid" selected>Trơn</option><option value="gradient">Gradient</option><option value="image">Ảnh</option>
                </select>
                <label><input type="checkbox" id="cellBgTrans" checked>Ẩn</label></div></div>
            <div class="setting-row" id="cellBgSolidGrp"><label>Màu nền</label><div class="setting-inputs"><input type="color" id="cellBg" value="#ffffff"></div></div>
            <div class="setting-row" id="cellBgGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="cellBgGradient1" value="#ffffff"><span>➔</span><input type="color" id="cellBgGradient2" value="#f0f0f0"><span>Góc:</span><input type="number" id="cellBgGradAngle" value="0" style="width:40px;"></div></div>
            <div class="setting-row" id="cellBgImgGrp" style="display:none;"><label>Ảnh nền</label><div class="setting-inputs" style="flex-direction:column; gap:3px;">
                <div style="display:flex; gap:5px; width:100%;"><input type="file" id="cellBgInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, 'cellBgImage', 'cellBgStatus')">
                <button type="button" onclick="document.getElementById('cellBgInput').value=''; document.getElementById('cellBgStatus').innerHTML='☁️ Đang dùng ảnh Mây'; openBgCloudModal('cellBgImage', 'cellBgStatus');" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                <button type="button" onclick="removeImage('cellBgImage', 'cellBgInput', 'cellBgStatus')" class="btn-remove">✕</button></div>
                <div id="cellBgStatus" class="status-info">❌ Chưa có ảnh</div></div></div>
            <div class="setting-row"><label>Viền Lưới</label><div class="setting-inputs">
                <select id="cellBorderMode" onchange="document.getElementById('cellBorderSolidGrp').style.display = this.value === 'solid' ? 'flex' : 'none'; document.getElementById('cellBorderGradGrp').style.display = this.value === 'gradient' ? 'flex' : 'none'; document.getElementById('cellBorderImgGrp').style.display = this.value === 'image' ? 'flex' : 'none'; updateUI();">
                    <option value="solid" selected>Trơn</option><option value="gradient">Gradient</option><option value="image">Ảnh</option>
                </select>
                <label><input type="checkbox" id="cellBorderTrans">Ẩn</label></div></div>
            <div class="setting-row" id="cellBorderSolidGrp"><label>Màu viền</label><div class="setting-inputs"><input type="color" id="cellBorderColor" value="#cccccc"></div></div>
            <div class="setting-row" id="cellBorderGradGrp" style="display:none;"><label>Gradient</label><div class="setting-inputs"><input type="color" id="cellBorderGradient1" value="#cccccc"><span>➔</span><input type="color" id="cellBorderGradient2" value="#000000"><span>Góc:</span><input type="number" id="cellBorderGradAngle" value="0" style="width:40px;"></div></div>
            <div class="setting-row" id="cellBorderImgGrp" style="display:none;"><label>Ảnh viền</label><div class="setting-inputs" style="flex-direction:column; gap:3px;">
                <div style="display:flex; gap:5px; width:100%;"><input type="file" id="cellBorderInput" accept="image/*" class="mini" style="flex:1;" onchange="setLocalImage(this, 'cellBorderImage', 'cellBorderStatus')">
                <button type="button" onclick="document.getElementById('cellBorderInput').value=''; document.getElementById('cellBorderStatus').innerHTML='☁️ Đang dùng ảnh Mây'; openBgCloudModal('cellBorderImage', 'cellBorderStatus');" class="btn-mini" style="background:var(--success);">☁️ MÂY</button>
                <button type="button" onclick="removeImage('cellBorderImage', 'cellBorderInput', 'cellBorderStatus')" class="btn-remove">✕</button></div>
                <div id="cellBorderStatus" class="status-info">❌ Chưa có ảnh</div></div></div>
            <div class="setting-row"><label>Dày/Bo</label><div class="setting-inputs"><span>Dày:</span><input type="number" id="cellBorderW" value="1"><span>Bo:</span><input type="number" id="cellRadius" value="0"><select id="cellBorderStyle"><option value="solid">Liền</option><option value="dashed">Đứt</option><option value="dotted">Chấm</option><option value="double">Đôi</option></select></div></div>
            <div class="setting-row" style="background:#fffcf0;"><label style="color:red;">🔲 Bóng Cell</label><div class="setting-inputs"><label><input type="checkbox" id="cellBoxShadow"> Bật bóng Ô Lưới</label><span>X:</span><input type="number" id="cellBoxShadowX" value="3"><span>Y:</span><input type="number" id="cellBoxShadowY" value="3"><span>Mờ:</span><input type="number" id="cellBoxShadowBlur" value="8"><input type="color" id="cellBoxShadowColor" value="#000000"></div></div>
        </div>
    </div>

    <div id="sub-sub-luoi-zebra" class="sub-sub-tab-content">
        <div class="setting-box" style="border-left: 5px solid #2ecc71;">
            <div class="setting-title" style="background:#2ecc71; color:white;">🦓 Cài đặt Đổ màu Ngựa Vằn</div>
            <div class="setting-row" style="background:#e8f4e8;"><label style="color:green;">🦓 Ngựa Vằn</label><div class="setting-inputs"><label><input type="checkbox" id="useZebra" onchange="updateUI()"> Bật nền xen kẽ</label></div></div>
            <div id="zebraSettingsContainer" style="display:none; background:#f9fff9; border:1px dashed #2ecc71; padding:10px; border-radius:8px; margin-top:5px;">
                <div class="setting-row" style="border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px;">
                    <label style="color:#27ae60; width:100px; font-size:11px;">Dòng Lẻ (1,3..)</label>
                    <div class="setting-inputs" style="flex-wrap:wrap; gap:5px;">
                        <div style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>NỀN:</span><input type="color" id="zebraOddBg" value="#ffffff"></div>
                        <div id="zebraOddNumGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ 🔢:</span><input type="color" id="zebraOddNumColor" value="#000000"></div>
                        <div id="zebraOddPriceGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ 💰:</span><input type="color" id="zebraOddPriceColor" value="#000000"></div>
                        <div id="zebraOddMenhGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ ☯️:</span><input type="color" id="zebraOddMenhColor" value="#000000"></div>
                        <div id="zebraOddMangGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ 🏷️:</span><input type="color" id="zebraOddMangColor" value="#000000"></div>
                        <div id="zebraOddData1Grp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ DL1:</span><input type="color" id="zebraOddData1Color" value="#000000"></div>
                        <div id="zebraOddData2Grp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ DL2:</span><input type="color" id="zebraOddData2Color" value="#000000"></div>
                    </div>
                </div>
                <div class="setting-row">
                    <label style="color:#e67e22; width:100px; font-size:11px;">Dòng Chẵn (2,4..)</label>
                    <div class="setting-inputs" style="flex-wrap:wrap; gap:5px;">
                        <div style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>NỀN:</span><input type="color" id="zebraEvenBg" value="#f2f2f2"></div>
                        <div id="zebraEvenNumGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ 🔢:</span><input type="color" id="zebraEvenNumColor" value="#000000"></div>
                        <div id="zebraEvenPriceGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ 💰:</span><input type="color" id="zebraEvenPriceColor" value="#000000"></div>
                        <div id="zebraEvenMenhGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ ☯️:</span><input type="color" id="zebraEvenMenhColor" value="#000000"></div>
                        <div id="zebraEvenMangGrp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ 🏷️:</span><input type="color" id="zebraEvenMangColor" value="#000000"></div>
                        <div id="zebraEvenData1Grp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ DL1:</span><input type="color" id="zebraEvenData1Color" value="#000000"></div>
                        <div id="zebraEvenData2Grp" style="display:flex; align-items:center; gap:2px; font-size:10px;"><span>Chữ DL2:</span><input type="color" id="zebraEvenData2Color" value="#000000"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;

    layoutHtml += generateColTab('num', 'Cột Số', 0, false, 200, '#ffffff') + generateColTab('price', 'Cột Giá', 65, false, 110, '#ffffff') + generateColTab('menh', 'Cột Mệnh', 0, true, 70, '#ffffff') + generateColTab('mang', 'Cột Mạng', -80, true, 70, '#ffffff') + generateColTab('data1', 'Cột DL 1', 0, false, 100, '#ffffff') + generateColTab('data2', 'Cột DL 2', 0, false, 100, '#ffffff') + `</div>`;

    let headHtml = `<div id="tab-colheader" class="tab-content"><div class="sub-tabs"><button class="sub-tab-btn active" onclick="switchSubTab('sub-hCommon', this)">Bật/Tắt Tiêu Đề</button><button class="sub-tab-btn" onclick="switchSubTab('sub-hNum', this)">T.Đề SỐ</button><button class="sub-tab-btn" onclick="switchSubTab('sub-hPrice', this)">T.Đề GIÁ</button><button class="sub-tab-btn" onclick="switchSubTab('sub-hMenh', this)">T.Đề MỆNH</button><button class="sub-tab-btn" onclick="switchSubTab('sub-hMang', this)">T.Đề MẠNG</button><button class="sub-tab-btn" onclick="switchSubTab('sub-hData1', this)">T.Đề DL 1</button><button class="sub-tab-btn" onclick="switchSubTab('sub-hData2', this)">T.Đề DL 2</button></div>`;
    headHtml += `<div id="sub-hCommon" class="sub-tab-content active"><div class="setting-box"><div class="setting-title">🏷️ Kích Hoạt Tiêu Đề</div><div class="setting-row"><label>Trạng thái</label><div class="setting-inputs"><label><input type="checkbox" id="showHeaderRow" checked> Hiện hàng Tiêu Đề</label><span>Cao(H):</span><input type="number" id="headerRowHeight" value="50"></div></div></div></div>`;
    headHtml += generateHeaderTab('hNum', 'SỐ ĐẸP VIP', 0, 200) + generateHeaderTab('hPrice', 'GIÁ BÁN', 65, 110) + generateHeaderTab('hMenh', 'MỆNH', 0, 70) + generateHeaderTab('hMang', 'MẠNG', -80, 70) + generateHeaderTab('hData1', 'DỮ LIỆU 1', 0, 100) + generateHeaderTab('hData2', 'DỮ LIỆU 2', 0, 100) + `</div>`;

    let globHtml = `<div id="tab-globaltext" class="tab-content"><div class="sub-tabs" id="globalTextTabs" style="flex-wrap: wrap;"></div><div id="dynamic-globals-container">`;
    let gT = [
        { id: 'header1', t: 'Tiêu Đề 1', d: 'BẢNG SIM SỐ ĐẸP', w: 500, y: -25, ax: 'center', ay: 'top' },
        { id: 'header2', t: 'Tiêu Đề 2', d: 'Uy Tín - Chất Lượng', w: 500, y: 25, ax: 'center', ay: 'top' },
        { id: 'footer1', t: 'Chân Trang 1', d: 'Giao Sim Tận Nơi', w: 500, y: -25, ax: 'center', ay: 'bottom' },
        { id: 'footer2', t: 'Chân Trang 2', d: 'Hotline: 0909.123.456', w: 500, y: 25, ax: 'center', ay: 'bottom' },
        { id: 'ctl', t: 'Trái-Trên', d: 'Hotline', w: 200, y: 0, ax: 'left', ay: 'top' },
        { id: 'ctr', t: 'Phải-Trên', d: 'Zalo', w: 200, y: 0, ax: 'right', ay: 'top' },
        { id: 'cbl', t: 'Trái-Dưới', d: 'CSKH', w: 200, y: 0, ax: 'left', ay: 'bottom' },
        { id: 'cbr', t: 'Phải-Dưới', d: 'UY TÍN', w: 200, y: 0, ax: 'right', ay: 'bottom' },
        { id: 'pageNum', t: 'Số Trang', d: 'Trang {p}/{t}', w: 150, y: 0, ax: 'auto', ay: 'bottom' }
    ];
    let gTabs = '<button class="sub-tab-btn active" onclick="switchSubTab(\'sub-gt-chung\', this)">Bật/Tắt Cụm</button>';
    globHtml += `<div id="sub-gt-chung" class="sub-tab-content active"><div class="setting-box"><div class="setting-title">BẬT TẮT CHỮ GÓC</div><div class="setting-row"><div class="setting-inputs" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
    <label><input type="checkbox" id="use_header1" checked onchange="updateUI()">T.Đề 1</label>
    <label><input type="checkbox" id="use_header2" checked onchange="updateUI()">T.Đề 2</label>
    <label><input type="checkbox" id="use_ctl" checked onchange="updateUI()">Trái Trên</label>
    <label><input type="checkbox" id="use_ctr" checked onchange="updateUI()">Phải Trên</label>
    <label><input type="checkbox" id="use_footer1" checked onchange="updateUI()">C.Trang 1</label>
    <label><input type="checkbox" id="use_footer2" checked onchange="updateUI()">C.Trang 2</label>
    <label><input type="checkbox" id="use_cbl" checked onchange="updateUI()">Trái Dưới</label>
    <label><input type="checkbox" id="use_cbr" checked onchange="updateUI()">Phải Dưới</label>
    <label style="color:red;"><input type="checkbox" id="use_pageNum" checked onchange="updateUI()">Số Trang</label>
</div></div></div></div>`;
    gT.forEach(g => {
        gTabs += `<button class="sub-tab-btn" onclick="switchSubTab('sub-${g.id}', this)">${g.t}</button>`;
        globHtml += generateHeaderTab(g.id, g.d, 0, g.w, g.y, g.ax, g.ay);
    });
    globHtml += `</div></div>`;

    let genHtml = `
<div id="tab-general" class="tab-content">
<div class="sub-tabs" style="margin-bottom: 10px;">
<button class="sub-tab-btn active" onclick="switchSubTab('sub-general-bg', this)">🌄 Khổ Giấy & Nền</button>
<button class="sub-tab-btn" onclick="switchSubTab('sub-general-margin', this)">📏 Lề & Gáy</button>
<button class="sub-tab-btn" onclick="switchSubTab('sub-general-export', this)">📦 Xuất File</button>
</div>

<div id="sub-general-bg" class="sub-tab-content active">
<div class="setting-box">
    <div class="setting-title" style="background:#8e44ad;">🌄 KHỔ GIẤY & NỀN TỔNG</div>
    
    <div class="setting-row" style="background:#f4f9ff; align-items: flex-start; padding-top: 10px;">
        <label>Khổ Giấy</label>
        <div class="setting-inputs" style="flex-wrap: wrap; gap: 8px;">
            <select id="canvasSizeMode" onchange="
                let wrap = document.getElementById('customCanvasSizeWrapper');
                let pre = document.getElementById('fixedSizePreset');
                let hBox = document.getElementById('wrapCustomH');
                let wLbl = document.getElementById('lblCustomW');
                if(this.value === 'fixed') {
                    wrap.style.display='flex'; pre.style.display='block'; hBox.style.display='flex'; wLbl.innerText='W:';
                } else if(this.value === 'ratio') {
                    wrap.style.display='flex'; pre.style.display='none'; hBox.style.display='none'; wLbl.innerText='Cạnh ngang (px):';
                } else {
                    wrap.style.display='none';
                }
                if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();
            " style="width: 100%; font-weight: bold; color: var(--primary);">
                <option value="auto" selected>✨ Tự động (Theo Lưới SIM)</option>
                <option value="fixed">🔒 Khóa cứng (Tùy chỉnh Size)</option>
                <option value="ratio">🖼️ Chạy theo tỷ lệ Ảnh Nền</option>
            </select>
            
            <div id="customCanvasSizeWrapper" style="display: none; width: 100%; gap: 10px; margin-top: 5px; flex-direction: column; align-items: flex-start; background: #fff; padding: 8px; border-radius: 6px; border: 1px dashed #ccc;">
                <select id="fixedSizePreset" style="width:100%; font-size:12px; padding: 6px; border-radius: 4px; border: 1px solid #ccc; outline: none;" onchange="if(this.value){ let sz=this.value.split('x'); document.getElementById('customCanvasW').value=sz[0]; document.getElementById('customCanvasH').value=sz[1]; if(typeof updatePreviewImmediate==='function') updatePreviewImmediate(); }">
                    <option value="">-- Tự nhập tay --</option>
                    <option value="1080x1920">📱 Story (1080x1920)</option>
                    <option value="1080x1080">🟦 Vuông (1080x1080)</option>
                    <option value="826x1169">📄 A4 Dọc (In ấn)</option>
                    <option value="1169x826">📄 A4 Ngang (In ấn)</option>
                </select>
                <div style="display: flex; gap: 10px; align-items: center; width: 100%; margin-top:5px;">
                    <div style="display:flex; align-items:center; gap:5px;"><span id="lblCustomW">W:</span><input type="number" id="customCanvasW" value="1080" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();" style="width: 70px;"></div>
                    <div id="wrapCustomH" style="display:flex; align-items:center; gap:5px;"><span>H:</span><input type="number" id="customCanvasH" value="1920" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();" style="width: 70px;"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="setting-row">
        <label>Loại Nền</label>
        <div class="setting-inputs">
            <select id="bgMode" onchange="document.getElementById('bgSolidGrp').style.display = (this.value === 'solid' ? 'flex' : 'none'); document.getElementById('bgGradGrp').style.display = (this.value === 'gradient' ? 'flex' : 'none'); document.getElementById('bgImgGrp').style.display = (this.value === 'image' ? 'flex' : 'none'); if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();">
                <option value="solid">Màu trơn</option>
                <option value="gradient" selected>Chuyển màu</option> 
                <option value="image">Ảnh Nền</option>
            </select>
        </div>
    </div>

    <div class="setting-row" id="bgSolidGrp" style="display:none;"><label>Màu trơn</label><div class="setting-inputs"><input type="color" id="bgColor" value="#000000" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"></div></div>
    <div class="setting-row" id="bgGradGrp"><label>Màu 1 ➔ 2</label><div class="setting-inputs"><input type="color" id="bgGradient1" value="#ffffff" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><span>➔</span><input type="color" id="bgGradient2" value="#006680" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><span>Góc:</span><input type="number" id="bgGradAngle" value="0" style="width:45px;" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"></div></div>
    
    <div class="setting-row" id="bgImgGrp" style="display:none; align-items: flex-start;">
        <label style="margin-top: 8px;">Úp Ảnh Nền</label>
        <div class="setting-inputs" style="flex-direction: column; align-items: flex-start; width: 100%; gap: 8px;">
            <select id="bgFitMode" style="width: 100%; padding: 6px; font-weight: bold; border: 2px solid #f1c40f; border-radius: 4px; outline: none;" onchange="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();">
                <option value="cover">✂️ Cắt xén lấp đầy (Cover)</option>
                <option value="stretch" selected>↔️ Kéo giãn (Stretch)</option>
                <option value="contain">🖼️ Vừa vặn (Có lót màu)</option>
            </select>
            <div style="display:flex; gap:5px; width:100%;">
                <input type="file" id="bgInput" accept="image/*" class="mini" style="flex:1;" onchange="if(typeof setLocalImage==='function') setLocalImage(this, 'globalBgImage', 'mainBgStatus');">
                <button type="button" onclick="document.getElementById('bgInput').value=''; document.getElementById('mainBgStatus').innerHTML='☁️ Đang dùng ảnh Mây'; if(typeof openBgCloudModal==='function') openBgCloudModal('global', 'mainBgStatus');" class="btn-mini" style="background:var(--success); color:white; border:none; padding:0 10px; border-radius:4px;">☁️ MÂY</button>
                <button type="button" onclick="if(typeof removeImage==='function') removeImage('globalBgImage', 'bgInput', 'mainBgStatus');" class="btn-remove">✕</button>
            </div>
            <div id="mainBgStatus" class="status-info">❌ Chưa có ảnh</div>
            <input type="text" id="bgDriveLink" placeholder="Dán Link Drive..." style="width:100%; padding:6px; border-radius: 4px;" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();">
        </div>
    </div>
</div>
</div>

<div id="sub-general-margin" class="sub-tab-content"><div class="setting-box"><div class="setting-title" style="background:#8e44ad;">📏 CĂN LỀ & ĐÓNG GÁY</div><div class="setting-row"><label>Lề Dọc</label><div class="setting-inputs"><span>Trán:</span><input type="number" id="tZoneH" value="100" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><span>Chân:</span><input type="number" id="fZoneH" value="80" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"></div></div><div class="setting-row" style="background:#fff4f4;"><label style="color:var(--danger)">Đóng gáy in</label><div class="setting-inputs"><select id="bindingMode" class="flex-1" onchange="document.getElementById('grpMarginNormal').style.display = (this.value === 'none' ? 'flex' : 'none'); document.getElementById('grpMarginBinding').style.display = (this.value === 'none' ? 'none' : 'flex'); if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><option value="none">1. Không đóng gáy</option><option value="single">2. Đóng gáy 1 mặt</option><option value="double">3. Đóng gáy 2 mặt (Lẻ/Chẵn)</option></select></div></div><div class="setting-row" id="grpMarginNormal"><label>Lề Ngang</label><div class="setting-inputs"><span>Trái:</span><input type="number" id="mLeft" value="30" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><span>Phải:</span><input type="number" id="mRight" value="30" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"></div></div><div class="setting-row" id="grpMarginBinding" style="display:none; background:#fff4f4;"><label style="color:var(--danger)">Lề Đóng Gáy</label><div class="setting-inputs"><span>Gáy:</span><input type="number" id="marginBinding" value="80" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><span>Lề:</span><input type="number" id="marginNonBinding" value="30" class="mini" oninput="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"></div></div></div></div>
<div id="sub-general-export" class="sub-tab-content">
<div class="setting-box"><div class="setting-title" style="background:#27ae60;">📦 CHẤT LƯỢNG XUẤT FILE PRO</div>
<div class="setting-row"><label>Độ nét</label><div class="setting-inputs"><select id="exportScale" class="flex-1" onchange="if(typeof updatePreviewImmediate==='function') updatePreviewImmediate();"><option value="1">1x (Web)</option><option value="2" selected>2x (HD)</option><option value="3">3x (In Ấn)</option><option value="4">4x (Ultra Pro)</option></select></div></div>
<div class="setting-row"><label>Watermark</label><div class="setting-inputs"><label><input type="checkbox" id="useWatermark" onchange="drawCanvas()"> Bật chữ ký</label><input type="text" id="watermarkText" value="VIP SIM TOOL" placeholder="Nội dung..." oninput="drawCanvas()"></div></div>
<div class="setting-row"><label>Định dạng</label><div class="setting-inputs"><select id="exportFormat" class="flex-1"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></div></div></div>
</div>
</div>`;
    container.innerHTML = layoutHtml + headHtml + globHtml + genHtml;
    
    // Sau khi đã gán innerHTML thì mới lấy được các thẻ con bên trong
    const gTabsContainer = document.getElementById('globalTextTabs');
    if (gTabsContainer) gTabsContainer.innerHTML = gTabs;
};

function startApp() {
    try {
        console.log("Starting App Initialization...");
        // 1. Phải chạy initDynamicUI đầu tiên để tạo các thẻ DOM
        if (typeof window.initDynamicUI === 'function') {
            window.initDynamicUI();
        }
    } catch (e) { console.error("Error in initDynamicUI:", e); }

    try {
        // 2. Khởi tạo các thành phần giao diện khác
        if (typeof window.initFontSelectors === 'function') window.initFontSelectors();
        if (typeof window.initModalPointerEvents === 'function') window.initModalPointerEvents();
    } catch (e) { console.error("Error in UI initialization:", e); }

    try {
        // 3. Thiếp lập Uploaders (từ script.js)
        let prefixes = ['num', 'price', 'menh', 'mang', 'data1', 'data2', 'hNum', 'hPrice', 'hMenh', 'hMang', 'hData1', 'hData2', 'header1', 'header2', 'footer1', 'footer2', 'ctl', 'ctr', 'cbl', 'cbr', 'pageNum', 'cell'];
        prefixes.forEach(p => {
            if (typeof window.setupAdvancedUploader === 'function') {
                window.setupAdvancedUploader(p + 'ColorInput', p + 'ColorImage');
                window.setupAdvancedUploader(p + 'BgInput', p + 'BgImage');
                window.setupAdvancedUploader(p + 'BorderInput', p + 'BorderImage');
            }
        });
        if (typeof window.setupAdvancedUploader === 'function') window.setupAdvancedUploader('bgInput', 'bgImage');
    } catch (e) { console.error("Error in Uploaders:", e); }

    try {
        // 4. Cập nhật UI ban đầu
        if (typeof window.updateUI === 'function') window.updateUI();

        // 5. Gắn sự kiện cho các Input
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', () => {
                if (typeof window.drawCanvas === 'function') window.drawCanvas();
                if (typeof window.debouncedSave === 'function') window.debouncedSave();
            });
            if (el.tagName === 'SELECT' || el.type === 'checkbox') el.addEventListener('change', () => {
                if (typeof window.updateUI === 'function') window.updateUI();
                if (typeof window.drawCanvas === 'function') window.drawCanvas();
                if (typeof window.debouncedSave === 'function') window.debouncedSave();
            });
        });
    } catch (e) { console.error("Error in Inputs/Events:", e); }

    try {
        // 6. Security & DRM
        console.log("Checking DRM & License...");
        if (typeof window.checkLicense === 'function') window.checkLicense();
        if (typeof window.setupDrag === 'function') window.setupDrag('unifiedMenuContainer', 'unifiedMenuBtn');
    } catch (e) { console.error("Error in DRM/Security:", e); }

    try {
        // 7. Khôi phục phiên làm việc
        if (typeof initStartupLogic === 'function') initStartupLogic();
    } catch (e) { console.error("Error in Startup Logic:", e); }
}

// --- PALETTE SYSTEM ---
window.populatePalettes = function() {
    const container = document.getElementById('paletteContainer');
    if (!container) return;
    container.innerHTML = '';
    
    // Professional Gradient Palettes
    const palettes = [
        ['#FF5733', '#C70039'], ['#900C3F', '#581845'], ['#581845', '#900C3F'],
        ['#2c3e50', '#2980b9'], ['#1e3c72', '#2a5298'], ['#000428', '#004e92'],
        ['#7f00ff', '#e100ff'], ['#d4145a', '#fbb03b'], ['#662d8c', '#ed1e79'],
        ['#009245', '#fcee21'], ['#00dbde', '#fc00ff'], ['#f83600', '#f9d423'],
        ['#09203f', '#537895'], ['#b721ff', '#21d4fd'], ['#ee0979', '#ff6a00'],
        ['#11998e', '#38ef7d'], ['#3a1c71', '#d76d77'], ['#8e2de2', '#4a00e0']
    ];

    palettes.forEach(p => {
        const item = document.createElement('div');
        item.style.width = '100%';
        item.style.height = '40px';
        item.style.borderRadius = '8px';
        item.style.background = `linear-gradient(to right, ${p[0]}, ${p[1]})`;
        item.style.cursor = 'pointer';
        item.style.border = '2px solid #eee';
        item.style.transition = '0.2s';
        item.onmouseover = () => item.style.transform = 'scale(1.05)';
        item.onmouseout = () => item.style.transform = 'scale(1)';
        item.onclick = () => window.applyPalette(p[0], p[1]);
        container.appendChild(item);
    });
};

window.applyPalette = function(c1, c2) {
    const g1 = document.getElementById('bgGradient1');
    const g2 = document.getElementById('bgGradient2');
    if (g1 && g2) {
        g1.value = c1;
        g2.value = c2;
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate();
        window.togglePalette(false);
    }
};

// --- HẾT PHẦN BỔ SUNG ---

window.toggleFullscreen = function() {
    let col = document.getElementById('previewColumn'); 
    let btn = document.getElementById('toggleFullBtn');
    if(!col) return;
    
    let isMobile = window.innerWidth <= 768;
    
    // Ngăn chặn việc click quá nhanh gây lỗi chuyển đổi
    if (window.lastToggle && (Date.now() - window.lastToggle < 500)) return;
    window.lastToggle = Date.now();

    if (isMobile) {
        document.body.classList.toggle('studio-mode');
        window.isFullscreen = document.body.classList.contains('studio-mode');
        if (window.isFullscreen) {
            if (btn) btn.innerHTML = '↙ THU NHỎ';
            if (typeof window.openMobileModal === 'function') window.openMobileModal('layout');
        } else {
            if (btn) btn.innerHTML = '🔲 TOÀN MÀN HÌNH';
            if (typeof window.closeMobileModal === 'function') window.closeMobileModal();
        }
    } else {
        col.classList.toggle('fullscreen');
        window.isFullscreen = col.classList.contains('fullscreen');
        if (window.isFullscreen) { 
            if (btn) btn.innerHTML = '↙ THU NHỎ'; 
        } else { 
            if (btn) btn.innerHTML = '🔲 TOÀN MÀN HÌNH'; 
            if (typeof window.closeMobileModal === 'function') window.closeMobileModal(); 
        }
    }
    
    // Đảm bảo cập nhật lại khung nhìn sau khi thay đổi layout
    if (typeof window.fitZoom === 'function') {
        setTimeout(window.fitZoom, 100);
        setTimeout(window.fitZoom, 400); // Thêm một lần nữa sau khi hiệu ứng CSS hoàn tất
    }
};


window.updatePagination = function() {
    let r = parseInt(document.getElementById('tableRows')?.value) || 10;
    let c = parseInt(document.getElementById('tableCols')?.value) || 2;
    let listLen = 0; if(typeof window.parseList === 'function') listLen = window.parseList().length;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    if(window.currentStep >= tot) window.currentStep = Math.max(0, tot - 1);
    let pInp = document.getElementById('pageInput'); if(pInp) pInp.value = window.currentStep + 1;
    let tTxt = document.getElementById('totalPagesText'); if(tTxt) tTxt.innerText = tot;
};

window.prevStep = function() { if(window.currentStep > 0) { window.currentStep--; if(typeof window.drawCanvas === 'function') window.drawCanvas(); } };
window.nextStep = function() {
    let r = parseInt(document.getElementById('tableRows')?.value) || 10; let c = parseInt(document.getElementById('tableCols')?.value) || 2;
    let listLen = 0; if(typeof window.parseList === 'function') listLen = window.parseList().length;
    let tot = Math.max(1, Math.ceil(listLen / (r * c)));
    if(window.currentStep < tot - 1) { window.currentStep++; if(typeof window.drawCanvas === 'function') window.drawCanvas(); }
};


window.applyAIColor = function(prefix) {
    const list = typeof window.parseList === 'function' ? window.parseList() : [];
    let designMenh = 'KIM';
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
    let colorEl = document.getElementById(prefix + 'Color');
    let grad1 = document.getElementById(prefix + 'ColorGradient1');
    let grad2 = document.getElementById(prefix + 'ColorGradient2');
    if (colorEl) colorEl.value = p.main;
    if (grad1) grad1.value = p.main;
    if (grad2) grad2.value = p.grad;
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
    if (typeof window.isAuthorized === 'function' && !window.isAuthorized()) {
        alert("⚠ PHẦN MỀM CHƯA KÍCH HOẠT!\nVui lòng nhập mã bản quyền để sử dụng tính năng này.");
        return;
    }
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
            orientation: 'p', unit: 'px',
            format: [canvas.width / getVal('exportScale', 1), canvas.height / getVal('exportScale', 1)]
        });
        for (let i = 0; i < totalPages; i++) {
            if (lText) lText.innerText = `Đang xử lý trang ${i + 1}/${totalPages}`;
            window.currentStep = i;
            await new Promise(resolve => { window.drawCanvas(); setTimeout(resolve, 300); });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        }
        pdf.save(`VIP_SIM_CATALOG_${new Date().getTime()}.pdf`);
        window.currentStep = oldStep; window.drawCanvas();
    } catch (err) { console.error(err); alert("❌ Lỗi khi xuất PDF!"); }
    finally { if (loading) loading.style.display = 'none'; }
};

window.setupDrag = function(elementId, handleId) {
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
        initX = rect.left; initY = rect.top; 
        el.style.left = initX + 'px'; el.style.top = initY + 'px';
        el.style.bottom = 'auto'; el.style.right = 'auto'; el.style.margin = '0'; el.style.transform = 'none'; 
    };
    const move = (e) => { 
        if(!isDragging) return; 
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX; 
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY; 
        let dx = clientX - startX; let dy = clientY - startY; 
        if(Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true; 
        if(moved) { 
            e.preventDefault(); 
            let maxX = window.innerWidth - el.offsetWidth; 
            let maxY = window.innerHeight - el.offsetHeight; 
            let newX = Math.max(0, Math.min(initX + dx, maxX));
            let newY = Math.max(0, Math.min(initY + dy, maxY));
            el.style.left = newX + 'px'; el.style.top = newY + 'px'; 
        } 
    };
    const end = () => { isDragging = false; };
    handle.addEventListener('mousedown', start); 
    handle.addEventListener('touchstart', start, {passive: false}); 
    window.addEventListener('mousemove', move, {passive: false}); 
    window.addEventListener('touchmove', move, {passive: false}); 
    window.addEventListener('mouseup', end); 
    window.addEventListener('touchend', end);
    return () => moved;
};

// --- BẢO MẬT & DRM ---
    function trap() {
        try {
            const t = function() {
                (function() {
                    (function a() {
                        try {
                            (function b(i) {
                                if (("" + i / i).length !== 1 || i % 20 === 0) {
                                    (function() {}).constructor("debugger")();
                                } else {
                                    debugger;
                                }
                                // Removed synchronous recursion b(++i) to prevent main thread freeze
                            })(0);
                        } catch (e) {
                            setTimeout(a, 1000);
                        }
                    })();
                })();
            };
            setInterval(t, 1000);
        } catch (e) {}
    }
    document.addEventListener('contextmenu', e => {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.id === 'displayMac') return;
        e.preventDefault();
    }, false);
    document.addEventListener('keydown', e => {
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) || 
            (e.ctrlKey && [85, 83, 80, 65, 70].includes(e.keyCode))) {
            e.preventDefault(); return false;
        }
    });

const STORAGE_ID_KEY = 'SYSTEM_LOG_DATA_CACHED';
const LICENSE_KEY = 'SYSTEM_LICENSE_ACTIVE';
const POS = [2, 5, 9, 14, 20, 27, 35, 44, 54, 59];
window.getDeviceID = function() { try { let secret = localStorage.getItem(STORAGE_ID_KEY); if (!secret || secret.length < 60) { let charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let rawID = ""; for(let i=0; i<10; i++) rawID += charset.charAt(Math.floor(Math.random() * charset.length)); let junk = ""; for(let i=0; i<60; i++) junk += charset.charAt(Math.floor(Math.random() * charset.length)); let complexArr = junk.split(""); for(let i=0; i<10; i++) { complexArr[POS[i]] = rawID[i]; } secret = complexArr.join(""); localStorage.setItem(STORAGE_ID_KEY, secret); return rawID; } let realID = ""; for(let p of POS) { realID += secret[p]; } return realID; } catch (e) { return "ERROR_ID"; } };
window.verifyLicense = function(keyStr) { if(!keyStr) return false; try { let myMac = window.getDeviceID(); let decoded = decodeURIComponent(atob(keyStr.split('').reverse().join(''))); let rawData = ""; for(let i=0; i<decoded.length; i++) { rawData += String.fromCharCode(decoded.charCodeAt(i) - 7); } let parts = rawData.split('|||'); if(parts.length !== 2) return false; let keyMac = parts[0]; let expTime = parseInt(parts[1]); if(keyMac === myMac && expTime > Date.now()) { return true; } return false; } catch(e) { return false; } };
window.checkLicense = function() { 
    try {
        let savedKey = localStorage.getItem(LICENSE_KEY); 
        let overlay = document.getElementById('drmOverlay'); 
        let macDisplay = document.getElementById('displayMac'); 
        let myID = window.getDeviceID();
        
        console.log("DRM System: Generated ID is", myID);
        
        if (macDisplay) {
            macDisplay.innerText = myID;
            // Retry once after 1s just in case of DOM lag
            if (macDisplay.innerText.includes("ĐANG")) {
                setTimeout(() => { macDisplay.innerText = myID; }, 1000);
            }
        }
        
        if (savedKey && window.verifyLicense(savedKey)) { 
            if (overlay) overlay.style.display = 'none'; 
            console.log("DRM System: License Valid.");
        } else { 
            if (overlay) overlay.style.display = 'flex'; 
            console.log("DRM System: License Required.");
        } 
    } catch (e) {
        console.error("DRM System Error:", e);
    }
};
window.activateLicense = function() { let keyInput = document.getElementById('licenseKeyInput').value.trim(); let msg = document.getElementById('drmMessage'); if(!keyInput) { msg.innerText = "Vui lòng nhập mã kích hoạt!"; return; } if(window.verifyLicense(keyInput)) { localStorage.setItem(LICENSE_KEY, keyInput); msg.style.color = "#2ecc71"; msg.innerText = "Kích hoạt thành công! Đang tải lại phần mềm..."; setTimeout(() => { document.getElementById('drmOverlay').style.display='none'; if(typeof window.fitZoom === 'function') window.fitZoom(); }, 1000); } else { msg.style.color = "#e74c3c"; msg.innerText = "Mã kích hoạt sai hoặc đã hết hạn!"; } };
window.copyMac = function() { let mac = document.getElementById('displayMac').innerText; let tempInput = document.createElement("input"); tempInput.value = mac; document.body.appendChild(tempInput); tempInput.select(); tempInput.setSelectionRange(0, 99999); try { document.execCommand("copy"); alert("✅ Đã copy Mã Máy thành công: " + mac); } catch (err) { alert("❌ Vui lòng copy thủ công!"); } document.body.removeChild(tempInput); };
window.isAuthorized = function() { try { let savedKey = localStorage.getItem(LICENSE_KEY); return !!(savedKey && window.verifyLicense(savedKey)); } catch(e) { return false; } };
window.toggleCanvasSizeInputs = function() {
    let mode = document.getElementById('canvasSizeMode')?.value;
    let wrapper = document.getElementById('customCanvasSizeWrapper');
    if(!wrapper) return;
    wrapper.style.display = mode === 'auto' ? 'none' : 'flex';
    let cH = document.getElementById('customCanvasH'); let lH = document.getElementById('labelCustomH');
    if(cH) cH.style.display = mode === 'ratio' ? 'none' : 'block';
    if(lH) lH.style.display = mode === 'ratio' ? 'none' : 'block';
};

// --- ENTRY POINT ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    setTimeout(startApp, 500); // Tăng delay lên 500ms để đảm bảo ổn định
}
