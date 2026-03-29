// ============================================================================
// MAIN.JS - BẢN FULL V21 (KIẾN TRÚC 5 LỚP ĐỘC LẬP CHUẨN UI/UX)
// ============================================================================
const canvas = document.getElementById('preview'); 
const ctx = canvas ? canvas.getContext('2d') : null;
const wrapper = document.getElementById('canvasWrapper');

// --- 1. BIẾN TRẠNG THÁI ---
let hitBoxes = []; let isExporting = false; let currentStep = 0;
let currentZoom = 100; let isAutoFit = true;
let isPanning = false, startX, startY, scrollLeft, scrollTop;
let isDragging = false, dragTarget = null, dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
let hoveredIndex = -1, isDragMoved = false, isFullscreen = false;

// --- 2. HÀM TIỆN ÍCH CƠ BẢN ---
function getVal(id, def=0) { let el = document.getElementById(id); return el ? (isNaN(parseFloat(el.value)) ? el.value : parseFloat(el.value)) : def; }
function isChecked(id) { let el = document.getElementById(id); return el ? el.checked : false; }
window.getPos = function(base, cellTotal, objSize, align, offset) { 
    if (align === 'center' || align === 'middle') return base + (cellTotal - objSize) / 2 + offset; 
    if (align === 'right' || align === 'bottom') return base + cellTotal - objSize + offset; 
    return base + offset; 
}

// --- 3. DATA NHÀ MẠNG & PHONG THỦY ---
const NETWORK_INFO = { 'VT': { short2: 'VIETTEL', color: '#ee0033' }, 'VN': { short2: 'VINA', color: '#0066cc' }, 'MB': { short2: 'MOBI', color: '#0055a6' }, 'VNM': { short2: 'VNMB', color: '#ff6600'}, 'GM': { short2: 'GMOB', color: '#d3a800' } };
const PREFIX_TO_NETWORK = { '32':'VT','33':'VT','34':'VT','35':'VT','36':'VT','37':'VT','38':'VT','39':'VT','86':'VT','96':'VT','97':'VT','98':'VT','81':'VN','82':'VN','83':'VN','84':'VN','85':'VN','88':'VN','91':'VN','94':'VN','70':'MB','76':'MB','77':'MB','78':'MB','79':'MB','89':'MB','90':'MB','93':'MB','56':'VNM','58':'VNM','92':'VNM','59':'GM','99':'GM' };
const menhColors={'THỦY':'#0066ff','THỔ':'#8b4513','MỘC':'#0a8f0a','KIM':'#ff9900','HỎA':'#ff0000'}; 

function getNetworkData(simNumber) { 
    if(!simNumber) return null; let cleanSim = simNumber.replace(/\D/g, ''); 
    if(cleanSim.startsWith('84')) cleanSim = '0' + cleanSim.substring(2); 
    if(cleanSim.length < 9) return null; return NETWORK_INFO[PREFIX_TO_NETWORK[cleanSim.substring(1, 3)]] || null; 
}
function getMenhFromPhone(phone){
    let d=phone.replace(/\D/g,'').split('').map(Number); if(d.length===0)return''; 
    let s=d.reduce((a,b)=>a+b,0); while(s>=10)s=s.toString().split('').map(Number).reduce((a,b)=>a+b,0); 
    if(s===1)return'THỦY'; if([2,5,8].includes(s))return'THỔ'; if([3,4].includes(s))return'MỘC'; if([6,7].includes(s))return'KIM'; if(s===9)return'HỎA'; return'';
}
function formatPriceString(str) {
    if (!str || str.trim() === '' || !isChecked('showPrice')) return '';
    let mode = document.getElementById('priceFormatMode')?.value || 'raw'; let res = str; let v = parseFloat(str.toString().replace(/[.,\sđKk]/g, ''));
    if (!isNaN(v) && mode !== 'raw') {
        if (mode === 'auto') { if (v >= 1000000000) res = (v / 1000000000).toFixed(2) + " Tỷ"; else if (v >= 1000000) res = (v / 1000000).toFixed(1) + " Tr"; else if (v >= 1000) res = (v / 1000).toFixed(0) + " K"; else res = v.toLocaleString('vi-VN'); } 
        else if (mode === 'div1m') res = (v / 1000000).toFixed(2); else if (mode === 'div1k') res = (v / 1000).toFixed(0); else if (mode === 'comma') res = v.toLocaleString('vi-VN');
    }
    return (document.getElementById('pricePrefix')?.value || '') + res + (document.getElementById('priceSuffix')?.value || '');
}
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

// Hàm gom đường dẫn Hình Khối (Cho Lớp 3 - Khối Mệnh/Mạng)
window.buildShapePath = function(ctx, shape, w, h, radius, expand = 0) {
    let minR = Math.max(0, Math.min(w, h) / 2 + expand);
    if (shape === 'circle') { ctx.arc(0, 0, minR, 0, Math.PI * 2); } 
    else if (shape === 'diamond') { ctx.moveTo(0, -minR); ctx.lineTo(minR * 0.8, 0); ctx.lineTo(0, minR); ctx.lineTo(-minR * 0.8, 0); ctx.closePath(); } 
    else if (shape === 'teardrop') { ctx.moveTo(0, -minR); ctx.bezierCurveTo(minR, -minR, minR, minR*0.5, 0, minR); ctx.bezierCurveTo(-minR, minR*0.5, -minR, -minR, 0, -minR); ctx.closePath(); } 
    else if (shape === 'star') { let innerR = minR * 0.4, angle = Math.PI / 5; ctx.moveTo(0, -minR); for (let i = 0; i < 10; i++) { let r = (i % 2 == 0) ? minR : innerR; let a = i * angle - Math.PI / 2; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); } ctx.closePath(); } 
    else if (shape === 'pentagon') { let a = (Math.PI * 2) / 5, start = -Math.PI / 2; ctx.moveTo(minR * Math.cos(start), minR * Math.sin(start)); for (let i = 1; i <= 5; i++) ctx.lineTo(minR * Math.cos(start + i * a), minR * Math.sin(start + i * a)); ctx.closePath(); } 
    else if (shape === 'hexagon') { let a = (Math.PI * 2) / 6, start = -Math.PI / 2; ctx.moveTo(minR * Math.cos(start), minR * Math.sin(start)); for (let i = 1; i <= 6; i++) ctx.lineTo(minR * Math.cos(start + i * a), minR * Math.sin(start + i * a)); ctx.closePath(); } 
    else if (shape === 'octagon') { let a = (Math.PI * 2) / 8, start = -Math.PI / 2; ctx.moveTo(minR * Math.cos(start), minR * Math.sin(start)); for (let i = 1; i <= 8; i++) ctx.lineTo(minR * Math.cos(start + i * a), minR * Math.sin(start + i * a)); ctx.closePath(); } 
    else if (shape === 'rect_square') { ctx.rect(-w/2 - expand, -h/2 - expand, w + expand*2, h + expand*2); } 
    else { // Mặc định: rect_rounded
        let r = radius + (expand ? 2 : 0), x = -w/2 - expand, y = -h/2 - expand, ew = w + expand*2, eh = h + expand*2;
        if (ew < 2 * r) r = ew / 2; if (eh < 2 * r) r = eh / 2; if (r < 0) r = 0;
        ctx.moveTo(x + r, y); ctx.arcTo(x + ew, y, x + ew, y + eh, r); ctx.arcTo(x + ew, y + eh, x, y + eh, r); ctx.arcTo(x, y + eh, x, y, r); ctx.arcTo(x, y, x + ew, y, r); ctx.closePath();
    }
}

// ============================================================================
// HÀM VẼ CHÍNH (DRAW PRO ELEMENT) - BẢN VIP TỐI THƯỢNG (FIX MÀU CHỮ ĐƠN)
// ============================================================================
window.drawProElement = function(ctx, prefix, text, cx, cy, w, h, radius, angle, shape_IGNORE, isCellGrid = false, autoBgColor = null) {
    if (!text && !isCellGrid) return;

    const _v = (id, def) => { let el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : def; };
    const _c = (id) => { let el = document.getElementById(id); return el ? el.checked : false; };

    // Nạp Hitbox cho lớp tương tác
    if (typeof isExporting !== 'undefined' && !isExporting && prefix !== 'cell') {
        hitBoxes.push({ id: prefix, inputX: prefix + 'X', inputY: prefix + 'Y', rectX: cx - w/2, rectY: cy - h/2, rectW: w, rectH: h, angle: angle, cx: cx, cy: cy });
    }

    ctx.save(); 
    ctx.translate(cx, cy); 
    if (angle !== 0) ctx.rotate(angle * Math.PI / 180);

    // HÀM VẼ KHUNG NỀN CƠ BẢN (Luôn là hình chữ nhật / bo góc)
    const drawBaseRect = () => {
        let r = radius, x = -w/2, y = -h/2;
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2; if (r < 0) r = 0;
        ctx.moveTo(x + r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
    };

    // ------------------------------------------
    // LỚP 1: NỀN Ô (Sân khấu - Khung chữ nhật)
    // ------------------------------------------
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

    // ------------------------------------------
    // LỚP 2: VIỀN Ô (Bao quanh sân khấu)
    // ------------------------------------------
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

    // ------------------------------------------
    // LỚP 3: KHỐI SHAPE ĐỘC LẬP (VIP)
    // ------------------------------------------
    let sType = document.getElementById(prefix + 'ShapeType')?.value || 'none';
    
    if (sType !== 'none' && sType !== 'text_only' && autoBgColor) {
        // Lấy kích thước RIÊNG của Khối (Không đụng chạm w, h của Nền)
        let sw = _v(prefix + 'ShapeW', 45);
        let sh = _v(prefix + 'ShapeH', 45);
        let sRadius = _v(prefix + 'ShapeRadius', 0);

        // 3A. Vẽ bản thân Khối & Bóng Khối
        ctx.save();
        if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'ShapeBoxShadow'); 
        ctx.beginPath();
        if (typeof window.buildShapePath === 'function') window.buildShapePath(ctx, sType, sw, sh, sRadius, 0);
        ctx.fillStyle = autoBgColor; // Đổ màu tự động (Đỏ Viettel, Vàng Kim...)
        ctx.fill();
        ctx.restore();

        // 3B. Vẽ Viền Khối & Bóng Nét Viền Khối
        if (!_c(prefix + 'ShapeBorderTrans')) {
            ctx.save();
            if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'ShapeBorderShadow'); 
            ctx.beginPath();
            if (typeof window.buildShapePath === 'function') window.buildShapePath(ctx, sType, sw, sh, sRadius, 0);
            
            ctx.lineWidth = _v(prefix + 'ShapeBorderW', 2);
            let sbMode = document.getElementById(prefix + 'ShapeBorderMode')?.value || 'solid';
            let sbC1 = sbMode === 'gradient' ? document.getElementById(prefix + 'ShapeBorderGradient1')?.value : document.getElementById(prefix + 'ShapeBorderColor')?.value;
            
            // Lấy ảnh mây cho viền khối (window[prefix + 'ShapeBorderImage'])
            ctx.strokeStyle = window.getAdvancedStyle(ctx, sbMode, sbC1, document.getElementById(prefix + 'ShapeBorderGradient2')?.value, window[prefix + 'ShapeBorderImage'], -sw/2, -sh/2, sw, sh, _v(prefix + 'ShapeBorderGradAngle', 0));
            
            let sbStyle = document.getElementById(prefix + 'ShapeBorderStyle')?.value;
            if (sbStyle === 'dashed') ctx.setLineDash([10, 5]); else if (sbStyle === 'dotted') ctx.setLineDash([3, 5]);
            
            ctx.stroke();
            ctx.restore();
        }
    }

    // ------------------------------------------
    // LỚP 4: CHỮ (Luôn nằm trên cùng)
    // ------------------------------------------
    if (text && !isCellGrid) {
        ctx.save();
        ctx.font = `${_c(prefix + 'Bold') ? 'bold ' : ''}${_c(prefix + 'Italic') ? 'italic ' : ''}${_v(prefix + 'Size', 24)}px "${document.getElementById(prefix + 'Font')?.value || 'Arial'}"`;
        
        let clMode = document.getElementById(prefix + 'ColorMode')?.value || 'solid';
        
        // CẤP QUYỀN KIỂM SOÁT 100% CHO NGƯỜI DÙNG: Luôn lấy màu từ bảng màu (Không ép màu trắng nữa)
        let clC1 = clMode === 'gradient' ? document.getElementById(prefix + 'ColorGradient1')?.value : document.getElementById(prefix + 'Color')?.value;

        // Chỉ ưu tiên màu Nhà mạng nếu Phi chủ động chọn "Chữ theo màu mạng"
        if (sType === 'text_only' && autoBgColor) {
            clC1 = autoBgColor; 
        } 
        
        ctx.fillStyle = window.getAdvancedStyle(ctx, clMode, clC1, document.getElementById(prefix + 'ColorGradient2')?.value, window[prefix + 'ColorImage'], -w/2, -h/2, w, h, _v(prefix + 'ColorGradAngle', 0));
        
        let align = document.getElementById(prefix + 'TextAlign')?.value || 'center';
        let tx = _v(prefix + 'TextX', 0), ty = _v(prefix + 'TextY', 0), pad = _v(prefix + 'TextPad', 0);
        if (align === 'left') { ctx.textAlign = 'left'; tx += (-w / 2 + pad); } else if (align === 'right') { ctx.textAlign = 'right'; tx += (w / 2 - pad); } else { ctx.textAlign = 'center'; }
        
        ctx.textBaseline = 'middle'; let scY = _v(prefix + 'ScaleY', 1); ctx.scale(1, scY);
        if (typeof applyShadow === 'function') applyShadow(ctx, prefix, 'ObjShadow');
        ctx.fillText(text, tx, ty / scY);
        
        if (_c(prefix + 'Stroke')) { 
            ctx.lineWidth = _v(prefix + 'StrokeWidth', 1); 
            ctx.strokeStyle = document.getElementById(prefix + 'StrokeColor')?.value || '#fff'; 
            ctx.strokeText(text, tx, ty / scY); 
        }
        ctx.restore();
    }

    // ------------------------------------------
    // LỚP 5: KHUNG TƯƠNG TÁC KÉO THẢ
    // ------------------------------------------
    if (!isExporting && prefix !== 'cell') {
        if ((typeof dragTarget !== 'undefined' && dragTarget && dragTarget.id === prefix) || (typeof hoveredIndex !== 'undefined' && hoveredIndex !== -1 && hitBoxes[hoveredIndex] && hitBoxes[hoveredIndex].id === prefix)) {
            ctx.save(); ctx.strokeStyle = '#007bff'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath();
            ctx.rect(-w/2 - 5, -h/2 - 5, w + 10, h + 10);
            ctx.stroke(); ctx.restore();
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
    let list = window.parseList(); 
    if (list.length === 0) return;
    
    // 1. LẤY THÔNG SỐ CƠ BẢN
    let tCols = getVal('tableCols', 2), tRows = getVal('tableRows', 10), cW = getVal('cellW', 380), cH = getVal('cellH', 60);
    let gapX = getVal('tableGap', 15), gapY = getVal('rowGap', 10), mLeft = getVal('mLeft', 30), mRight = getVal('mRight', 30), tZoneH = getVal('tZoneH', 100), fZoneH = getVal('fZoneH', 80);
    let hasHead = isChecked('showHeaderRow'), headH = hasHead ? getVal('headerRowHeight', 50) : 0, headGap = hasHead ? gapY : 0;
    
    let sMode = document.getElementById('canvasSizeMode')?.value || 'auto';
    let imgToDraw = window.globalBgImage || window.bgImage; 
    let scale = getVal('exportScale', 1);

    if (sMode === 'ratio' && imgToDraw) {
        // 🌟 CHUẨN Ý PHI: Cố định Chiều Ngang, Chiều Cao nhân chéo theo Tỷ lệ ảnh
        let baseW = getVal('customCanvasW', 1080); 
        let imgRatio = imgToDraw.height / imgToDraw.width; // Tính tỷ lệ Cao/Ngang của ảnh gốc
        
        canvas.width = baseW * scale;
        canvas.height = (baseW * imgRatio) * scale; 
    } 
    else if (sMode === 'fixed') {
        canvas.width = getVal('customCanvasW', 1080) * scale;
        canvas.height = getVal('customCanvasH', 1920) * scale;
    } 
    else {
        // Mode: Tự động
        let autoW = mLeft + mRight + (tCols * cW) + (Math.max(0, tCols - 1) * gapX);
        let autoH = tZoneH + fZoneH + headH + headGap + (tRows * cH) + (Math.max(0, tRows - 1) * gapY);
        canvas.width = autoW * scale;
        canvas.height = autoH * scale;
    }

    // Thiết lập scale để vẽ nét
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform tránh cộng dồn
    ctx.scale(scale, scale);
    let cw = canvas.width / scale;
    let ch = canvas.height / scale;

    let dsp = document.getElementById('canvasSizeDisplay'); 
    if(dsp) dsp.innerText = `Size: ${Math.round(canvas.width)}x${Math.round(canvas.height)} px`;

    // 3. VỀ NỀN TỔNG
    let bgMode = document.getElementById('bgMode')?.value || 'solid';
    if (bgMode === 'image' && imgToDraw) {
        let fitMode = document.getElementById('bgFitMode')?.value || 'stretch';
        ctx.save();
        if (fitMode === 'stretch') {
            ctx.drawImage(imgToDraw, 0, 0, cw, ch);
        } else if (fitMode === 'cover') {
            let s = Math.max(cw / imgToDraw.width, ch / imgToDraw.height);
            let nw = imgToDraw.width * s, nh = imgToDraw.height * s;
            ctx.drawImage(imgToDraw, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
        } else if (fitMode === 'contain' || fitMode === 'contain_trans') {
            if(fitMode === 'contain') {
                ctx.fillStyle = document.getElementById('bgColor')?.value || '#ffffff';
                ctx.fillRect(0, 0, cw, ch);
            }
            let s = Math.min(cw / imgToDraw.width, ch / imgToDraw.height);
            let nw = imgToDraw.width * s, nh = imgToDraw.height * s;
            ctx.drawImage(imgToDraw, (cw - nw) / 2, (ch - nh) / 2, nw, nh);
        }
        ctx.restore();
    } else {
        let c1 = document.getElementById('bgGradient1')?.value || document.getElementById('bgColor')?.value;
        let c2 = document.getElementById('bgGradient2')?.value;
        ctx.fillStyle = getAdvancedStyle(ctx, bgMode, c1, c2, null, 0, 0, cw, ch, getVal('bgGradAngle', 0));
        ctx.fillRect(0, 0, cw, ch);
    }

    // 4. VẼ LƯỚI VÀ DỮ LIỆU
    let tStartX = (cw - (tCols * cW + Math.max(0, tCols - 1) * gapX)) / 2; 
    let tStartY = tZoneH;

    if (hasHead) {
        for (let c = 0; c < tCols; c++) {
            let cx = tStartX + c * (cW + gapX) + cW/2; let cy = tStartY + headH/2;
            ['hNum','hPrice','hMenh','hMang','hData1','hData2'].forEach(p => {
                if(isChecked('chk' + p.substring(1))) {
                    let w = getVal(p+'W'), h = getVal(p+'H');
                    drawProElement(ctx, p, document.getElementById(p+'Text')?.value, getPos(cx-cW/2, cW, w, document.getElementById(p+'AlignX')?.value || 'center', getVal(p+'X')) + w/2, getPos(cy-headH/2, headH, h, document.getElementById(p+'AlignY')?.value || 'middle', getVal(p+'Y')) + h/2, w, h, getVal(p+'Radius'), getVal(p+'Angle'), 'rect_rounded');
                }
            });
        }
        tStartY += headH + headGap;
    }

    let drawList = list.slice(currentStep * tRows * tCols, (currentStep + 1) * tRows * tCols);
    for (let i = 0; i < drawList.length; i++) {
        let cx = tStartX + (i % tCols) * (cW + gapX) + cW/2; 
        let cy = tStartY + Math.floor(i / tCols) * (cH + gapY) + cH/2;
        
        drawProElement(ctx, 'cell', ' ', cx, cy, cW, cH, getVal('cellRadius'), 0, 'rect_rounded', true);

        let num = drawList[i][0]||"", priceText = formatPriceString(drawList[i][1]);
        let menhText = getMenhFromPhone(num), netData = getNetworkData(num), mangText = netData ? netData.short2 : "SIM";
        let vList = [num, priceText, menhText, mangText, drawList[i][2]||"", drawList[i][3]||""];
        
        ['num','price','menh','mang','data1','data2'].forEach((p, idx) => {
            if(isChecked('chk' + (p.charAt(0).toUpperCase() + p.slice(1)))) {
                let w = getVal(p+'W'), h = getVal(p+'H');
                let px = getPos(cx-cW/2, cW, w, document.getElementById(p+'AlignX')?.value || 'center', getVal(p+'X'));
                let py = getPos(cy-cH/2, cH, h, document.getElementById(p+'AlignY')?.value || 'middle', getVal(p+'Y'));
                let autoColor = (p === 'menh') ? menhColors[menhText] : (p === 'mang' && netData ? netData.color : null);
                drawProElement(ctx, p, vList[idx], px + w/2, py + h/2, w, h, getVal(p+'Radius'), getVal(p+'Angle'), 'rect_rounded', false, autoColor);
            }
        });
    }

    // 5. VĂN BẢN TRANG TRÍ
    ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum'].forEach(g => {
        if(isChecked('use_'+g)) {
            let txt = document.getElementById(g+'Text')?.value || '';
            if(g === 'pageNum') txt = txt.replace(/\{p\}/gi, currentStep + 1).replace(/\{t\}/gi, Math.max(1, Math.ceil(list.length / (tRows * tCols))));
            let w = getVal(g+'W'), h = getVal(g+'H'), ax = document.getElementById(g+'AlignX')?.value || 'center', ay = document.getElementById(g+'AlignY')?.value || 'top';
            let gx = (ax==='left') ? mLeft+w/2 : (ax==='right' ? cw-mRight-w/2 : cw/2);
            let gy = (ay==='bottom') ? (ch - fZoneH/2) : (ay==='middle' ? ch/2 : tZoneH/2);
            drawProElement(ctx, g, txt, gx + getVal(g+'X'), gy + getVal(g+'Y'), w, h, getVal(g+'Radius'), getVal(g+'Angle'), 'rect_rounded');
        }
    });
    
    if(typeof updateZoomUI === 'function') updateZoomUI();
    if(typeof window.updatePagination === 'function') window.updatePagination();
};

// ============================================================================
// 7. CÁC HÀM TƯƠNG TÁC (ZOOM, PANNING, DRAG & DROP, AUTO-SYNC)
// ============================================================================

// Tự động vẽ lại khi có thay đổi trong bảng điều khiển UI
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
function fitZoom() { isAutoFit = true; lastFitZoom = 0; updateZoomUI(); wrapper.scrollTop = 0; wrapper.scrollLeft = (canvas.offsetWidth - wrapper.clientWidth) / 2; }
function applyZoom(val) { currentZoom = parseInt(val); isAutoFit = false; updateZoomUI(); }

if(wrapper) {
    wrapper.addEventListener('mousedown', (e) => { if (typeof isDragging !== 'undefined' && isDragging) return; isPanning = true; startX = e.pageX - wrapper.offsetLeft; startY = e.pageY - wrapper.offsetTop; scrollLeft = wrapper.scrollLeft; scrollTop = wrapper.scrollTop; });
    wrapper.addEventListener('mouseleave', () => { isPanning = false; });
    wrapper.addEventListener('mouseup', () => { isPanning = false; });
    wrapper.addEventListener('mousemove', (e) => { if (!isPanning) return; e.preventDefault(); wrapper.scrollLeft = scrollLeft - (e.pageX - wrapper.offsetLeft - startX) * 1.5; wrapper.scrollTop = scrollTop - (e.pageY - wrapper.offsetTop - startY) * 1.5; });
}

function getPointerPos(canvas, clientX, clientY) {
    var rect = canvas.getBoundingClientRect(); let expScale = parseFloat(document.getElementById('exportScale')?.value) || 1;
    return { x: (clientX - rect.left) * ((canvas.width / expScale) / rect.width), y: (clientY - rect.top) * ((canvas.height / expScale) / rect.height) };
}

function handleInteractStart(clientX, clientY) {
    isDragMoved = false;
    let pos = getPointerPos(canvas, clientX, clientY);
    let clickedOnObject = false;

    for (let i = hitBoxes.length - 1; i >= 0; i--) {
        let box = hitBoxes[i];
        if (pos.x >= box.rectX && pos.x <= box.rectX + box.rectW && pos.y >= box.rectY && pos.y <= box.rectY + box.rectH) {
            clickedOnObject = true;
            let lockCheck = document.getElementById(box.id + 'Locked');
            let isLocked = lockCheck && lockCheck.checked;
            if (typeof window.saveState === 'function') window.saveState();
            isDragging = true;
            dragTarget = { ...box, isLocked };
            dragStartX = pos.x; dragStartY = pos.y;
            let elX = document.getElementById(box.inputX); dragStartOffsetX = elX ? parseInt(elX.value)||0 : 0;
            let elY = document.getElementById(box.inputY); dragStartOffsetY = elY ? parseInt(elY.value)||0 : 0;
            canvas.style.cursor = isLocked ? 'pointer' : 'grabbing';
            break;
        }
    }
    return clickedOnObject;
}

function handleInteractMove(clientX, clientY) {
    if (isDragging && dragTarget) {
        let pos = getPointerPos(canvas, clientX, clientY);
        let dx = pos.x - dragStartX; let dy = pos.y - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragMoved = true;
        if (!dragTarget.isLocked) {
            let inputXEl = document.getElementById(dragTarget.inputX), inputYEl = document.getElementById(dragTarget.inputY);
            if (inputXEl) inputXEl.value = Math.round(dragStartOffsetX + dx);
            if (inputYEl) inputYEl.value = Math.round(dragStartOffsetY + dy);
        }
        if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
    } else {
        let pos = getPointerPos(canvas, clientX, clientY); let foundIdx = -1;
        for (let i = hitBoxes.length - 1; i >= 0; i--) {
            let box = hitBoxes[i];
            if (pos.x >= box.rectX && pos.x <= box.rectX + box.rectW && pos.y >= box.rectY && pos.y <= box.rectY + box.rectH) { foundIdx = i; break; }
        }
        if (hoveredIndex !== foundIdx) {
            hoveredIndex = foundIdx;
            if (foundIdx !== -1) {
                let box = hitBoxes[foundIdx], lockCheck = document.getElementById(box.id + 'Locked');
                canvas.style.cursor = (lockCheck && lockCheck.checked) ? 'pointer' : 'grab';
            } else canvas.style.cursor = 'default';
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
        }
    }
}

function handleInteractEnd() {
    if (isDragging) {
        let targetRef = dragTarget; isDragging = false; dragTarget = null;
        let isFS = window.isFullscreen || document.getElementById('previewColumn')?.classList.contains('fullscreen') || false;
        canvas.style.cursor = hoveredIndex !== -1 ? 'grab' : 'default';
        if (isDragMoved) {
            // Đã kéo thả => chỉ vẽ lại
            if (typeof window.updatePreviewImmediate === 'function') window.updatePreviewImmediate(); else drawCanvas();
            if (typeof window.debouncedSave === 'function') window.debouncedSave();
        } else if (targetRef) {
            // Tap (không kéo) => điều hướng tab
            if (isFS || window.innerWidth <= 768) {
                if (typeof window.openMobileModal === 'function') window.openMobileModal(targetRef.id);
            } else {
                if (typeof window.focusDesktopTab === 'function') window.focusDesktopTab(targetRef.id);
            }
        }
    }
}

if(canvas) {
    canvas.addEventListener('touchstart', function(e) { if(e.touches.length === 1) { let handled = handleInteractStart(e.touches[0].clientX, e.touches[0].clientY); if(handled) e.preventDefault(); } }, {passive: false});
    window.addEventListener('touchmove', function(e) { if(isDragging && e.touches.length === 1) { e.preventDefault(); handleInteractMove(e.touches[0].clientX, e.touches[0].clientY); } }, {passive: false});
    window.addEventListener('touchend', function(e) { if (e.touches.length === 0) { handleInteractEnd(); } });
    canvas.addEventListener('mousedown', function(e) { handleInteractStart(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function(e) { if (isDragging) { e.preventDefault(); handleInteractMove(e.clientX, e.clientY); } else if (e.target === canvas) { handleInteractMove(e.clientX, e.clientY); } }, {passive: false});
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
    if (typeof updatePreviewImmediate === 'function') {
        updatePreviewImmediate();
    } else if (typeof drawCanvas === 'function') {
        drawCanvas();
    }
};

window.drawGlobalBackground = function(ctx, canvasW, canvasH) {
    let mode = document.getElementById('bgMode')?.value || 'solid';
    
    ctx.save();
    // 1. Nếu chọn Màu trơn
    if (mode === 'solid') {
        ctx.fillStyle = document.getElementById('bgColor')?.value || '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);
    } 
    // 2. Nếu chọn Chuyển màu (Gradient)
    else if (mode === 'gradient') {
        let c1 = document.getElementById('bgGradient1')?.value || '#ffffff';
        let c2 = document.getElementById('bgGradient2')?.value || '#006680';
        let angle = parseFloat(document.getElementById('bgGradAngle')?.value || 0) * Math.PI / 180;
        
        let x2 = canvasW * Math.cos(angle);
        let y2 = canvasH * Math.sin(angle);
        let grd = ctx.createLinearGradient(0, 0, Math.abs(x2), Math.abs(y2));
        grd.addColorStop(0, c1);
        grd.addColorStop(1, c2);
        
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvasW, canvasH);
    } 
    // 3. Nếu chọn Ảnh tải lên
    else if (mode === 'image' && window.globalBgImage) {
        let img = window.globalBgImage;
        let fit = document.getElementById('bgFitMode')?.value || 'stretch';
        
        if (fit === 'stretch') {
            ctx.drawImage(img, 0, 0, canvasW, canvasH);
        } else if (fit === 'cover') {
            let scale = Math.max(canvasW / img.width, canvasH / img.height);
            let nw = img.width * scale;
            let nh = img.height * scale;
            let nx = (canvasW - nw) / 2;
            let ny = (canvasH - nh) / 2;
            ctx.drawImage(img, nx, ny, nw, nh);
        } else if (fit === 'contain') {
            let scale = Math.min(canvasW / img.width, canvasH / img.height);
            let nw = img.width * scale;
            let nh = img.height * scale;
            let nx = (canvasW - nw) / 2;
            let ny = (canvasH - nh) / 2;
            ctx.fillStyle = document.getElementById('bgColor')?.value || '#ffffff'; // Màu nền lót phía sau ảnh
            ctx.fillRect(0, 0, canvasW, canvasH);
            ctx.drawImage(img, nx, ny, nw, nh);
        }
    } else {
        // Mặc định lót nền trắng nếu chưa up ảnh
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);
    }
    ctx.restore();
};

// [ĐÃ DỌN] Dead code gridW/gridH đã xóa — logic tính canvas size nằm trong drawCanvas()

// HÀM ĐIỀU KHIỂN ẨN/HIỆN GIAO DIỆN TAB CHUNG
// ==========================================================
// ĐOẠN 2: BỘ NÃO ĐIỀU KHIỂN GIAO DIỆN TAB CHUNG (DÁN VÀO MAIN.JS)
// ==========================================================

// 1. Hàm chính điều khiển ẩn/hiện các phần tử theo lựa chọn
window.updateGeneralUI = function() {
    // A. Quản lý ô nhập Size Khóa cứng
    let sizeMode = document.getElementById('canvasSizeMode')?.value;
    let sizeWrapper = document.getElementById('customCanvasSizeWrapper');
    if (sizeWrapper) {
        sizeWrapper.style.display = (sizeMode === 'fixed' ? 'flex' : 'none');
    }

    // B. Quản lý ô nhập Loại Nền (Solid, Gradient, Image)
    let bgMode = document.getElementById('bgMode')?.value;
    let grpSolid = document.getElementById('bgSolidGrp');
    let grpGrad = document.getElementById('bgGradGrp');
    let grpImg = document.getElementById('bgImgGrp');
    
    if (grpSolid) grpSolid.style.display = (bgMode === 'solid' ? 'flex' : 'none');
    if (grpGrad) grpGrad.style.display = (bgMode === 'gradient' ? 'flex' : 'none');
    if (grpImg) grpImg.style.display = (bgMode === 'image' ? 'flex' : 'none');

    // C. Quản lý ô nhập Lề Đóng Gáy
    let bindMode = document.getElementById('bindingMode')?.value;
    let grpNorm = document.getElementById('grpMarginNormal');
    let grpBind = document.getElementById('grpMarginBinding');
    
    if (bindMode && bindMode !== 'none') {
        if(grpNorm) grpNorm.style.display = 'none';
        if(grpBind) grpBind.style.display = 'flex';
    } else {
        if(grpNorm) grpNorm.style.display = 'flex';
        if(grpBind) grpBind.style.display = 'none';
    }
};

// 2. Hàm áp dụng kích thước từ danh sách mẫu (Story, A4...)
window.applyPresetSize = function(val) {
    if(!val) return;
    let parts = val.split('x');
    if(parts.length === 2) {
        let elW = document.getElementById('customCanvasW');
        let elH = document.getElementById('customCanvasH');
        if(elW) elW.value = parts[0];
        if(elH) elH.value = parts[1];
        if(typeof updatePreviewImmediate === 'function') updatePreviewImmediate();
    }
};

// 3. Gọi cập nhật lần đầu tiên khi tải xong giao diện
// Đặt trong setTimeout để đảm bảo HTML đã load xong
setTimeout(window.updateGeneralUI, 100);

// ==========================================
// HÀM MỞ POPUP MOBILE CHUẨN NHẤT
// ==========================================
window.openMobileModal = function(tid) {
    // 🛡️ BẬT TẤM KHIÊN BẢO VỆ (Chống lỗi nhấp nháy click)
    window.isOpeningModal = true;
    setTimeout(() => { window.isOpeningModal = false; }, 100);

    let tabId = '', subTabId = '', mTitle = '';

    // Map chuẩn ID -> tab/sub-tab/tiêu đề
    const _colIds2      = ['num','price','menh','mang','data1','data2'];
    const _headerIds2   = ['hNum','hPrice','hMenh','hMang','hData1','hData2'];
    const _globalTxtIds2 = ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum'];
    const _colNames     = {num:'SỐ', price:'GIÁ', menh:'MỆNH', mang:'MẠNG', data1:'DL 1', data2:'DL 2'};
    const _hNames       = {hNum:'SỐ', hPrice:'GIÁ', hMenh:'MỆNH', hMang:'MẠNG', hData1:'DL 1', hData2:'DL 2'};
    const _txtNames     = {header1:'Tiêu Đề 1', header2:'Tiêu Đề 2', footer1:'Chân Trang 1', footer2:'Chân Trang 2',
                           ctl:'Trái-Trên', ctr:'Phải-Trên', cbl:'Trái-Dưới', cbr:'Phải-Dưới', pageNum:'Số Trang'};

    if (tid === 'layout')          { tabId = 'tab-layout';     mTitle = '📊 LƯỚI SIM'; }
    else if (tid === 'general')    { tabId = 'tab-general';    subTabId = 'sub-general-bg'; mTitle = '🌄 NỀN TỔNG'; }
    else if (tid === 'header')     { tabId = 'tab-colheader';  subTabId = 'sub-hCommon';   mTitle = '🏷️ TIÊU ĐỀ'; }
    else if (tid === 'globaltext') { tabId = 'tab-globaltext'; subTabId = 'sub-gt-chung';  mTitle = '📝 CHỮ GÓC'; }
    else if (_colIds2.includes(tid)) {
        tabId = 'tab-layout'; subTabId = 'sub-' + tid;
        mTitle = '⚙️ CỘT ' + (_colNames[tid] || tid.toUpperCase());
    }
    else if (_headerIds2.includes(tid)) {
        tabId = 'tab-colheader'; subTabId = 'sub-' + tid;
        mTitle = '🏷️ TIÊU ĐỀ ' + (_hNames[tid] || tid.toUpperCase());
    }
    else if (_globalTxtIds2.includes(tid)) {
        tabId = 'tab-globaltext'; subTabId = 'sub-' + tid;
        mTitle = '✏️ ' + (_txtNames[tid] || tid.toUpperCase());
    }

    if (!tabId) return;
    let el = document.getElementById(tabId); 
    if (!el) return;

    // 1. ĐỒNG BỘ DESKTOP TRƯỚC KHI BỐC ĐI
    try {
        let btn1 = document.querySelector(`.tabs button[onclick*="${tabId}"]`); 
        if(btn1) switchTab(tabId, btn1);
        if(subTabId) { 
            let btn2 = document.querySelector(`.sub-tabs button[onclick*="${subTabId}"]`); 
            if(btn2) switchSubTab(subTabId, btn2); 
        }
    } catch(e) {}

    // 2. CUỘN & SÁNG NÚT ĐƯỜNG BĂNG TRÊN MOBILE
    document.querySelectorAll('.m-tab-lvl1').forEach(btn => btn.classList.remove('active'));
    let activeMobileTabBtn = document.getElementById('mTab-' + tabId);
    if (activeMobileTabBtn) {
        activeMobileTabBtn.classList.add('active');
        try { activeMobileTabBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } 
        catch(err) {}
    }

    // Đổi tiêu đề Mobile
    let titleEl = document.getElementById('mobileModalTitle');
    if (titleEl) titleEl.innerText = mTitle;

    let bodyEl = document.getElementById('mobileModalBody');
    let modalEl = document.getElementById('mobileSettingModal');

    // 3. THUẬT TOÁN DỜI NHÀ ĐỔI TAB (TỐI ƯU CỦA PHI)
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
    
    // BỐC KHỐI MỚI NHÉT VÀO POPUP
    if (!bodyEl.contains(el)) {
        window.placeholderNode = document.createComment("mobile-placeholder"); 
        if (el.parentNode) el.parentNode.insertBefore(window.placeholderNode, el); 
        window.activeMobileElement = el;
        bodyEl.appendChild(el); 
    }
    
    el.classList.add('active'); 
    modalEl.style.display = 'flex';
};

// TÌM ĐOẠN CODE BẮT SỰ KIỆN CHẠM CANVAS NÀY CỦA PHI:
// [DA DO'N] Click listener cu da xoa - xu ly click/tap nam trong handleInteractStart + handleInteractEnd

// ===================================================================
// 1. HÀM ĐIỀU HƯỚNG PC (CHIẾN THUẬT MỚI: ÉP DOM HIỂN THỊ TRỰC TIẾP)
// ===================================================================
window.focusDesktopTab = function(tid) {
    if (!tid) return;
    
    let tabId = ''; let subTabId = '';
    let cleanTid = tid.replace('sub-', '');

    // 1. MAP ID CHUẨN XÁC
    const textIds = ['header1','header2','footer1','footer2','ctl','ctr','cbl','cbr','pageNum'];
    const headerIds = ['hNum','hPrice','hMenh','hMang','hData1','hData2'];
    const colIds = ['num','price','menh','mang','data1','data2'];

    if (cleanTid === 'layout') { tabId = 'tab-layout'; }
    else if (cleanTid === 'general') { tabId = 'tab-general'; subTabId = 'sub-general-bg'; }
    else if (colIds.includes(cleanTid)) { tabId = 'tab-layout'; subTabId = 'sub-' + cleanTid; }
    else if (cleanTid === 'header') { tabId = 'tab-colheader'; subTabId = 'sub-hCommon'; }
    else if (headerIds.includes(cleanTid)) { tabId = 'tab-colheader'; subTabId = 'sub-' + cleanTid; }
    else if (cleanTid === 'globaltext') { tabId = 'tab-globaltext'; subTabId = 'sub-gt-chung'; }
    else if (textIds.includes(cleanTid) || cleanTid.includes('text') || (window.textBlocks && window.textBlocks.some(b => b.id === cleanTid))) { 
        tabId = 'tab-globaltext'; subTabId = 'sub-' + cleanTid; 
    }

    if (!tabId) return;

    // --- BẮT ĐẦU CHIẾN THUẬT MỚI: CAN THIỆP CSS KHÔNG CẦN CHỜ ĐỢI ---
    
    // BƯỚC 1: TẮT HẾT VÀ BẬT TAB CẤP 1 (MENU DỌC TRÁI)
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    let targetTab1 = document.getElementById(tabId);
    if (targetTab1) targetTab1.classList.add('active'); // Ép bảng ruột hiện ra
    
    let btn1 = document.querySelector(`.tabs button[onclick*="${tabId}"]`);
    if (btn1) btn1.classList.add('active'); // Ép nút Menu sáng lên

    // BƯỚC 2: TẮT HẾT VÀ BẬT TAB CẤP 2 (MENU CUỘN NGANG BÊN TRONG)
    if (subTabId && targetTab1) {
        targetTab1.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
        targetTab1.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
        
        let targetTab2 = document.getElementById(subTabId);
        if (targetTab2) targetTab2.classList.add('active'); // Ép ruột Tab con hiện ra
        
        // Tìm và ép nút Cuộn ngang sáng lên
        let btn2 = targetTab1.querySelector(`button[onclick*="'${subTabId}'"]`) || targetTab1.querySelector(`button[onclick*='"${subTabId}"']`);
        if (btn2) {
            btn2.classList.add('active');
            try { btn2.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch(e){}
        }
    }

    // BƯỚC 3: DỌN DẸP LỚP CẤP 3 (Vị trí / Định dạng / Viền)
    if (typeof syncTabUX === 'function' && targetTab1) {
        syncTabUX(targetTab1); // Trả lại hàm xử lý UI mượt mà của Phi
    }
};

// [ĐÃ DỌN] Click listener cũ đã xóa — xử lý tap nằm trong handleInteractEnd()