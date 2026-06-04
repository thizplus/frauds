export function Footer() {
  return (
    <footer className="footer">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} เช็กคนโกง</span>
          <div className="flex items-center gap-4">
            <a href="/blog" className="hover:text-accent transition-colors">บทความ</a>
            <a href="/pricing" className="hover:text-accent transition-colors">สมัครสมาชิก</a>
            <a href="/report" className="hover:text-accent transition-colors">แจ้งข้อมูล</a>
            <a href="/privacy" className="hover:text-accent transition-colors">นโยบายความเป็นส่วนตัว</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
