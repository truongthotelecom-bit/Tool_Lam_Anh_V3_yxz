
            ['hNum', 'hPrice', 'hMenh', 'hMang'].forEach(p => {
                let name = p==='hNum'?'SỐ SIM':(p==='hPrice'?'GIÁ BÁN':(p==='hMenh'?'MỆNH':'NHÀ MẠNG'));
                let w = p==='hNum'?200:(p==='hPrice'?110:70);
                let defaultX = p==='hMang'?'-80':'0';
                let defaultBg = p==='hNum'?'#007bff':(p==='hPrice'?'#28a745':(p==='hMenh'?'#d63031':'#ff9f43'));
                
                document.write(`
                <div id="sub-${p}" class="sub-tab-content">
                    <div class="sub-sub-tabs">
                        <button class="sub-sub-tab-btn active" onclick="switchSubSubTab('ssub-${p}-pos', this)">📐 Vị Trí</button>
                        <button class="sub-sub-tab-btn" onclick="switchSubSubTab('ssub-${p}-format', this)">📝 Định Dạng</button>
                        <button class="sub-sub-tab-btn" onclick="switchSubSubTab('ssub-${p}-bg', this)">🎨 Nền & Viền</button>
                    </div>

                    <div id="ssub-${p}-format" class="sub-sub-tab-content">
                        <div class="setting-box" style="border-top: 3px solid var(--primary);">
                            <div class="setting-title">📝 ĐỊNH DẠNG CHỮ</div>
                            <div class="setting-row"><label>Font chữ</label><div class="setting-inputs"><select id="${p}Font" class="font-selector flex-1"></select></div></div>
                            <div class="setting-row"><label>Tên cột</label><div class="setting-inputs"><input type="text" id="headerText${p.replace('h','')}" value="${name}" class="flex-1"></div></div>
                            <div class="setting-row"><label>Cỡ & Màu</label><div class="setting-inputs"><span>Size:</span><input type="number" id="headerSize${p.replace('h','')}" value="18" class="mini"><input type="color" id="headerColor${p.replace('h','')}" value="#ffffff"><span>Giãn Y:</span><input type="number" id="${p}ScaleY" value="1" step="0.1" class="mini"></div></div>
                            <div class="setting-row"><label>Canh chữ</label><div class="setting-inputs"><select id="${p}TextAlign" class="mini"><option value="left">Trái</option><option value="center" selected>Giữa</option><option value="right">Phải</option></select><span>Pad:</span><input type="number" id="${p}Pad" value="5" class="mini"></div></div>
                            <div class="setting-row"><label>Lệch/Xoay</label><div class="setting-inputs"><span>X:</span><input type="number" id="${p}TextX" value="0" class="mini"><span>Y:</span><input type="number" id="${p}TextY" value="0" class="mini"><span>Góc:</span><input type="number" id="${p}Angle" value="0" class="mini"></div></div>
                            <div class="setting-row"><label>Hiệu ứng</label><div class="setting-inputs effect-group"><label><input type="checkbox" id="${p}Bold" checked><b>B</b></label><label><input type="checkbox" id="${p}Italic"><i>I</i></label><label><input type="checkbox" id="${p}Underline"><u>U</u></label><label><input type="checkbox" id="${p}Shadow">Bóng</label><label><input type="checkbox" id="${p}Stroke">Viền</label><input type="color" id="${p}StrokeColor" value="#000000"><input type="number" id="${p}StrokeWidth" value="1" style="width:30px;"></div></div>
                        </div>
                    </div>

                    <div id="ssub-${p}-pos" class="sub-sub-tab-content active">
                        <div class="setting-box">
                            <div class="setting-title">📐 VỊ TRÍ & KHỐI</div>
                            <div class="setting-row"><label>Size khối</label><div class="setting-inputs"><span>W:</span><input type="number" id="${p}W" value="${w}" class="mini"><span>H:</span><input type="number" id="${p}H" value="40" class="mini"></div></div>
                            <div class="setting-row"><label>Lệch khối</label><div class="setting-inputs"><span>X:</span><input type="number" id="${p}X" value="${defaultX}" class="mini"><span>Y:</span><input type="number" id="${p}Y" value="0" class="mini"></div></div>
                            <div class="setting-row"><label>Khóa/Canh</label><div class="setting-inputs"><select id="${p}AlignX" class="mini"><option value="left" ${p==='hNum'?'selected':''}>Trái</option><option value="center" ${p==='hPrice'?'selected':''}>Giữa</option><option value="right" ${(p==='hMenh'||p==='hMang')?'selected':''}>Phải</option></select><select id="${p}AlignY" class="mini"><option value="top">Trên</option><option value="middle" selected>Giữa</option><option value="bottom">Dưới</option></select><label style="color:red;"><input type="checkbox" id="${p}Locked" onchange="updatePreviewImmediate(); debouncedSave();"> 🔒 Khóa</label></div></div>
                        </div>
                    </div>

                    <div id="ssub-${p}-bg" class="sub-sub-tab-content">
                        <div class="setting-box">
                            <div class="setting-title">🎨 NỀN & VIỀN</div>
                            <div class="setting-row" style="background:#fffcf0; border-bottom:1px dashed #ff4757;"><label style="color:#ff4757; font-weight:bold;">⛅ Đổ Bóng</label><div class="setting-inputs" style="flex-wrap:wrap;"><label style="color:red;"><input type="checkbox" id="${p}ObjShadow" onchange="updatePreviewImmediate(); debouncedSave();"> Bật Bóng Cho Khối Này</label><div style="display:flex; width:100%; gap:5px; align-items:center; margin-top:5px;"><span>X:</span><input type="number" id="${p}ObjShadowX" value="5" class="mini"><span>Y:</span><input type="number" id="${p}ObjShadowY" value="5" class="mini"><span>Mờ:</span><input type="number" id="${p}ObjShadowBlur" value="10" class="mini"><input type="color" id="${p}ObjShadowColor" value="#000000" style="padding:0; width:24px; height:24px;"></div></div></div>
                            <div class="setting-row"><label>Nền/Viền</label><div class="setting-inputs"><input type="color" id="${p}BgColor" value="${defaultBg}"><label><input type="checkbox" id="${p}BgTrans"> Ẩn Nền</label><input type="color" id="${p}BorderColor" value="#000000"><label><input type="checkbox" id="${p}BorderTrans" checked> Ẩn Viền</label></div></div>
                            <div class="setting-row"><label>Độ dày/Bo</label><div class="setting-inputs"><span>Dày viền:</span><input type="number" id="${p}BorderW" value="1" class="mini"><span>Bo góc(R):</span><input type="number" id="${p}Radius" value="4" class="mini"></div></div>
                        </div>
                    </div>
                </div>`);
            });
        