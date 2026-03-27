// ============================================================
// data.js — Master data for Merchant Control Service Request
// ============================================================

// MENU_GROUPS is populated exclusively from Firebase (via fbListenSettings 'menuGroups')
// This array starts empty and is filled by the realtime listener on app startup.
const MENU_GROUPS = [];

// Seed data — used ONLY if Firebase has no 'menuGroups' document yet (first-time setup)
const _DEFAULT_MENU_GROUPS = [
  { id: 'M01', label: 'แดชบอร์ด', locked: true },
  { id: 'M02', label: 'ยอดรวมรายได้' },
  { id: 'M03', label: 'ประวัติการโอนเงินคืน' },
  {
    id: 'M04', label: 'รายการสั่งซื้อและผู้ซื้อ',
    children: [
      { id: 'M05', label: 'รายการสั่งซื้อทั้งหมด' },
      { id: 'M06', label: 'คืนเงินหรือยกเลิกรายการ' },
      { id: 'M07', label: 'อัตราแลกเปลี่ยน' },
    ],
  },
  {
    id: 'M08', label: 'จัดการข้อมูลร้านค้า',
    children: [
      { id: 'M09', label: 'ตั้งค่าเบื้องต้น' },
      { id: 'M10', label: 'ข้อมูลส่วนตัว' },
      { id: 'M11', label: 'แก้ไขข้อมูลส่วนตัว' },
      { id: 'M12', label: 'แก้ไขข้อมูลบัญชีธนาคาร' },
      { id: 'M13', label: 'เปลี่ยนรหัสผ่าน' },
      { id: 'M14', label: 'ข้อมูลใบกำกับภาษี' },
      { id: 'M15', label: 'ส่งคำกลับเว็บไซต์หลัก' },
    ],
  },
  { id: 'M16', label: 'จัดการเอกสาร' },
  {
    id: 'M17', label: 'ลิงก์ชำระเงิน (Pay.sn)',
    children: [
      { id: 'M18', label: 'ลิงก์รับชำระเงินของร้านค้า' },
      { id: 'M19', label: 'ลิงก์รับชำระเงินแบบกำหนดเวลา' },
    ],
  },
  { id: 'M20', label: 'เทคนิคการใช้งาน' },
  {
    id: 'M21', label: 'บริการชำระเงินอัตโนมัติ',
    children: [
      { id: 'M22', label: 'สร้างรายการชำระเงินอัตโนมัติ' },
      { id: 'M23', label: 'การชำระเงินอัตโนมัติ' },
    ],
  },
  { id: 'M24', label: 'เพิ่มโลโก้ชำระเงินบนเว็บไซต์' },
  { id: 'M25', label: 'ข่าวสารและกิจกรรมใหม่' },
  { id: 'M26', label: 'ดาวน์โหลดใบเสร็จ / ใบกำกับภาษี อิเล็กทรอนิกส์' },
  { id: 'M27', label: 'ตัวแทนจำหน่าย' },
];

// Helper: flatten all menu IDs from MENU_GROUPS
function getAllMenuIds() {
  return MENU_GROUPS.flatMap(m => m.children ? [m.id, ...m.children.map(c => c.id)] : [m.id]);
}

// Helper: find a menu item by id (searches parents and children)
function findMenuById(id) {
  for (const m of MENU_GROUPS) {
    if (m.id === id) return m;
    if (m.children) { const c = m.children.find(c => c.id === id); if (c) return c; }
  }
  return null;
}





const ROLES = [
  {
    id: 'ROLE_ADMIN',
    name: 'Administrator',
    description: 'สิทธิ์ระดับสูงสุด – จัดการผู้ใช้, ตั้งค่าร้านค้า, ดูรายงานทุกประเภท',
    level: 'high',
  },
  {
    id: 'ROLE_MGR',
    name: 'Manager',
    description: 'จัดการออเดอร์, อนุมัติธุรกรรม, ดูรายงานสรุป',
    level: 'medium',
  },
  {
    id: 'ROLE_CASHIER',
    name: 'Cashier',
    description: 'รับชำระเงิน, สร้างออเดอร์, พิมพ์ใบเสร็จ',
    level: 'low',
  },
  {
    id: 'ROLE_REPORT',
    name: 'Report Viewer',
    description: 'ดูรายงานยอดขาย, Export ข้อมูล (Read-Only)',
    level: 'low',
  },
  {
    id: 'ROLE_AUDITOR',
    name: 'Auditor',
    description: 'ตรวจสอบ Log การทำธุรกรรม, ดูรายงานทางการเงิน',
    level: 'medium',
  },
];

const REQUEST_TYPES = [
  { id: 'CREATE_USER', label: 'สร้าง User ใหม่' },
  { id: 'ASSIGN_ROLE', label: 'กำหนด Role ให้ User' },
  { id: 'MODIFY_ROLE', label: 'แก้ไข Role ที่มีอยู่' },
  { id: 'REVOKE_ACCESS', label: 'ยกเลิกสิทธิ์การเข้าถึง' },
  { id: 'RESET_PASSWORD', label: 'Reset Password' },
];

const REQUEST_STATUS = {
  PENDING: { label: 'รอดำเนินการ', color: '#f59e0b', icon: '⏳' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', color: '#3b82f6', icon: '🔄' },
  COMPLETED: { label: 'ดำเนินการเรียบร้อยแล้ว', color: '#10b981', icon: '✅' },
  REJECTED: { label: 'ปฏิเสธ', color: '#ef4444', icon: '❌' },
};

// All requests are loaded from Firebase (window._latestRequests)
// Use this helper to get the current snapshot synchronously
function loadRequests() {
  return window._latestRequests || [];
}

function generateId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SR-${yy}${mm}${dd}-${rand}`;
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
