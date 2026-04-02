/**
 * CONFIGS.JS - TRUNG TÂM CẤU HÌNH HỆ THỐNG (STATIC DATA)
 * Nơi chứa toàn bộ dữ liệu tĩnh, định danh và các mẫu thiết kế.
 */

// --- 1. DANH SÁCH FONT HỆ THỐNG ---
window.sysFonts = [
    'Arial', 'Verdana', 'Tahoma', 'Times New Roman', 'Courier New', 'Segoe UI', 'Impact',
    'Roboto', 'Montserrat', 'Oswald', 'Dancing Script', 'Pattaya', 'Inter', 'Outfit',
    'Playfair Display', 'Bungee', 'Lobster', 'Pacifico', 'Saira Stencil One', 'Charm',
    'Sedgwick Ave Display', 'Century', 'Century-Bold', 'UVN Saigon', 'UVN Dam Cuoi', 'HL Thu phap'
];

// --- 2. DATA NHÀ MẠNG & ĐẦU SỐ ---
window.NETWORK_INFO = { 
    'VT': { short1: 'Viettel', short2: 'VIETTEL', color: '#ee0033' }, 
    'VN': { short1: 'Vinaphone', short2: 'VINA', color: '#0066cc' }, 
    'MB': { short1: 'Mobifone', short2: 'MOBI', color: '#0055a6' }, 
    'VNM': { short1: 'Vietnamobile', short2: 'VNMB', color: '#ff6600'}, 
    'GM': { short1: 'Gmobile', short2: 'GMOB', color: '#d3a800' } 
};

window.PREFIX_TO_NETWORK = { 
    '32':'VT','33':'VT','34':'VT','35':'VT','36':'VT','37':'VT','38':'VT','39':'VT','86':'VT','96':'VT','97':'VT','98':'VT',
    '81':'VN','82':'VN','83':'VN','84':'VN','85':'VN','88':'VN','91':'VN','94':'VN',
    '70':'MB','76':'MB','77':'MB','78':'MB','79':'MB','89':'MB','90':'MB','93':'MB',
    '56':'VNM','58':'VNM','92':'VNM','59':'GM','99':'GM' 
};

// --- 3. MÀU SẮC THEO MỆNH (PHONG THỦY) ---
window.menhColors = {
    'THỦY': '#0066ff',
    'THỔ': '#8b4513',
    'MỘC': '#0a8f0a',
    'KIM': '#ff9900',
    'HỎA': '#ff0000'
};

// --- 4. BẢN ĐỒ ÁNH XẠ CHECKBOX ---
window.colCheckMap = {
    'num': 'chkNum', 'hNum': 'chkNum',
    'price': 'chkPrice', 'hPrice': 'chkPrice',
    'menh': 'chkMenh', 'hMenh': 'chkMenh',
    'mang': 'chkMang', 'hMang': 'chkMang',
    'data1': 'chkData1', 'hData1': 'chkNum', // hData1 thường đi kèm num hoặc data1 tùy tool
    'data2': 'chkData2', 'hData2': 'chkData2'
};

// --- 5. TÊN ĐỊNH DANH ĐỐI TƯỢNG (BLUEPRINT UX) ---
window._objNames = {
    num: 'SỐ', price: 'GIÁ', menh: 'MỆNH', mang: 'MẠNG', data1: 'DỮ LIỆU 1', data2: 'DỮ LIỆU 2',
    hNum: 'T.ĐỀ SỐ', hPrice: 'T.ĐỀ GIÁ', hMenh: 'T.ĐỀ MỆNH', hMang: 'T.ĐỀ MẠNG', hData1: 'T.ĐỀ DỮ LIỆU 1', hData2: 'T.ĐỀ DỮ LIỆU 2',
    header1: 'Đầu Trang 1', header2: 'Đầu Trang 2', footer1: 'Chân Trang 1', footer2: 'Chân Trang 2',
    ctl: 'Trái Trên', ctr: 'Phải Trên', cbl: 'Trái Dưới', cbr: 'Phải Dưới', pageNum: 'Số Trang'
};

// --- 6. URL HỆ THÔNG ĐÁM MÂY ---
window.CLOUD_JSON_URL = "https://script.google.com/macros/s/AKfycbxowiVuOyMhN-ua15GgfARcYUvD-Gf8iqFNdT88oTjzKV74OwJwxTD3EXAlsTzhsLDp/exec";

// --- 7. KHO MẪU THIẾT KẾ CÓ SẴN (.LITE) ---
window.builtinTemplatesData = {
    "mau_vip_1": {},
    "mau_vip_2": {},
    "mau_vip_3": {},
    "mau_vip_4": {},
    "mau_vip_5": {},
    "mau_vip_6": {}
};

window.configsLoaded = true;
