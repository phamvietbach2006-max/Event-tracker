import os
import sys

# Ensure UTF-8 output on Windows console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# Paths
ARTIFACT_DIR = r"C:\Users\phamv\.gemini\antigravity\brain\0e621399-7ded-426a-8568-e2d941443cb6"
UPLOAD_DIR = os.path.join(ARTIFACT_DIR, ".user_uploaded")
OUTPUT_PPTX = os.path.join(r"d:\Documents\2.Ban TCKT\Event-tracker", "Huong_Dan_Su_Dung_He_Thong_Theo_Doi_Dai_Hoi.pptx")
OUTPUT_PPTX_ARTIFACT = os.path.join(ARTIFACT_DIR, "Huong_Dan_Su_Dung_He_Thong_Theo_Doi_Dai_Hoi.pptx")

# Palette - HUST & Modern Executive Design
C_CRIMSON = RGBColor(185, 28, 28)       # #B91C1C - Đỏ Bách khoa
C_NAVY_DARK = RGBColor(15, 23, 42)      # #0F172A - Xanh thẫm Đại học
C_NAVY_LIGHT = RGBColor(30, 41, 59)     # #1E293B
C_AMBER = RGBColor(217, 119, 6)         # #D97706 - Vàng kim nhấn
C_GREEN = RGBColor(5, 150, 105)         # #059669 - Xanh ngọc thành công
C_BLUE = RGBColor(37, 99, 235)          # #2563EB - Xanh công nghệ
C_PURPLE = RGBColor(124, 58, 237)       # #7C3AED - Tím điều hành
C_BG = RGBColor(248, 250, 252)          # #F8FAFC - Nền trắng dịu mắt
C_WHITE = RGBColor(255, 255, 255)
C_BORDER = RGBColor(226, 232, 240)      # #E2E8F0 - Viền thẻ tinh tế
C_TEXT_DARK = RGBColor(30, 41, 59)      # #1E293B - Chữ chính
C_TEXT_MUTED = RGBColor(100, 116, 139)  # #64748B - Chữ phụ
C_TEXT_LIGHT = RGBColor(241, 245, 249)

# Roles definition
ROLE_ALL = ("TOÀN THỂ NGƯỜI DÙNG", RGBColor(71, 85, 105))
ROLE_IOS = ("NGƯỜI DÙNG iOS", RGBColor(37, 99, 235))
ROLE_ANDROID = ("NGƯỜI DÙNG ANDROID", RGBColor(5, 150, 105))
ROLE_OFFICER = ("CÁN BỘ CÁC CẤP", RGBColor(185, 28, 28))
ROLE_GUEST = ("KHÁCH & ĐOÀN VIÊN", RGBColor(2, 132, 199))
ROLE_ROOM_LEAD = ("CÁN BỘ TRỰC LỚP", RGBColor(5, 150, 105))
ROLE_FLOOR_LEAD = ("PHỤ TRÁCH TẦNG", RGBColor(217, 119, 6))
ROLE_UNIT_LEAD = ("PHỤ TRÁCH TÒA NHÀ", RGBColor(124, 58, 237))
ROLE_ADMIN = ("BAN QUẢN TRỊ ADMIN", RGBColor(185, 28, 28))


def add_header(slide, title_text, category="HƯỚNG DẪN VẬN HÀNH HỆ THỐNG", role_tuple=ROLE_ALL):
    # Header container
    header_box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.15))
    header_box.fill.solid()
    header_box.fill.fore_color.rgb = C_CRIMSON
    header_box.line.fill.background()

    # Category breadcrumb & Title
    tf = header_box.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.8)
    tf.margin_top = Inches(0.16)
    tf.margin_right = Inches(3.2)
    tf.margin_bottom = Inches(0.0)

    p0 = tf.paragraphs[0]
    p0.text = category.upper()
    p0.font.name = "Segoe UI"
    p0.font.size = Pt(9.5)
    p0.font.bold = True
    p0.font.color.rgb = RGBColor(254, 226, 226)

    p1 = tf.add_paragraph()
    p1.text = title_text
    p1.font.name = "Segoe UI"
    p1.font.size = Pt(18)
    p1.font.bold = True
    p1.font.color.rgb = C_WHITE

    # Accent stripe underneath
    stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(1.15), Inches(13.333), Inches(0.06))
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = C_AMBER
    stripe.line.fill.background()

    # Role Badge Pill on top right
    role_name, role_color = role_tuple
    badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.2), Inches(0.35), Inches(2.4), Inches(0.42))
    badge.fill.solid()
    badge.fill.fore_color.rgb = role_color
    badge.line.color.rgb = C_WHITE
    badge.line.width = Pt(1.2)

    btf = badge.text_frame
    btf.word_wrap = False
    btf.margin_left = btf.margin_right = btf.margin_top = btf.margin_bottom = 0
    bp = btf.paragraphs[0]
    bp.alignment = PP_ALIGN.CENTER
    bp.text = role_name
    bp.font.name = "Segoe UI"
    bp.font.size = Pt(10)
    bp.font.bold = True
    bp.font.color.rgb = C_WHITE


def add_footer(slide, current_slide, total_slides=20):
    foot = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.05), Inches(13.333), Inches(0.45))
    foot.fill.solid()
    foot.fill.fore_color.rgb = C_NAVY_DARK
    foot.line.fill.background()

    txBox = slide.shapes.add_textbox(Inches(0.8), Inches(7.10), Inches(9.5), Inches(0.35))
    tf = txBox.text_frame
    tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0
    p = tf.paragraphs[0]
    p.text = "Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội • Hệ thống Theo dõi Đại hội Chi đoàn • https://event-tracker-pied.vercel.app/"
    p.font.name = "Segoe UI"
    p.font.size = Pt(9)
    p.font.color.rgb = RGBColor(148, 163, 184)

    txBox2 = slide.shapes.add_textbox(Inches(11.2), Inches(7.10), Inches(1.3), Inches(0.35))
    tf2 = txBox2.text_frame
    tf2.margin_left = tf2.margin_top = tf2.margin_bottom = tf2.margin_right = 0
    p2 = tf2.paragraphs[0]
    p2.text = f"{current_slide} / {total_slides}"
    p2.alignment = PP_ALIGN.RIGHT
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(9.5)
    p2.font.bold = True
    p2.font.color.rgb = C_WHITE


def create_card(slide, left, top, width, height, title=None, bg_color=C_WHITE, border_color=C_BORDER):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1.5)

    if title:
        header_box = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.18), width - Inches(0.5), Inches(0.38))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = "Segoe UI"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = C_NAVY_DARK

    return card


def add_bullets(slide, left, top, width, height, items, font_size=10.5, space_after=6):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0

    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if isinstance(it, tuple):
            prefix, text = it
            p.text = f"• {prefix}: "
            p.font.bold = True
            p.font.name = "Segoe UI"
            p.font.size = Pt(font_size)
            p.font.color.rgb = C_TEXT_DARK
            p.space_after = Pt(space_after)

            run = p.add_run()
            run.text = text
            run.font.bold = False
            run.font.name = "Segoe UI"
            run.font.size = Pt(font_size)
            run.font.color.rgb = C_TEXT_DARK
        else:
            p.text = f"• {it}"
            p.font.name = "Segoe UI"
            p.font.size = Pt(font_size)
            p.font.color.rgb = C_TEXT_DARK
            p.space_after = Pt(space_after)


def add_callout(slide, left, top, width, height, title, text, bg_color=RGBColor(254, 242, 242), border_color=RGBColor(248, 113, 113), text_color=C_CRIMSON):
    box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    box.fill.solid()
    box.fill.fore_color.rgb = bg_color
    box.line.color.rgb = border_color
    box.line.width = Pt(1.2)

    tx = slide.shapes.add_textbox(left + Inches(0.18), top + Inches(0.12), width - Inches(0.36), height - Inches(0.24))
    tf = tx.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0

    p = tf.paragraphs[0]
    p.text = title
    p.font.name = "Segoe UI"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = text_color
    p.space_after = Pt(3)

    p2 = tf.add_paragraph()
    p2.text = text
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(9.5)
    p2.font.bold = False
    p2.font.color.rgb = C_TEXT_DARK


def add_fitted_image(slide, img_path, left, top, max_w, max_h, border=True):
    if not os.path.exists(img_path):
        print(f"[CẢNH BÁO] Không tìm thấy ảnh: {img_path}")
        return None
    try:
        with Image.open(img_path) as im:
            orig_w, orig_h = im.size

        scale = min(max_w / orig_w, max_h / orig_h)
        fit_w = orig_w * scale
        fit_h = orig_h * scale

        pos_x = left + (max_w - fit_w) / 2.0
        pos_y = top + (max_h - fit_h) / 2.0

        pic = slide.shapes.add_picture(img_path, Inches(pos_x), Inches(pos_y), width=Inches(fit_w), height=Inches(fit_h))
        if border:
            pic.line.color.rgb = C_BORDER
            pic.line.width = Pt(1)
        return pic
    except Exception as e:
        print(f"[LỖI] Chèn ảnh {img_path}: {e}")
        return None


def add_caption(slide, left, top, width, height, text):
    tx = slide.shapes.add_textbox(left, top, width, height)
    tf = tx.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0
    p = tf.paragraphs[0]
    p.text = f"📷 {text}"
    p.font.name = "Segoe UI"
    p.font.size = Pt(9.5)
    p.font.color.rgb = C_TEXT_MUTED
    p.font.italic = True


def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # =========================================================================
    # SLIDE 1: TRANG TIÊU ĐỀ (TITLE SLIDE)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = C_NAVY_DARK
    bg1.line.fill.background()

    # Red accent bar left
    bar1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(0.4), Inches(7.5))
    bar1.fill.solid()
    bar1.fill.fore_color.rgb = C_CRIMSON
    bar1.line.fill.background()

    # Title texts
    tx1 = s1.shapes.add_textbox(Inches(1.2), Inches(1.1), Inches(8.2), Inches(4.2))
    tf1 = tx1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "ĐOÀN TNCS HỒ CHÍ MINH ĐẠI HỌC BÁCH KHOA HÀ NỘI"
    p.font.name = "Segoe UI"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = RGBColor(239, 68, 68)
    p.space_after = Pt(4)

    p = tf1.add_paragraph()
    p.text = "BAN TỔ CHỨC - KIỂM TRA ĐOÀN ĐẠI HỌC"
    p.font.name = "Segoe UI"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = RGBColor(203, 213, 225)
    p.space_after = Pt(20)

    p = tf1.add_paragraph()
    p.text = "HỆ THỐNG THEO DÕI ĐẠI HỘI CHI ĐOÀN"
    p.font.name = "Segoe UI"
    p.font.size = Pt(27)
    p.font.bold = True
    p.font.color.rgb = C_WHITE

    p = tf1.add_paragraph()
    p.text = "THỜI GIAN THỰC (REALTIME DASHBOARD)"
    p.font.name = "Segoe UI"
    p.font.size = Pt(21)
    p.font.bold = True
    p.font.color.rgb = RGBColor(251, 191, 36)
    p.space_after = Pt(16)

    p = tf1.add_paragraph()
    p.text = "CẨM NANG HƯỚNG DẪN VẬN HÀNH & TÁC NGHIỆP PHÂN QUYỀN TOÀN DIỆN"
    p.font.name = "Segoe UI"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = RGBColor(226, 232, 240)
    p.space_after = Pt(6)

    p = tf1.add_paragraph()
    p.text = "Phục vụ Đại hội Chi đoàn các khóa K70, K71 • Chuẩn hóa theo Điều lệ Đoàn TNCS Hồ Chí Minh"
    p.font.name = "Segoe UI"
    p.font.size = Pt(11)
    p.font.color.rgb = RGBColor(148, 163, 184)

    # Feature badges bottom left
    s1_cards = [
        ("ĐỒNG BỘ 100% REALTIME", "Server-Sent Events (SSE) < 100ms"),
        ("PHÂN QUYỀN RBAC 5 CẤP", "Khách • Lớp • Tầng • Tòa • Admin"),
        ("PWA ĐA NỀN TẢNG", "Màn hình chính iOS Safari & Android"),
        ("KIỂM SOÁT PHÁP LÝ", "Ràng buộc 2/3 sĩ số & 100% hồ sơ")
    ]
    for i, (sc_title, sc_desc) in enumerate(s1_cards):
        cx = Inches(1.2 + i * 2.8)
        cy = Inches(5.6)
        card_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, cx, cy, Inches(2.6), Inches(1.2))
        card_box.fill.solid()
        card_box.fill.fore_color.rgb = C_NAVY_LIGHT
        card_box.line.color.rgb = RGBColor(51, 65, 85)
        card_box.line.width = Pt(1)

        c_tf = card_box.text_frame
        c_tf.word_wrap = True
        c_tf.margin_left = c_tf.margin_right = Inches(0.15)
        c_tf.margin_top = Inches(0.15)
        cp1 = c_tf.paragraphs[0]
        cp1.text = sc_title
        cp1.font.name = "Segoe UI"
        cp1.font.size = Pt(9.5)
        cp1.font.bold = True
        cp1.font.color.rgb = RGBColor(251, 191, 36)
        cp1.space_after = Pt(3)

        cp2 = c_tf.add_paragraph()
        cp2.text = sc_desc
        cp2.font.name = "Segoe UI"
        cp2.font.size = Pt(8.5)
        cp2.font.color.rgb = RGBColor(203, 213, 225)

    # Right side graphic / logo
    logo_path = os.path.join(ARTIFACT_DIR, "transparent_logo.png")
    if os.path.exists(logo_path):
        s1.shapes.add_picture(logo_path, Inches(9.8), Inches(1.6), width=Inches(2.8), height=Inches(2.8))

    # =========================================================================
    # SLIDE 2: TỔNG QUAN KIẾN TRÚC & MỤC TIÊU CHUYỂN ĐỔI SỐ
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "TỔNG QUAN KIẾN TRÚC & MỤC TIÊU CHUYỂN ĐỔI SỐ ĐẠI HỘI", "HỆ THỐNG THEO DÕI ĐẠI HỘI", ROLE_ALL)
    add_footer(s2, 2)

    create_card(s2, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Mục tiêu Chuyển đổi số & Các Trụ cột Công nghệ")
    add_bullets(s2, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("Mục tiêu Chuyển đổi số", "Chuyển dịch 100% công tác điều hành từ báo cáo thủ công qua tin nhắn/giấy tờ rời rạc sang bảng điều khiển số tập trung, nắm bắt tình trạng từng phòng học theo thời gian thực."),
        ("Đồng bộ Thời gian thực (SSE)", "Cán bộ trực lớp tick chọn checklist hoặc cập nhật sĩ số, dữ liệu lập tức phát tín hiệu Server-Sent Events cập nhật tức thời tới điện thoại của Phụ trách Tầng, Tòa nhà và Ban Quản trị dưới 100ms."),
        ("Khả năng Chịu tải Cao & Độ trễ cực thấp", "Kiến trúc SQLite WAL (Write-Ahead Logging) + Edge Cache tại Singapore (sin1), đo lường chịu tải thực tế 200 CC đạt thông lượng 194 req/s với độ trễ chỉ 88ms (nhanh gấp 25 lần)."),
        ("Bảo mật Phân quyền & Ẩn thông tin cá nhân", "Phân quyền RBAC 5 cấp độ nghiêm ngặt. Người xem công khai chỉ thấy tiến độ và số phòng; thông tin cán bộ (Email, SĐT) chỉ hiển thị cho cán bộ đăng nhập nhiệm vụ."),
    ], font_size=10.5, space_after=10)

    create_card(s2, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Giao diện Bảng Điều khiển Tập trung Toàn trường")
    preview_img = os.path.join(ARTIFACT_DIR, "real_dashboard_overview.png")
    add_fitted_image(s2, preview_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s2, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Bảng điều khiển trực quan 198 chi đoàn với 10 tầng học phân cấp thời gian thực")

    # =========================================================================
    # SLIDE 3: HƯỚNG DẪN CÀI ĐẶT PWA TRÊN iOS (IPHONE / IPAD)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "HƯỚNG DẪN CÀI ĐẶT PWA TRÊN iOS (IPHONE / IPAD - SAFARI)", "CÀI ĐẶT ỨNG DỤNG DI ĐỘNG", ROLE_IOS)
    add_footer(s3, 3)

    create_card(s3, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "4 Bước Đưa Hệ thống Ra Màn hình Chính trên iOS")
    add_bullets(s3, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("[Bước 1] Mở Safari", "Khởi động trình duyệt Safari trên iPhone/iPad và nhập địa chỉ: https://event-tracker-pied.vercel.app/ (Lưu ý: Bắt buộc dùng Safari, Chrome trên iOS không hỗ trợ cài PWA)."),
        ("[Bước 2] Bấm nút Chia sẻ [ ↑ ]", "Tìm thanh công cụ dưới đáy màn hình Safari và chạm vào biểu tượng Share hình ô vuông có mũi tên hướng lên [ ↑ ]."),
        ("[Bước 3] Chọn 'Thêm vào MH chính'", "Cuộn danh sách menu tùy chọn xuống dưới và chạm vào dòng chữ 'Thêm vào MH chính' (Add to Home Screen)."),
        ("[Bước 4] Xác nhận 'Thêm'", "Kiểm tra tên hiển thị 'Đại hội Chi đoàn', sau đó chạm nút 'Thêm' (Add) ở góc trên bên phải màn hình."),
    ], font_size=10.5, space_after=8)

    add_callout(s3, Inches(0.85), Inches(5.3), Inches(5.5), Inches(1.35),
                "ƯU ĐIỂM KHI DÙNG CHẾ ĐỘ PWA (MÀN HÌNH CHÍNH & MÀN HÌNH CHỜ)",
                "• Ứng dụng chạy toàn màn hình (Standalone), không có thanh địa chỉ web vướng víu.\n• Biểu tượng hiện cả trên Màn hình chính và Màn hình chờ/khóa (Standby).\n• Bộ nhớ đệm tự động giúp mở nhanh tức thì ngay cả khi mạng 4G hội trường yếu.")

    create_card(s3, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Infographic Hướng dẫn Chi tiết trên iPhone Safari")
    ios_guide_img = os.path.join(ARTIFACT_DIR, "pwa_ios_guide.png")
    add_fitted_image(s3, ios_guide_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s3, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Thao tác 4 bước đơn giản để biến website thành ứng dụng độc lập trên iPhone")

    # =========================================================================
    # SLIDE 4: HƯỚNG DẪN CÀI ĐẶT PWA TRÊN ANDROID (GOOGLE CHROME)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "HƯỚNG DẪN CÀI ĐẶT PWA TRÊN ANDROID (GOOGLE CHROME)", "CÀI ĐẶT ỨNG DỤNG DI ĐỘNG", ROLE_ANDROID)
    add_footer(s4, 4)

    create_card(s4, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "4 Bước Cài đặt Ứng dụng trên Điện thoại Android")
    add_bullets(s4, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("[Bước 1] Mở Google Chrome", "Khởi động ứng dụng Chrome (hoặc Cốc Cốc, Samsung Internet) trên thiết bị Android và truy cập đường dẫn: https://event-tracker-pied.vercel.app/"),
        ("[Bước 2] Mở Menu Dấu 3 chấm [ ⋮ ]", "Chạm vào biểu tượng dấu 3 chấm dọc [ ⋮ ] ở góc trên cùng bên phải thanh địa chỉ trình duyệt."),
        ("[Bước 3] Chọn 'Cài đặt ứng dụng'", "Tìm trong menu và chọn dòng 'Cài đặt ứng dụng' (Install App) hoặc 'Thêm vào Màn hình chính' (Add to Home screen)."),
        ("[Bước 4] Xác nhận Cài đặt", "Hộp thoại pop-up xuất hiện, bấm nút 'Cài đặt' (Install). Biểu tượng ứng dụng sẽ lập tức được ghim ra màn hình chính."),
    ], font_size=10.5, space_after=8)

    add_callout(s4, Inches(0.85), Inches(5.3), Inches(5.5), Inches(1.35),
                "TÍNH NĂNG VƯỢT TRỘI TRÊN NỀN TẢNG ANDROID",
                "• Tích hợp trực tiếp vào ngăn kéo ứng dụng (App Drawer) của điện thoại.\n• Hỗ trợ nhận thông báo đẩy khẩn cấp từ Ban Thường vụ Đoàn trường.\n• Khởi động chỉ 1 chạm, tự động ghi nhớ tài khoản cán bộ mà không cần đăng nhập lại.")

    create_card(s4, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Infographic Hướng dẫn Chi tiết trên Android Chrome")
    android_guide_img = os.path.join(ARTIFACT_DIR, "pwa_android_guide.png")
    add_fitted_image(s4, android_guide_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s4, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Cài đặt ứng dụng nhanh chóng qua thanh công cụ Google Chrome")

    # =========================================================================
    # SLIDE 5: QUY TRÌNH ĐĂNG NHẬP & MA TRẬN PHÂN QUYỀN CÁN BỘ
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "QUY TRÌNH ĐĂNG NHẬP & MA TRẬN PHÂN QUYỀN HỆ THỐNG", "BẢO MẬT & PHÂN QUYỀN", ROLE_OFFICER)
    add_footer(s5, 5)

    create_card(s5, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quy trình Đăng nhập & Ma trận Phân quyền 5 Cấp")
    add_bullets(s5, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Mở Modal Đăng nhập", "Bấm nút 'Đăng nhập Cán bộ' trên Header hoặc truy cập qua Magic Link một chạm được Ban Tổ chức cấp qua Zalo/Email."),
        ("[Bước 2] Nhập Tài khoản", "Nhập địa chỉ Email sinh viên (@sis.hust.edu.vn) và Mật khẩu được cấp. Sau đó bấm nút 'Đăng nhập'."),
        ("1. Khách / Đoàn viên (Guest)", "Chỉ xem tiến độ công khai, tra cứu vị trí phòng học và sơ đồ bản đồ, ẩn toàn bộ số điện thoại cá nhân."),
        ("2. Cán bộ Trực lớp (Room Lead)", "Nhập sĩ số, tích hồ sơ, viết ghi chú kiểm tra, cập nhật trạng thái, Lưu và Khóa các chi đoàn được phân công."),
        ("3. Phụ trách Tầng (Floor Lead)", "Giám sát tất cả lớp trong tầng, có thẩm quyền MỞ KHÓA (Unlock) khi lớp bị khóa sai số, gửi thông báo tầng."),
        ("4. Phụ trách Tòa nhà (Unit Lead)", "Điều hành toàn bộ tòa nhà / liên chi đoàn, có quyền mở khóa cấp tòa, gửi thông báo toàn đơn vị."),
        ("5. Ban Quản trị (Admin)", "Toàn quyền quản trị hệ thống, cấp lại mật khẩu, phân công cán bộ, xem Audit Logs và phát cảnh báo toàn trường."),
    ], font_size=10.0, space_after=6)

    create_card(s5, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Hộp thoại Đăng nhập Cán bộ Kiểm tra")
    login_img = os.path.join(ARTIFACT_DIR, "real_login_modal.png")
    add_fitted_image(s5, login_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s5, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Hộp thoại Đăng nhập Cán bộ: Nhập Email @sis.hust.edu.vn và mật khẩu bảo mật")

    # =========================================================================
    # SLIDE 6: ĐOÀN VIÊN & KHÁCH [1]: TRA CỨU TIẾN ĐỘ & BẢN ĐỒ HUSTMAP
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "DÀNH CHO ĐOÀN VIÊN & KHÁCH: TRA CỨU TIẾN ĐỘ & BẢN ĐỒ", "HƯỚNG DẪN TRA CỨU", ROLE_GUEST)
    add_footer(s6, 6)

    create_card(s6, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Các Bước Tra cứu Tiến độ & Định vị Không gian")
    add_bullets(s6, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Truy cập Trang chủ", "Mở liên kết https://event-tracker-pied.vercel.app/ trên bất kỳ thiết bị nào (máy tính, máy tính bảng, điện thoại)."),
        ("[Bước 2] Quan sát Topbar Tổng quan", "Thanh thống kê trên cùng hiển thị tổng số chi đoàn toàn trường, tỷ lệ phần trăm đã hoàn thành và số lượng lớp theo từng trạng thái (Đỏ, Vàng, Xanh, Tím)."),
        ("[Bước 3] Tra cứu theo Tầng & Tòa nhà", "Danh sách hiển thị phân theo từng tầng. Người dùng bấm vào thanh Accordion tiêu đề tầng để xem chi tiết các lớp hoặc thu gọn để nhìn tổng thể."),
        ("[Bước 4] Chuyển sang Bản đồ HUSTMAP", "Bấm tab 'Sơ đồ' trên menu để mở bản đồ số khuôn viên ĐHBK Hà Nội. Bấm vào từng tòa nhà để xem danh sách lớp đang họp tại tòa đó."),
        ("Chức năng Thanh Tìm kiếm [Search]", "Gõ tên chi đoàn (VD: 'IT1-01', 'EE2-05') hoặc số phòng ('D3-201') để lọc ra ngay thẻ lớp cần tìm trong chớp mắt."),
    ], font_size=10.5, space_after=8)

    create_card(s6, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Bảng Giám sát Công khai theo Tầng & Phòng học")
    add_fitted_image(s6, preview_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s6, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Giao diện công khai: Trực quan, bảo mật thông tin cá nhân, cập nhật từng giây")

    # =========================================================================
    # SLIDE 7: ĐOÀN VIÊN & KHÁCH [2]: BỘ LỌC ĐA NĂNG & TÌM KIẾM NHANH
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "DÀNH CHO ĐOÀN VIÊN & KHÁCH: BỘ LỌC ĐA NĂNG & TÌM KIẾM", "HƯỚNG DẪN TRA CỨU", ROLE_GUEST)
    add_footer(s7, 7)

    create_card(s7, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Hướng dẫn Thao tác Sử dụng Bộ lọc Đa chiều")
    add_bullets(s7, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Lọc theo Đơn vị Quản lý", "Bấm mở Sidebar bên trái, chọn Đơn vị quản lý (Trường Điện-Điện tử, Trường CNTT&TT, Trường Cơ khí, Khoa Ngoại ngữ...) để chỉ xem các lớp thuộc đơn vị đó."),
        ("[Bước 2] Lọc theo Kíp thời gian", "Bấm các Chip lọc kíp trên thanh công cụ:\n• Tất cả kíp\n• Kíp Sáng (Kíp 1: 07h00-09h00, Kíp 2: 09h30-11h30)\n• Kíp Chiều (Kíp 3: 13h00-15h00, Kíp 4: 15h30-17h30)."),
        ("[Bước 3] Lọc theo Khóa sinh viên", "Chọn chip 'K70' (khóa năm 2, hồ sơ 8 mục kiểm tra) hoặc 'K71' (khóa năm 1, hồ sơ 4 mục kiểm tra rút gọn)."),
        ("[Bước 4] Lọc theo Trạng thái Tiến độ", "Bấm vào các huy hiệu trạng thái: Chưa tổ chức (Đỏ), Đang tiến hành (Vàng), Đã xong (Xanh), Đã hủy (Tím) để lọc ra lớp theo tiến độ mong muốn."),
        ("Nút Đặt lại Bộ lọc [Xóa lọc]", "Bấm nút 'Xóa lọc' để đưa toàn bộ điều kiện về mặc định, hiển thị lại toàn bộ các lớp trong trường."),
    ], font_size=10.5, space_after=8)

    create_card(s7, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Bộ lọc Kíp, Khóa, Trạng thái & Ô Tìm kiếm Header")
    filter_bar_img = os.path.join(ARTIFACT_DIR, "real_filter_bar.png")
    add_fitted_image(s7, filter_bar_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s7, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Thanh công cụ lọc đa năng: Đơn vị, Kíp 1-4, Khóa K70/K71, Trạng thái & Tìm kiếm nhanh")

    # =========================================================================
    # SLIDE 8: CÁN BỘ TRỰC LỚP [1]: CẤU TRÚC THẺ CHI ĐOÀN & ĐIỀU PHỐI
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "CÁN BỘ TRỰC LỚP [1]: CẤU TRÚC THẺ CHI ĐOÀN & ĐIỀU PHỐI", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s8, 8)

    create_card(s8, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Cấu trúc Thẻ Lớp & Thông tin Điều phối Hiện trường")
    add_bullets(s8, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Nhận diện Thẻ Lớp Phân công", "Sau khi cán bộ đăng nhập, hệ thống tự động làm nổi bật các thẻ chi đoàn thuộc quyền phụ trách của mình."),
        ("[Bước 2] Tiêu đề & Thông tin Phòng học", "Mỗi thẻ ghi rõ: Tên Chi đoàn (VD: 'KT-ĐK&TĐH 01-K70'), Phòng học (VD: 'D3-201'), Huy hiệu Kíp (VD: 'Kíp 1') và Khóa sinh viên."),
        ("[Bước 3] Thời gian Cập nhật Cuối", "Góc phải hiển thị nhãn giờ phút (timeLabel) ghi nhận thời điểm gần nhất có cán bộ cập nhật dữ liệu vào thẻ lớp."),
        ("[Bước 4] Thông tin Liên lạc Điều phối Hiện trường", "Thẻ hiển thị họ tên và SĐT của Cán bộ trực lớp, Phụ trách Tầng và Phụ trách Tòa nhà. Khi có vướng mắc, cán bộ bấm nút biểu tượng Điện thoại [Phone] để gọi trực tiếp hỗ trợ khẩn cấp."),
        ("Quy định Bảo mật", "Số điện thoại và email cán bộ chỉ hiển thị nội bộ cho cán bộ đã đăng nhập; hoàn toàn ẩn với người dùng khách công khai."),
    ], font_size=10.5, space_after=8)

    create_card(s8, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Hình ảnh Thẻ Chi đoàn Thực tế với Đầy đủ Dữ liệu")
    card_d9102_img = os.path.join(ARTIFACT_DIR, "real_card_d9102.png")
    add_fitted_image(s8, card_d9102_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s8, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Cấu trúc Thẻ Chi đoàn: Mã phòng, Kíp học, Loại đại hội, Tiến độ hồ sơ & Cán bộ trực")

    # =========================================================================
    # SLIDE 9: CÁN BỘ TRỰC LỚP [2]: ĐIỂM DANH SĨ SỐ & RÀNG BUỘC 2/3
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "CÁN BỘ TRỰC LỚP [2]: ĐIỂM DANH SĨ SỐ & RÀNG BUỘC 2/3", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s9, 9)

    create_card(s9, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quy trình Điểm danh Sĩ số & Ràng buộc Pháp lý 2/3")
    add_bullets(s9, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("[Bước 1] Nhận Số liệu Điểm danh", "Cán bộ trực tiếp đối soát số liệu với Ban Thẩm tra tư cách đại biểu tại phòng đại hội chi đoàn."),
        ("[Bước 2] Nhập [Có mặt] & [Tổng số]", "Gõ số lượng đoàn viên có mặt thực tế vào ô 'Có mặt' và tổng số đoàn viên triệu tập vào ô 'Tổng số'."),
        ("[Bước 3] Quan sát Tính toán Tự động", "Hệ thống tự động tính tỷ lệ % và kiểm tra điều kiện pháp lý:\n• ĐỦ 2/3 (Xanh lá): Khi Có mặt * 3 >= Tổng số * 2.\n• CHƯA ĐỦ 2/3 (Đỏ): Cảnh báo rõ: 'Còn thiếu N đoàn viên để đủ 2/3'."),
    ], font_size=10.5, space_after=6)

    add_callout(s9, Inches(0.85), Inches(4.7), Inches(5.5), Inches(1.95),
                "QUY ĐỊNH BẮT BUỘC THEO ĐIỀU LỆ ĐOÀN TNCS HỒ CHÍ MINH",
                "• Đại hội Chi đoàn chỉ có giá trị pháp lý khi có ít nhất 2/3 tổng số đoàn viên được triệu tập có mặt tham dự.\n• KHÓA CHẶN TỰ ĐỘNG: Nếu sĩ số chưa đạt đủ 2/3, hệ thống sẽ KHÓA CHẶN, tuyệt đối không cho phép chuyển trạng thái lớp sang 'Đang tiến hành' hoặc 'Đã xong'.\n• Nếu không tập hợp đủ 2/3: Cán bộ phải thực hiện quy trình Hủy đại hội và xin hoãn sang buổi khác.")

    create_card(s9, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Khung Điểm danh Sĩ số & Huy hiệu Đủ 2/3 Hợp lệ")
    attend_img = os.path.join(ARTIFACT_DIR, "real_attendance_box.png")
    add_fitted_image(s9, attend_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s9, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Khung Điểm danh thực tế: 42/50 ĐV (84% Đạt chuẩn), vạch Mốc 2/3 & Huy hiệu Đủ 2/3 hợp lệ")

    # =========================================================================
    # SLIDE 10: CÁN BỘ TRỰC LỚP [3]: KIỂM TRA HỒ SƠ & CHECKLIST 100%
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "CÁN BỘ TRỰC LỚP [3]: KIỂM TRA HỒ SƠ & CHECKLIST 100%", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s10, 10)

    create_card(s10, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Danh mục Hồ sơ Kiểm tra Chuẩn theo Khóa Sinh viên")
    add_bullets(s10, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("Danh mục Hồ sơ Khóa K71 (4 mục)", "1. Phương hướng nhiệm kỳ mới\n2. Nghị quyết Đại hội\n3. Biên bản Đại hội\n4. Danh sách Đoàn viên và Cán bộ lớp."),
        ("Danh mục Hồ sơ Khóa K70 (8 mục)", "1. Biên bản ĐHCĐ\n2. Biên bản kiểm phiếu bầu BCH\n3. Biên bản họp phân công BCH\n4. Bản kiểm điểm BCH nhiệm kỳ cũ\n5. Nghị quyết Đại hội\n6. Báo cáo tổng kết\n7. Phương hướng mới\n8. Danh sách Đoàn viên & Cán bộ lớp."),
        ("[Thao tác Tick chọn Checklist]", "Chạm vào từng dòng để chuyển trạng thái xoay vòng: '☐ Chưa đủ' -> '◐ Đang kiểm' -> '☑ Đã đủ'."),
        ("Ràng buộc 100% Hồ sơ Hoàn thành", "Bắt buộc phải tích đủ 100% tất cả các mục hồ sơ trên thì hệ thống mới cho phép chuyển trạng thái lớp sang 'Đã xong'."),
    ], font_size=10.0, space_after=8)

    create_card(s10, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Danh sách Checklist Hồ sơ đã Tích Đủ 100%")
    checklist_img = os.path.join(ARTIFACT_DIR, "real_checklist_100.png")
    add_fitted_image(s10, checklist_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s10, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Checklist 8 mục của khóa K70 đã tích đủ màu xanh lá kèm xác nhận đủ điều kiện tổ chức")

    # =========================================================================
    # SLIDE 11: CÁN BỘ TRỰC LỚP [4]: GHI CHÚ & ĐỔI MÀU TRẠNG THÁI
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "CÁN BỘ TRỰC LỚP [4]: GHI CHÚ & ĐỔI MÀU TRẠNG THÁI", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s11, 11)

    create_card(s11, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Ghi chú Kiểm tra & Chu trình Trạng thái Đại hội")
    add_bullets(s11, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Ghi chú Kiểm tra Hiện trường", "Cán bộ nhập ghi chú vào ô 'Ghi chú kiểm tra' (tối đa 150 ký tự). Cần ghi rõ: Số lượng nhân sự trúng cử BCH, tên Bí thư/Phó Bí thư, hoặc các điểm lưu ý đặc biệt."),
        ("[Bước 2] Chuyển đổi Trạng thái Đại hội", "Bấm vào nút Trạng thái để chuyển vòng tròn:\n• Chưa tổ chức (Màu Đỏ): Chi đoàn chưa bắt đầu họp.\n• Đang tiến hành (Màu Vàng): Chi đoàn đang họp (yêu cầu sĩ số >= 2/3).\n• Đã xong (Màu Xanh lá): Đại hội kết thúc thành công."),
        ("Điều kiện Bắt buộc để Sang 'Đã xong'", "1. Sĩ số có mặt phải đạt chuẩn >= 2/3.\n2. Hồ sơ checklist phải tích đủ 100%.\nNếu thiếu 1 trong 2 điều kiện, hệ thống sẽ từ chối và báo rõ điều kiện còn thiếu."),
        ("Nút Trạng thái Đồng bộ Realtime", "Khi bấm chuyển trạng thái, màu sắc của thẻ phòng học trên màn hình của tất cả các cấp sẽ đổi màu ngay lập tức."),
    ], font_size=10.5, space_after=8)

    create_card(s11, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Thẻ Lớp với Ô Ghi chú & Nút Trạng thái Đại hội")
    note_bottom_img = os.path.join(ARTIFACT_DIR, "test_card_bottom.png")
    add_fitted_image(s11, note_bottom_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s11, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Ghi chú kiểm tra chi tiết nhân sự trúng cử, nút Lưu độc lập và nút Khóa niêm phong")

    # =========================================================================
    # SLIDE 12: CÁN BỘ TRỰC LỚP [5]: XỬ LÝ HỦY ĐẠI HỘI & LÝ DO BẮT BUỘC
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "CÁN BỘ TRỰC LỚP [5]: XỬ LÝ HỦY ĐẠI HỘI & LÝ DO BẮT BUỘC", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s12, 12)

    create_card(s12, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quy trình Hủy Đại hội & Ràng buộc Lý do Bắt buộc")
    add_bullets(s12, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("[Bước 1] Khi nào chọn Hủy đại hội?", "Áp dụng khi chi đoàn không thể tổ chức đại hội: Không đủ 2/3 sĩ số sau thời gian chờ, không có đoàn viên tham gia, hoặc sự cố bất khả kháng."),
        ("[Bước 2] Chọn Trạng thái 'Hủy đại hội'", "Cán bộ bấm chọn trạng thái 'Hủy đại hội' trên thẻ lớp."),
        ("[Bước 3] Nhập Lý do trong Modal Bắt buộc", "Hệ thống tự động bật hộp thoại Modal chuyên nghiệp: 'Nhập lý do hủy đại hội'. Cán bộ BẮT BUỘC phải nhập rõ nguyên nhân cụ thể (không được để trống)."),
        ("[Bước 4] Xác nhận & Tự động Niêm phong", "Bấm 'Xác nhận Hủy đại hội'. Hệ thống tự động ghi lý do vào Ghi chú kiểm tra, chuyển màu thẻ sang Màu Tím (Cancelled) và tự động KHÓA LỚP."),
    ], font_size=10.0, space_after=6)

    add_callout(s12, Inches(0.85), Inches(5.1), Inches(5.5), Inches(1.55),
                "CHỨC NĂNG CÁC NÚT BẤM TRÊN HỘP THOẠI HỦY",
                "• Nút 'Xác nhận Hủy đại hội': Lưu lý do, đổi trạng thái sang Tím, niêm phong thẻ lớp và phát thông báo điều hành.\n• Nút 'Hủy bỏ' [X]: Đóng hộp thoại, giữ nguyên trạng thái cũ của lớp.\n• Cảnh báo: Việc hủy đại hội sẽ được ghi vết vĩnh viễn trong Nhật ký Audit Logs.")

    # Two stacked cards on the right
    create_card(s12, Inches(6.8), Inches(1.3), Inches(5.9), Inches(2.7), "1. Hộp thoại Bắt buộc Nhập Lý do Hủy")
    cancel_modal_img = os.path.join(ARTIFACT_DIR, "cancel_prompt_modal.png")
    add_fitted_image(s12, cancel_modal_img, 7.0, 1.7, 5.5, 2.1)

    create_card(s12, Inches(6.8), Inches(4.15), Inches(5.9), Inches(2.75), "2. Thẻ Lớp chuyển Màu Tím & Niêm phong Lý do")
    cancelled_card_img = os.path.join(ARTIFACT_DIR, "cancelled_and_locked_card.png")
    add_fitted_image(s12, cancelled_card_img, 7.0, 4.55, 5.5, 2.2)

    # =========================================================================
    # SLIDE 13: CÁN BỘ TRỰC LỚP [6]: NÚT LƯU TIẾN ĐỘ ĐỘC LẬP TỪNG LỚP
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "CÁN BỘ TRỰC LỚP [6]: NÚT LƯU TIẾN ĐỘ ĐỘC LẬP TỪNG LỚP", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s13, 13)

    create_card(s13, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quy tắc 'Xong Lớp nào Bấm Lưu Lớp đó'")
    add_bullets(s13, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("Vị trí Nút LƯU", "Nằm ở góc dưới bên trái của mỗi thẻ lớp: Nút màu xanh ngọc có biểu tượng đĩa mềm: [💾 Lưu thông tin lớp]."),
        ("Tác vụ Thực hiện", "Khi bấm Lưu, hệ thống gửi dữ liệu (Sĩ số, danh mục checklist đã tích, ghi chú kiểm tra) ngay lập tức lên cơ sở dữ liệu máy chủ trung tâm."),
        ("Cơ chế Lưu Độc lập", "Mỗi chi đoàn được lưu độc lập, hoàn toàn không phụ thuộc vào các lớp khác trong cùng phòng hay cùng tầng."),
        ("Phản hồi Thông báo (Toast)", "Màn hình xuất hiện thông báo ngắn màu xanh: 'Đã lưu tiến độ chi đoàn thành công'."),
    ], font_size=10.5, space_after=8)

    add_callout(s13, Inches(0.85), Inches(5.0), Inches(5.5), Inches(1.65),
                "LƯU Ý NGHIỆP VỤ SỐ 1 CHO CÁN BỘ HIỆN TRƯỜNG",
                "• BẤM LƯU NHIỀU LẦN: Cán bộ có thể bấm nút Lưu nhiều lần trong suốt quá trình đại hội mà không sợ bị khóa dữ liệu.\n• NGUY CƠ NẾU QUÊN LƯU: Nếu thoát trình duyệt hoặc chuyển trang khi chưa bấm Lưu, dữ liệu mới nhập sẽ bị mất.\n• NGUYÊN TẮC VÀNG: 'Kiểm tra xong mục nào hoặc xong lớp nào - Chạm ngay nút Lưu lớp đó!'.")

    create_card(s13, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Vị trí & Giao diện Nút 'Lưu thông tin lớp'")
    save_focus_img = os.path.join(ARTIFACT_DIR, "real_save_button_focus.png")
    add_fitted_image(s13, save_focus_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s13, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Nút 'Lưu thông tin lớp' màu trắng viền xám nổi bật ở chân thẻ lớp, ghi nhận tức thời")

    # =========================================================================
    # SLIDE 14: CÁN BỘ TRỰC LỚP [7]: NÚT KHÓA HỒ SƠ & NIÊM PHONG DỮ LIỆU
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "CÁN BỘ TRỰC LỚP [7]: NÚT KHÓA HỒ SƠ & NIÊM PHONG", "TÁC NGHIỆP CÁN BỘ TRỰC LỚP", ROLE_ROOM_LEAD)
    add_footer(s14, 14)

    create_card(s14, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Phân biệt Nút LƯU vs Nút KHÓA & Cơ chế Niêm phong")
    add_bullets(s14, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("Nút KHÓA (Lock)", "Nút màu cam có biểu tượng ổ khóa: [🔒 Khóa hồ sơ & Sĩ số]. Chỉ bấm khi ĐẠI HỘI ĐÃ HOÀN TẤT VÀ KIỂM TRA ĐỦ HỒ SƠ."),
        ("Hộp thoại Xác nhận Khóa", "Bấm Khóa sẽ bật Modal xác nhận giải thích: Checklist và sĩ số sẽ bị niêm phong, cán bộ không thể tự sửa nếu chưa có sự cho phép của cấp trên."),
        ("Dải Banner Niêm phong", "Thẻ lớp xuất hiện banner xám: 'Hồ sơ và sĩ số đã được lưu & khóa (bởi Cán bộ ABC). Cần cấp trên mở khóa để chỉnh sửa.'"),
        ("ĐẶC QUYỀN ĐIỀU CHỈNH TRẠNG THÁI", "Sau khi khóa, toàn bộ checklist và sĩ số bị đóng băng, NHƯNG cán bộ VẪN ĐƯỢC PHÉP thay đổi Trạng thái Đại hội nếu cần thiết."),
    ], font_size=10.0, space_after=6)

    add_callout(s14, Inches(0.85), Inches(5.0), Inches(5.5), Inches(1.65),
                "QUY TẮC MỞ KHÓA (UNLOCK) KHI PHÁT HIỆN SAI SÓT",
                "• Nếu cán bộ trực lớp phát hiện ghi nhầm sĩ số hoặc thiếu giấy tờ sau khi đã bấm Khóa:\n• Cán bộ KHÔNG THỂ tự mở khóa.\n• Cán bộ phải liên hệ Phụ trách Tầng / Phụ trách Tòa nhà / Ban Quản trị đến kiểm tra biên bản gốc và bấm nút 'Mở khóa' trên thẻ lớp.")

    # Two stacked cards on the right
    create_card(s14, Inches(6.8), Inches(1.3), Inches(5.9), Inches(2.7), "1. Hộp thoại Xác nhận Niêm phong & Khóa Lớp")
    lock_modal_img = os.path.join(ARTIFACT_DIR, "lock_confirm_modal.png")
    add_fitted_image(s14, lock_modal_img, 7.0, 1.7, 5.5, 2.1)

    create_card(s14, Inches(6.8), Inches(4.15), Inches(5.9), Inches(2.75), "2. Banner Niêm phong & Nút Mở khóa của Cấp trên")
    lock_banner_img = os.path.join(ARTIFACT_DIR, "lock_banner_and_unlock_btn.png")
    add_fitted_image(s14, lock_banner_img, 7.0, 4.55, 5.5, 2.2)

    # =========================================================================
    # SLIDE 15: PHỤ TRÁCH TẦNG: GIÁM SÁT & THẨM QUYỀN MỞ KHÓA (UNLOCK)
    # =========================================================================
    s15 = prs.slides.add_slide(blank_layout)
    add_header(s15, "PHỤ TRÁCH TẦNG: GIÁM SÁT TẦNG & QUYỀN MỞ KHÓA", "TÁC NGHIỆP PHỤ TRÁCH TẦNG", ROLE_FLOOR_LEAD)
    add_footer(s15, 15)

    create_card(s15, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Trách nhiệm Điều hành Tầng & Thẩm quyền Mở khóa")
    add_bullets(s15, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Đăng nhập Tài khoản Phụ trách Tầng", "Hệ thống tự động kích hoạt quyền quản trị trên toàn bộ các phòng học và chi đoàn thuộc tầng được phân công."),
        ("[Bước 2] Theo dõi Tiến độ Tổng thể của Tầng", "Quan sát thanh thống kê tầng để nắm bắt: Có bao nhiêu lớp chưa họp, bao nhiêu lớp đang họp, bao nhiêu lớp đã xong, lớp nào bị chậm tiến độ."),
        ("[Bước 3] Điều phối Cán bộ Hỗ trợ Hiện trường", "Phát hiện các phòng có sĩ số đông hoặc thời gian bầu cử kéo dài để phân công thêm nhân sự hỗ trợ kiểm phiếu và kiểm tra hồ sơ."),
        ("[Bước 4] Thực hiện Thẩm quyền MỞ KHÓA (Unlock)", "Khi cán bộ trực lớp báo cáo sai số liệu cần sửa:\n1. Phụ trách Tầng trực tiếp kiểm tra biên bản giấy của chi đoàn.\n2. Nếu đúng, bấm nút 'Mở khóa' [🔓 Mở khóa] trên banner niêm phong.\n3. Hệ thống mở khóa tức thì, cho phép cán bộ trực cập nhật lại dữ liệu."),
        ("Quy định Phân cấp", "Nút 'Mở khóa' CHỈ hiển thị với Phụ trách Tầng, Phụ trách Tòa và Ban Quản trị. Cán bộ trực lớp bình thường không có nút này."),
    ], font_size=10.5, space_after=8)

    create_card(s15, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Giao diện Banner Khóa & Nút Mở khóa Phân quyền")
    add_fitted_image(s15, lock_banner_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s15, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Nút 'Mở khóa' độc quyền dành cho cấp quản lý để gỡ niêm phong khi cần sửa dữ liệu")

    # =========================================================================
    # SLIDE 16: PHỤ TRÁCH TÒA NHÀ & ĐƠN VỊ: ĐIỀU HÀNH CỤM PHÒNG
    # =========================================================================
    s16 = prs.slides.add_slide(blank_layout)
    add_header(s16, "PHỤ TRÁCH TÒA NHÀ & ĐƠN VỊ: ĐIỀU HÀNH CỤM PHÒNG", "TÁC NGHIỆP PHỤ TRÁCH TÒA", ROLE_UNIT_LEAD)
    add_footer(s16, 16)

    create_card(s16, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quy trình Điều hành Đơn vị & Cụm Tòa nhà")
    add_bullets(s16, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Bước 1] Chọn Đơn vị trên Thanh Sidebar", "Chọn Liên chi đoàn (VD: Trường Điện-Điện tử, Trường Cơ khí...) hoặc cụm Tòa nhà (Tòa D3, D5, D7...) phụ trách."),
        ("[Bước 2] Bao quát Bức tranh Toàn Tòa", "Theo dõi đồng thời tiến độ của tất cả các tầng học trong tòa nhà; quan sát tỷ lệ phần trăm hoàn thành chung của toàn đơn vị trên Topbar."),
        ("[Bước 3] Thẩm quyền Mở khóa Bao trùm", "Phụ trách Tòa nhà có quyền Mở khóa cho bất kỳ chi đoàn nào trong phạm vi tòa nhà/đơn vị khi Phụ trách Tầng vắng mặt hoặc bận việc."),
        ("[Bước 4] Báo cáo Ban Chỉ đạo Đại hội Trường", "Tổng hợp nhanh các trường hợp hủy đại hội hoặc chi đoàn phát sinh sự cố về nhân sự để báo cáo trực tiếp Thường trực Đoàn trường."),
        ("Gửi Thông báo Cấp Đơn vị", "Sử dụng tính năng thông báo để phát mệnh lệnh điều hành tới toàn bộ cán bộ trực trong tòa nhà cùng lúc."),
    ], font_size=10.5, space_after=8)

    create_card(s16, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Bảng Giám sát Đa tầng Toàn diện Toàn Tòa nhà")
    building_floors_img = os.path.join(ARTIFACT_DIR, "real_building_floors.png")
    add_fitted_image(s16, building_floors_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s16, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Bảng Giám sát Đa tầng Tòa D9: Theo dõi đồng thời từ Tầng 1 đến Tầng 10 và các phòng học")

    # =========================================================================
    # SLIDE 17: TRUNG TÂM THÔNG BÁO ĐA CẤP & CẢNH BÁO TỨC THỜI
    # =========================================================================
    s17 = prs.slides.add_slide(blank_layout)
    add_header(s17, "TRUNG TÂM THÔNG BÁO ĐA CẤP & CẢNH BÁO TỨC THỜI", "TRUYỀN THÔNG ĐIỀU HÀNH", ROLE_OFFICER)
    add_footer(s17, 17)

    create_card(s17, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quy trình Phát Thông báo & Nhận Cảnh báo Khẩn cấp")
    add_bullets(s17, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("[Bước 1] Mở Trung tâm Thông báo", "Bấm vào biểu tượng Chuông [🔔] trên Header. Nút có huy hiệu đỏ hiển thị số lượng tin nhắn chưa đọc."),
        ("[Bước 2] Chọn Phạm vi Phân cấp Phát thông báo", "Khi soạn thông báo, chọn đúng phạm vi:\n• Toàn trường: Chỉ Ban Quản trị Admin được gửi.\n• Một Tòa nhà: Dành cho Phụ trách Tòa nhà.\n• Một Tầng: Dành cho Phụ trách Tầng.\n• Cá nhân: Gửi đích danh cho 1 cán bộ cụ thể."),
        ("[Bước 3] Chọn Mức độ Ưu tiên", "Gồm 3 mức: Thông thường, Quan trọng và KHẨN CẤP (Urgent)."),
        ("[Bước 4] Cơ chế Pop-up Cảnh báo Khẩn cấp (Incoming Alert)", "Khi có thông báo 'Khẩn cấp', màn hình của người nhận sẽ lập tức bật Pop-up Cảnh báo màu đỏ rực kèm âm thanh, bảo đảm không ai bị sót tin."),
    ], font_size=10.0, space_after=6)

    add_callout(s17, Inches(0.85), Inches(5.1), Inches(5.5), Inches(1.55),
                "CÁC NÚT BẤM CHÍNH TRONG TRUNG TÂM THÔNG BÁO",
                "• Nút Chuông [🔔]: Mở danh sách thông báo và bộ đếm tin chưa đọc.\n• Tab 'Soạn thông báo': Dành cho cấp quản trị tạo tin điều hành.\n• Nút 'Phát thông báo ngay': Gửi tin tức thời qua Server-Sent Events dưới 0.1 giây.\n• Nút 'Đã hiểu và Đóng': Đóng pop-up cảnh báo khẩn cấp trên màn hình.")

    # Two stacked cards on the right
    create_card(s17, Inches(6.8), Inches(1.3), Inches(5.9), Inches(2.7), "1. Giao diện Soạn Thông báo Đa cấp")
    compose_img = os.path.join(ARTIFACT_DIR, "notif_desktop_compose.png")
    add_fitted_image(s17, compose_img, 7.0, 1.7, 5.5, 2.1)

    create_card(s17, Inches(6.8), Inches(4.15), Inches(5.9), Inches(2.75), "2. Pop-up Cảnh báo Khẩn cấp Tức thời")
    alert_img = os.path.join(ARTIFACT_DIR, "notif_incoming_alert.png")
    add_fitted_image(s17, alert_img, 7.0, 4.55, 5.5, 2.2)

    # =========================================================================
    # SLIDE 18: BAN QUẢN TRỊ [1]: QUẢN LÝ TÀI KHOẢN, PHÂN QUYỀN & MẬT KHẨU
    # =========================================================================
    s18 = prs.slides.add_slide(blank_layout)
    add_header(s18, "BAN QUẢN TRỊ [1]: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN", "QUẢN TRỊ HỆ THỐNG", ROLE_ADMIN)
    add_footer(s18, 18)

    create_card(s18, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Quản lý Nhân sự, Cấp lại Mật khẩu & Magic Link")
    add_bullets(s18, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("[Bước 1] Truy cập Trang Quản lý", "Admin bấm vào mục 'Quản lý (Manage)' trên menu điều hướng để vào trung tâm điều hành nhân sự."),
        ("[Bước 2] Thêm Cán bộ & Phân quyền", "Bấm nút 'Thêm Cán bộ', nhập email @sis.hust.edu.vn và chọn vai trò (Cán bộ trực lớp, Phụ trách Tầng, Phụ trách Tòa nhà, Admin)."),
        ("[Bước 3] Phân công Phòng học & Tầng nhà", "Gán danh sách các chi đoàn hoặc tầng cụ thể mà cán bộ đó được phép phụ trách chỉnh sửa."),
        ("[Bước 4] Nút Đặt lại Mật khẩu [KeyRound]", "Khi cán bộ quên mật khẩu, Admin bấm nút biểu tượng Chìa khóa để khôi phục mật khẩu mặc định ngay lập tức."),
    ], font_size=10.0, space_after=6)

    add_callout(s18, Inches(0.85), Inches(4.9), Inches(5.5), Inches(1.75),
                "TÍNH NĂNG ĐĂNG NHẬP 1-CHẠM (MAGIC LINK) & BẢO VỆ TÀI KHOẢN",
                "• NÚT TẠO LINK [Link]: Admin bấm tạo link đăng nhập nhanh 1-chạm gửi qua Zalo. Cán bộ chỉ cần chạm vào link là tự động đăng nhập đúng quyền mà không cần gõ mật khẩu.\n• BẢO VỆ TÀI KHOẢN ADMIN: Hệ thống khóa cứng, không ai có thể xóa tài khoản Quản trị viên vĩnh viễn (bach.pv2414676@sis.hust.edu.vn).")

    create_card(s18, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Giao diện Quản trị Nhân sự & Phân quyền Cán bộ")
    manage_img = os.path.join(ARTIFACT_DIR, "real_manage_users_page.png")
    add_fitted_image(s18, manage_img, 7.0, 1.8, 5.5, 4.4)
    add_caption(s18, Inches(7.0), Inches(6.4), Inches(5.5), Inches(0.4), "Trung tâm Quản trị Cán bộ: Phân cấp vai trò, Magic Link 1-chạm & Đặt lại mật khẩu")

    # =========================================================================
    # SLIDE 19: BAN QUẢN TRỊ [2]: MA TRẬN TIẾN ĐỘ, EXCEL & AUDIT LOGS
    # =========================================================================
    s19 = prs.slides.add_slide(blank_layout)
    add_header(s19, "BAN QUẢN TRỊ [2]: MA TRẬN TIẾN ĐỘ, EXCEL & AUDIT LOGS", "QUẢN TRỊ HỆ THỐNG", ROLE_ADMIN)
    add_footer(s19, 19)

    create_card(s19, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Ma trận Tổng thể, Nhập Excel & Nhật ký Hoạt động (Logs)")
    add_bullets(s19, Inches(0.85), Inches(1.8), Inches(5.5), Inches(3.6), [
        ("Bảng Thống kê Ma trận Tổng thể", "Bảng ma trận tổng hợp đa chiều tỷ lệ hoàn thành theo từng Khoa/Viện/Trường, phục vụ báo cáo nhanh cho Ban Thường vụ Đoàn trường."),
        ("Nút Nhập Danh sách từ Excel", "Admin có thể tải file danh sách phòng học, chi đoàn và phân công cán bộ từ Excel để khởi tạo tự động 500+ lớp chỉ trong 3 giây."),
        ("NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS) TRÊN SIDEBAR", "Mục 'Nhật ký hoạt động' nằm ở thanh Sidebar (hỗ trợ cả giao diện PC và Mobile dạng Card)."),
        ("Truy vết Minh bạch Mọi Thao tác", "Ghi nhận đầy đủ: Ai thao tác (email/tên), Lúc mấy giờ (giờ:phút:giây), Ở lớp nào, Hành động gì (Sửa sĩ số, Tick checklist, Lưu, Khóa, Mở khóa, Hủy đại hội)."),
    ], font_size=10.0, space_after=6)

    add_callout(s19, Inches(0.85), Inches(5.0), Inches(5.5), Inches(1.65),
                "GIÁ TRỊ KIỂM TOÁN CỦA HỆ THỐNG AUDIT LOGS",
                "• Không thể chối bỏ: Mọi hành vi sửa đổi dữ liệu đều được lưu vết vĩnh viễn trong cơ sở dữ liệu SQLite ACID.\n• Phát hiện gian lận: Cảnh báo ngay nếu có sự can thiệp trái phép hoặc sửa đổi sau giờ bế mạc.\n• Tối ưu Mobile: Cán bộ quản lý xem nhật ký dạng thẻ vuốt mượt mà trên điện thoại.")

    # Two stacked cards on the right
    create_card(s19, Inches(6.8), Inches(1.3), Inches(5.9), Inches(2.7), "1. Nhật ký Hoạt động (Audit Logs) trên Desktop")
    audit_img = os.path.join(ARTIFACT_DIR, "audit_logs.png")
    add_fitted_image(s19, audit_img, 7.0, 1.7, 5.5, 2.1)

    create_card(s19, Inches(6.8), Inches(4.15), Inches(5.9), Inches(2.75), "2. Nhật ký Hoạt động Dạng Card trên Mobile")
    mobile_audit_img = os.path.join(ARTIFACT_DIR, "mobile_audit_logs_cards.png")
    add_fitted_image(s19, mobile_audit_img, 7.0, 4.55, 5.5, 2.2)

    # =========================================================================
    # SLIDE 20: QUY TRÌNH XỬ LÝ SỰ CỐ & ĐẦU MỐI TRỰC CHỈ HUY
    # =========================================================================
    s20 = prs.slides.add_slide(blank_layout)
    add_header(s20, "QUY TRÌNH XỬ LÝ SỰ CỐ HIỆN TRƯỜNG & ĐẦU MỐI CHỈ HUY", "VẬN HÀNH KHẨN CẤP", ROLE_ALL)
    add_footer(s20, 20)

    create_card(s20, Inches(0.6), Inches(1.3), Inches(6.0), Inches(5.6), "Kịch bản 4 Tình huống Sự cố Thường gặp & Cách Xử lý")
    add_bullets(s20, Inches(0.85), Inches(1.8), Inches(5.5), Inches(4.8), [
        ("[Tình huống 1] Mất mạng Wifi / Sóng 4G yếu", "Hệ thống hỗ trợ cơ chế Optimistic UI và Offline-first. Cán bộ vẫn thao tác tick checklist và nhập điểm danh bình thường trên màn hình. Khi có mạng trở lại, hệ thống sẽ tự động đồng bộ ngay lập tức."),
        ("[Tình huống 2] Chi đoàn Không đủ 2/3 Sĩ số", "Báo ngay Phụ trách Tầng. Chi đoàn được phép chờ tối đa 15-30 phút để tập hợp thêm đoàn viên. Nếu vẫn không đủ: Báo cáo Thường trực xin ý kiến, chuyển trạng thái sang 'Hủy đại hội' và nhập rõ lý do hoãn."),
        ("[Tình huống 3] Lớp đã Khóa nhưng Cần sửa Số liệu", "Cán bộ trực lớp liên hệ Phụ trách Tầng hoặc Phụ trách Tòa nhà đến đối soát biên bản gốc tại chỗ. Cấp trên bấm nút 'Mở khóa' trên thẻ lớp để cho phép chỉnh sửa."),
        ("[Tình huống 4] Quên mật khẩu / Không vào được hệ thống", "Liên hệ Ban Quản trị qua nhóm Zalo Điều hành hoặc Hotline để nhận Magic Link đăng nhập nhanh 1-chạm mà không cần gõ mật khẩu."),
    ], font_size=10.5, space_after=8)

    create_card(s20, Inches(6.8), Inches(1.3), Inches(5.9), Inches(5.6), "Đầu mối Trực Điều hành & Hỗ trợ Kỹ thuật 24/7", bg_color=RGBColor(254, 242, 242), border_color=RGBColor(248, 113, 113))
    add_bullets(s20, Inches(7.1), Inches(1.8), Inches(5.3), Inches(4.8), [
        ("Cơ quan Thường trực", "Ban Tổ chức - Kiểm tra Đoàn Thanh niên Đại học Bách khoa Hà Nội."),
        ("Trụ sở Trực Điều hành Hiện trường", "Phòng 104 nhà B1 - Trụ sở Văn phòng Đoàn Thanh niên - Hội Sinh viên ĐHBK Hà Nội."),
        ("Hotline Kỹ thuật Hệ thống", "Đ/c Kiều Minh Anh — SĐT: 0366.329.799 (Hỗ trợ 24/7 trong suốt các kíp đại hội)."),
        ("Kênh Điều hành Trực tuyến", "Nhóm Zalo: 'Điều hành Đại hội Chi đoàn ĐHBK Hà Nội 2026'."),
        ("Cổng thông tin Trực tuyến", "https://event-tracker-pied.vercel.app/"),
        ("Lời chúc Đại hội", "CHÚC CÁC CHI ĐOÀN TỔ CHỨC ĐẠI HỘI THÀNH CÔNG RỰC RỠ, CHUẨN MỰC VÀ ĐÚNG ĐIỀU LỆ ĐOÀN!"),
    ], font_size=11.0, space_after=12)

    emblem_path = os.path.join(ARTIFACT_DIR, "emblem_preview.png")
    if os.path.exists(emblem_path):
        s20.shapes.add_picture(emblem_path, Inches(10.8), Inches(5.1), width=Inches(1.5), height=Inches(1.5))

    # Save to both target file and artifact file
    prs.save(OUTPUT_PPTX)
    prs.save(OUTPUT_PPTX_ARTIFACT)
    print(f"XUẤT BỘ TRÌNH CHIẾU 20 SLIDES THÀNH CÔNG:")
    print(f"  1. File chính: {OUTPUT_PPTX} ({os.path.getsize(OUTPUT_PPTX)} bytes)")
    print(f"  2. File bản sao Artifact: {OUTPUT_PPTX_ARTIFACT} ({os.path.getsize(OUTPUT_PPTX_ARTIFACT)} bytes)")


if __name__ == '__main__':
    build_presentation()
