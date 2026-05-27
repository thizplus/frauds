export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export type StatusType = (typeof STATUS)[keyof typeof STATUS]

export const STATUS_LABELS: Record<StatusType, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
  active: 'ใช้งาน',
  inactive: 'ไม่ใช้งาน',
}

export const ROLE = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export type RoleType = (typeof ROLE)[keyof typeof ROLE]

export const ROLE_LABELS: Record<RoleType, string> = {
  admin: 'ผู้ดูแลระบบ',
  member: 'สมาชิก',
}
