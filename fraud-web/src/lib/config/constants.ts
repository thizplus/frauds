export const SEARCH_TYPES = {
  ALL: 'all',
  PHONE: 'phone',
  BANK: 'bank',
  NAME: 'name',
  IDCARD: 'idcard',
} as const

export const SEARCH_TYPE_LABELS: Record<string, string> = {
  all: 'ทั้งหมด',
  phone: 'เบอร์โทร',
  bank: 'เลขบัญชี',
  name: 'ชื่อ',
  idcard: 'บัตร ปชช.',
}

export interface BankInfo {
  name: string
  fullname: string
  symbol: string
  icon: string
  color: string
}

export const BANKS: BankInfo[] = [
  { name: 'กสิกรไทย', fullname: 'ธนาคารกสิกรไทย', symbol: 'KBANK', icon: '/banks/KBANK.png', color: '#1DA858' },
  { name: 'ไทยพาณิชย์', fullname: 'ธนาคารไทยพาณิชย์', symbol: 'SCB', icon: '/banks/SCB.png', color: '#543186' },
  { name: 'กรุงไทย', fullname: 'ธนาคารกรุงไทย', symbol: 'KTB', icon: '/banks/KTB.png', color: '#1DA8E6' },
  { name: 'กรุงเทพ', fullname: 'ธนาคารกรุงเทพ', symbol: 'BBL', icon: '/banks/BBL.png', color: '#29449D' },
  { name: 'กรุงศรีอยุธยา', fullname: 'ธนาคารกรุงศรีอยุธยา', symbol: 'BAY', icon: '/banks/BAY.png', color: '#FFD51C' },
  { name: 'ทีเอ็มบีธนชาต', fullname: 'ธนาคารทีเอ็มบีธนชาต', symbol: 'TTB', icon: '/banks/TTB.png', color: '#0C55F2' },
  { name: 'ออมสิน', fullname: 'ธนาคารออมสิน', symbol: 'GSB', icon: '/banks/GSB.png', color: '#ED1891' },
  { name: 'ธ.ก.ส.', fullname: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', symbol: 'BAAC', icon: '/banks/BAAC.png', color: '#CCA41C' },
  { name: 'ยูโอบี', fullname: 'ธนาคารยูโอบี', symbol: 'UOB', icon: '/banks/UOB.png', color: '#E41A26' },
  { name: 'เกียรตินาคิน', fullname: 'ธนาคารเกียรตินาคินภัทร', symbol: 'KKP', icon: '/banks/KKP.png', color: '#5A547C' },
  { name: 'ซีไอเอ็มบี', fullname: 'ธนาคารซีไอเอ็มบี', symbol: 'CIMB', icon: '/banks/CIMB.png', color: '#BD1325' },
  { name: 'ทิสโก้', fullname: 'ธนาคารทิสโก้', symbol: 'TISCO', icon: '/banks/TISCO.png', color: '#267CBC' },
  { name: 'ไทยเครดิต', fullname: 'ธนาคารไทยเครดิต', symbol: 'TCRB', icon: '/banks/TCRB.png', color: '#FF7813' },
  { name: 'แลนด์ แอนด์ เฮ้าส์', fullname: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', symbol: 'LHB', icon: '/banks/LHB.png', color: '#727375' },
  { name: 'ธ.อ.ส.', fullname: 'ธนาคารอาคารสงเคราะห์', symbol: 'GHB', icon: '/banks/GHB.png', color: '#FF8614' },
  { name: 'พร้อมเพย์', fullname: 'พร้อมเพย์', symbol: 'PromptPay', icon: '/banks/PromptPay.png', color: '#0C4370' },
  { name: 'ทรูมันนี่', fullname: 'ทรูมันนี่', symbol: 'TrueMoney', icon: '/banks/TrueMoney.png', color: '#EE252B' },
]

// backward compat
export const BANK_OPTIONS = BANKS.map((b) => b.name)

export const DEFAULT_STALE_TIME = 30_000
