// ============================================================================
// MAIN.JS - BẢN FULL V23 (FIX LỖI MẤT TIÊU ĐỀ VÀ DỮ LIỆU)
// ============================================================================
const canvas = document.getElementById('preview'); 
const ctx = canvas ? canvas.getContext('2d') : null;
const wrapper = document.getElementById('canvasWrapper');

// --- 1. BIẾN TRẠNG THÁI ---
let hitBoxes = []; window.isExporting = false; window.currentStep = 0;
let currentZoom = 100; let isAutoFit = true;
let isPanning = false, startX, startY, panStartX, panStartY, scrollLeft, scrollTop;
let isDragging = false, dragTarget = null, dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
let hoveredIndex = -1, isDragMoved = false, isFullscreen = false;
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

// --- 2. HÀM TIỆN ÍCH CƠ BẢN ---
function getVal(id, def=0) { let el = document.getElementById(id); return el ? (isNaN(parseFloat(el.value)) ? el.value : parseFloat(el.value)) : def; }
function isChecked(id) { let el = document.getElementById(id); return el ? el.checked : false; }
window.getPos = function(base, cellTotal, objSize, align, offset) { 
    if (align === 'center' || align === 'middle') return base + (cellTotal - objSize) / 2 + offset; 
    if (align === 'right' || align === 'bottom') return base + cellTotal - objSize + offset; 
    return base + offset; 
}

// --- 3. DATA NHÀ MẠNG, PHONG THỦY & BẢN ĐỒ ÁNH XẠ CHECKBOX ---
const NETWORK_INFO = { 
    'VT': { short1: 'Viettel', short2: 'VIETTEL', color: '#ee0033' }, 
    'VN': { short1: 'Vinaphone', short2: 'VINA', color: '#0066cc' }, 
    'MB': { short1: 'Mobifone', short2: 'MOBI', color: '#0055a6' }, 
    'VNM': { short1: 'Vietnamobile', short2: 'VNMB', color: '#ff6600'}, 
    'GM': { short1: 'Gmobile', short2: 'GMOB', color: '#d3a800' } 
};
const PREFIX_TO_NETWORK = { '32':'VT','33':'VT','34':'VT','35':'VT','36':'VT','37':'VT','38':'VT','39':'VT','86':'VT','96':'VT','97':'VT','98':'VT','81':'VN','82':'VN','83':'VN','84':'VN','85':'VN','88':'VN','91':'VN','94':'VN','70':'MB','76':'MB','77':'MB','78':'MB','79':'MB','89':'MB','90':'MB','93':'MB','56':'VNM','58':'VNM','92':'VNM','59':'GM','99':'GM' };
const menhColors={'THỦY':'#0066ff','THỔ':'#8b4513','MỘC':'#0a8f0a','KIM':'#ff9900','HỎA':'#ff0000'}; 

// 🎯 V24: FIX BUG - Đã sửa chkSo→chkNum, chkGia→chkPrice cho đúng ID trong HTML
window.colCheckMap = {
    'num': 'chkNum', 'hNum': 'chkNum',
    'price': 'chkPrice', 'hPrice': 'chkPrice',
    'menh': 'chkMenh', 'hMenh': 'chkMenh',
    'mang': 'chkMang', 'hMang': 'chkMang',
    'data1': 'chkData1', 'hData1': 'chkData1',
    'data2': 'chkData2', 'hData2': 'chkData2'
};

function getNetworkKey(simNumber) {
    if(!simNumber) return null; let cleanSim = simNumber.replace(/\D/g, ''); 
    if(cleanSim.startsWith('84')) cleanSim = '0' + cleanSim.substring(2); 
    if(cleanSim.length < 9) return null; return PREFIX_TO_NETWORK[cleanSim.substring(1, 3)] || null;
}
function getNetworkData(simNumber) { 
    let key = getNetworkKey(simNumber);
    return key ? NETWORK_INFO[key] : null; 
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
window.drawProElement = function(ctx, prefix, text, cx, cy, w, h, radius, angle, isCellGrid = false, autoBgColor = null) {
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
            const _objNames = {
                num:'SỐ', price:'GIÁ', menh:'MỆNH', mang:'MẠNG', data1:'DỮ LIỆU 1', data2:'DỮ LIỆU 2',
                hNum:'T.ĐỀ SỐ', hPrice:'T.ĐỀ GIÁ', hMenh:'T.ĐỀ MỆNH', hMang:'T.ĐỀ MẠNG', hData1:'T.ĐỀ DỮ LIỆU 1', hData2:'T.ĐỀ DỮ LIỆU 2',
                header1:'Đầu Trang 1', header2:'Đầu Trang 2', footer1:'Chân Trang 1', footer2:'Chân Trang 2',
                ctl:'Trái Trên', ctr:'Phải Trên', cbl:'Trái Dưới', cbr:'Phải Dưới', pageNum:'Số Trang'
            };
            let dName = _objNames[prefix] || prefix.toUpperCase();

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
    if(!ctx) return; 
    hitBoxes = []; 
    let list = typeof window.parseList === 'function' ? window.parseList() : []; 
    
    let tCols = window.getVal('tableCols', 2), tRows = window.getVal('tableRows', 10), cW = window.getVal('cellW', 380), cH = window.getVal('cellH', 60);
    let gapX = window.getVal('tableGap', 15), gapY = window.getVal('rowGap', 10), mLeft = window.getVal('mLeft', 30), mRight = window.getVal('mRight', 30), tZoneH = window.getVal('tZoneH', 100), fZoneH = window.getVal('fZoneH', 80);
    
    let chkHead = document.getElementById('showHeaderRow');
    let hasHead = chkHead ? chkHead.checked : false; 
    let headH = hasHead ? window.getVal('headerRowHeight', 50) : 0, headGap = hasHead ? gapY : 0;
    
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
        let autoW = mLeft + mRight + (tCols * cW) + (Math.max(0, tCols - 1) * gapX);
        let autoH = tZoneH + fZoneH + headH + headGap + (tRows * cH) + (Math.max(0, tRows - 1) * gapY);
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

    let tStartX = (cw - (tCols * cW + Math.max(0, tCols - 1) * gapX)) / 2; 
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
            
            window.drawProElement(ctx, 'cell', ' ', cx, cy, cW, cH, window.getVal('cellRadius'), 0, true);

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
                         if (p === 'menh') autoColor = menhColors[rawMenh] || null; // Dùng rawMenh để lấy màu
                         if (p === 'mang') autoColor = netData ? netData.color : null;
                         
                         window.drawProElement(ctx, p, vList[idx], px, py, w, h, window.getVal(p+'Radius'), window.getVal(p+'Angle'), false, autoColor);
                     } else {
                         window.drawProElement(ctx, p, ' ', px, py, w, h, window.getVal(p+'Radius'), window.getVal(p+'Angle'), true);
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
            let w = window.getVal(g+'W', 200), h = window.getVal(g+'H', 40), ax = document.getElementById(g+'AlignX')?.value || 'center', ay = document.getElementById(g+'AlignY')?.value || 'top';
            let gx = (ax==='left') ? mLeft+w/2 : (ax==='right' ? cw-mRight-w/2 : cw/2);
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

function updateZoomUI() {
    if (!canvas || !canvas.width || !wrapper) return;
    if (isAutoFit) {
        let z = Math.min((wrapper.clientWidth - 40) / (canvas.width/getVal('exportScale',1)), (wrapper.clientHeight - 40) / (canvas.height/getVal('exportScale',1))) * 100;
        currentZoom = Math.floor(z < 10 ? 10 : (z > 400 ? 400 : z));
    }
    if (document.getElementById('zoomSlider')) document.getElementById('zoomSlider').value = currentZoom;
    canvas.style.width = Math.floor((canvas.width/getVal('exportScale',1)) * currentZoom / 100) + 'px'; canvas.style.height = 'auto';
}
function fitZoom() { isAutoFit = true; updateZoomUI(); wrapper.scrollTop = 0; wrapper.scrollLeft = (canvas.offsetWidth - wrapper.clientWidth) / 2; }
function applyZoom(val) { currentZoom = parseInt(val); isAutoFit = false; updateZoomUI(); }

if(wrapper) {
    wrapper.addEventListener('mousedown', (e) => { 
        if (typeof isDragging !== 'undefined' && isDragging) return; 
        isPanning = true; 
        panStartX = e.pageX - wrapper.offsetLeft; 
        panStartY = e.pageY - wrapper.offsetTop; 
        scrollLeft = wrapper.scrollLeft; 
        scrollTop = wrapper.scrollTop; 
    });
    wrapper.addEventListener('mouseleave', () => { isPanning = false; hoveredIndex = -1; if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); });
    canvas.addEventListener('mouseleave', () => { hoveredIndex = -1; if(typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); });
    wrapper.addEventListener('mouseup', () => { isPanning = false; });
    wrapper.addEventListener('mousemove', (e) => { 
        if (!isPanning) return; 
        e.preventDefault(); 
        wrapper.scrollLeft = scrollLeft - (e.pageX - wrapper.offsetLeft - panStartX) * 1.5; 
        wrapper.scrollTop = scrollTop - (e.pageY - wrapper.offsetTop - panStartY) * 1.5; 
    });
}

function getPointerPos(canvas, clientX, clientY) {
    var rect = canvas.getBoundingClientRect(); let expScale = parseFloat(document.getElementById('exportScale')?.value) || 1;
    return { x: (clientX - rect.left) * ((canvas.width / expScale) / rect.width), y: (clientY - rect.top) * ((canvas.height / expScale) / rect.height) };
}

let pendingTarget = null;
function handleInteractStart(clientX, clientY) {
    isPanning = true; 
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
            let lockCheck = document.getElementById(box.id + 'Locked'); let isLocked = lockCheck && lockCheck.checked;
            pendingTarget = { ...box, isLocked };
            
            // Khởi tạo Long-press (Nhấn giữ 500ms để bắt đầu kéo)
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
                }
            }, 500); 

            return true; 
        }
    }
    return false;
}

function handleInteractMove(clientX, clientY) {
    let dx = clientX - startX; let dy = clientY - startY;
    
    // Nếu di chuyển quá 20px thì coi là đã thực sự có di chuyển (Hủy Long-press nếu chưa bắt đầu kéo)
    if (isPanning && (Math.abs(dx) > 20 || Math.abs(dy) > 20)) {
        if (!isLongPress) {
            isDragMoved = true;
            clearTimeout(longPressTimeout);
        }
    }

    if (isDragging && dragTarget && isLongPress) {
        // --- CHẾ ĐỘ KÉO ĐỐI TƯỢNG (Sau khi Long-press) ---
        isDragMoved = true; // Đánh dấu đã di chuyển để handleInteractEnd lưu lại
        let pos = getPointerPos(canvas, clientX, clientY); 
        let dX_obj = pos.x - dragStartX; let dY_obj = pos.y - dragStartY;
        
        let nx = dragStartOffsetX + dX_obj, ny = dragStartOffsetY + dY_obj;
        let inputXEl = document.getElementById(dragTarget.inputX), inputYEl = document.getElementById(dragTarget.inputY);
        if (inputXEl) inputXEl.value = Math.round(nx);
        if (inputYEl) inputYEl.value = Math.round(ny);
        
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
    } else if (isDragMoved && wrapper) {
        // --- CHẾ ĐỘ KÉO MÀN HÌNH (PAN) ---
        wrapper.scrollLeft = scrollLeft - dx;
        wrapper.scrollTop = scrollTop - dy;
    } else {
        // Hover hiệu ứng (Desktop)
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
    }
}

function handleInteractEnd() {
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
        // Click nhanh -> Mở modal
        window.isOpeningModal = true; 
        if (isFS || window.innerWidth <= 768) { 
            if (typeof window.openMobileModal === 'function') window.openMobileModal(targetRef.id); 
        } 
        else { if (typeof window.focusDesktopTab === 'function') window.focusDesktopTab(targetRef.id); }
        setTimeout(() => { window.isOpeningModal = false; }, 200);
    }

    isDragging = false; dragTarget = null; pendingTarget = null;
    isLongPress = false; isDragMoved = false; isPanning = false;
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
            handleInteractEnd(); 
            isPinching = false;
        } else if (e.touches.length === 1) {
            isPinching = false;
        }
    });

    canvas.addEventListener('mousedown', function(e) { 
        let handled = handleInteractStart(e.clientX, e.clientY); 
        if(handled) e.preventDefault();
    });
    window.addEventListener('mouseup', function(e) { handleInteractEnd(); });
}

window.closeMobileModal = function() {
    let modalEl = document.getElementById('mobileSettingModal'); if (modalEl) modalEl.style.display = 'none';
    document.querySelectorAll('.m-tab-lvl1').forEach(btn => btn.classList.remove('active'));
    if (window.activeMobileElement && window.placeholderNode && window.placeholderNode.parentNode) {
        window.placeholderNode.parentNode.insertBefore(window.activeMobileElement, window.placeholderNode);
        window.placeholderNode.parentNode.removeChild(window.placeholderNode);
    }
    window.activeMobileElement = null; window.placeholderNode = null;
    let activeTabBtn = document.querySelector('.tab-btn.active'); if(activeTabBtn) activeTabBtn.click();
    let activeSubTabBtn = document.querySelector('.tab-content.active .sub-tab-btn.active'); if(activeSubTabBtn) activeSubTabBtn.click();
};

window.currentUXCategory = '-format'; let isSyncingTab = false;
window.switchTab = function(tabId, btn) { 
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active')); 
    let target = document.getElementById(tabId); if(target) target.classList.add('active'); if(btn) btn.classList.add('active'); 
    syncTabUX(target); 
}
window.switchSubTab = function(tabId, btn) { 
    if (tabId.endsWith('-format') || tabId.endsWith('-pos') || tabId.endsWith('-bg')) window.currentUXCategory = tabId.substring(tabId.lastIndexOf('-'));
    let container = btn.closest('.tab-content'); 
    container.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active')); 
    container.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active')); 
    let target = document.getElementById(tabId); if(target) target.classList.add('active'); if(btn) btn.classList.add('active'); 
    syncTabUX(target); 
}
window.switchSubSubTab = function(tabId, btn) { 
    if (tabId.endsWith('-format') || tabId.endsWith('-pos') || tabId.endsWith('-bg')) window.currentUXCategory = tabId.substring(tabId.lastIndexOf('-'));
    let container = btn.closest('.sub-tab-content'); 
    container.querySelectorAll('.sub-sub-tab-content').forEach(el => el.classList.remove('active')); 
    container.querySelectorAll('.sub-sub-tab-btn').forEach(el => el.classList.remove('active')); 
    let target = document.getElementById(tabId); if(target) target.classList.add('active'); if(btn) btn.classList.add('active'); 
}
function syncTabUX(container) {
    if(isSyncingTab || !container || !window.currentUXCategory) return;
    isSyncingTab = true;
    let subBtn = container.querySelector(`.sub-tabs > .sub-tab-btn[onclick*="${window.currentUXCategory}'"]`);
    if(subBtn && !subBtn.classList.contains('active')) subBtn.click();
    let searchArea = container.querySelector('.sub-tab-content.active') || container;
    let subSubBtn = searchArea.querySelector(`.sub-sub-tabs > .sub-sub-tab-btn[onclick*="${window.currentUXCategory}'"]`);
    if(subSubBtn && !subSubBtn.classList.contains('active')) subSubBtn.click();
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
    window.isOpeningModal = true; setTimeout(() => { window.isOpeningModal = false; }, 100);

    let tabId = '', subTabId = '', mTitle = '';
    const _colIds2 = ['num','price','menh','mang','data1','data2']; const _headerIds2 = ['hNum','hPrice','hMenh','hMang','hData1','hData2']; const _globalTxtIds2 = ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum'];
    const _colNames = {num:'SỐ', price:'GIÁ', menh:'MỆNH', mang:'MẠNG', data1:'DL 1', data2:'DL 2'}; const _hNames = {hNum:'SỐ', hPrice:'GIÁ', hMenh:'MỆNH', hMang:'MẠNG', hData1:'DL 1', hData2:'DL 2'}; const _txtNames = {header1:'Tiêu Đề 1', header2:'Tiêu Đề 2', footer1:'Chân Trang 1', footer2:'Chân Trang 2', ctl:'Trái-Trên', ctr:'Phải-Trên', cbl:'Trái-Dưới', cbr:'Phải-Dưới', pageNum:'Số Trang'};

    if (tid === 'layout') { tabId = 'tab-layout'; mTitle = '📊 LƯỚI SIM'; }
    else if (tid === 'general') { tabId = 'tab-general'; subTabId = 'sub-general-bg'; mTitle = '🌄 NỀN TỔNG'; }
    else if (tid === 'header') { tabId = 'tab-colheader'; subTabId = 'sub-hCommon'; mTitle = '🏷️ TIÊU ĐỀ'; }
    else if (tid === 'globaltext') { tabId = 'tab-globaltext'; subTabId = 'sub-gt-chung'; mTitle = '📝 CHỮ GÓC'; }
    else if (_colIds2.includes(tid)) { tabId = 'tab-layout'; subTabId = 'sub-' + tid; mTitle = '⚙️ CỘT ' + (_colNames[tid] || tid.toUpperCase()); }
    else if (_headerIds2.includes(tid)) { tabId = 'tab-colheader'; subTabId = 'sub-' + tid; mTitle = '🏷️ TIÊU ĐỀ ' + (_hNames[tid] || tid.toUpperCase()); }
    else if (_globalTxtIds2.includes(tid)) { tabId = 'tab-globaltext'; subTabId = 'sub-' + tid; mTitle = '✏️ ' + (_txtNames[tid] || tid.toUpperCase()); }

    if (!tabId) return; let el = document.getElementById(tabId); if (!el) return;

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
    
    modalEl.style.display = 'flex';
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

document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        let modalOverlay = document.getElementById('mobileSettingModal');
        let modalContent = document.querySelector('.mobile-modal-content');
        if (modalOverlay) {
            modalOverlay.style.setProperty('pointer-events', 'none', 'important');
            modalOverlay.style.setProperty('background', 'transparent', 'important');
            modalOverlay.style.setProperty('backdrop-filter', 'none', 'important');
            modalOverlay.removeAttribute('onclick');
        }
        if (modalContent) { modalContent.style.setProperty('pointer-events', 'auto', 'important'); }
    }, 500);
});

window.copyCanvas = function() {
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