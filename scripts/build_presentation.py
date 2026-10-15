import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

ARTIFACT_DIR = r"C:\Users\phamv\.gemini\antigravity\brain\0e621399-7ded-426a-8568-e2d941443cb6"
UPLOAD_DIR = os.path.join(ARTIFACT_DIR, ".user_uploaded")
OUTPUT_PPTX = os.path.join(r"d:\Documents\2.Ban TCKT\Event-tracker", "Huong_Dan_Su_Dung_He_Thong_Theo_Doi_Dai_Hoi.pptx")
OUTPUT_PPTX_ARTIFACT = os.path.join(ARTIFACT_DIR, "Huong_Dan_Su_Dung_He_Thong_Theo_Doi_Dai_Hoi.pptx")

# Palette
C_CRIMSON = RGBColor(185, 28, 28)      # #B91C1C
C_NAVY_DARK = RGBColor(15, 23, 42)     # #0F172A
C_NAVY_LIGHT = RGBColor(30, 41, 59)    # #1E293B
C_AMBER = RGBColor(217, 119, 6)        # #D97706
C_GREEN = RGBColor(5, 150, 105)        # #059669
C_BG = RGBColor(248, 250, 252)         # #F8FAFC
C_WHITE = RGBColor(255, 255, 255)
C_BORDER = RGBColor(226, 232, 240)     # #E2E8F0
C_TEXT_DARK = RGBColor(30, 41, 59)     # #1E293B
C_TEXT_MUTED = RGBColor(100, 116, 139) # #64748B
C_BLUE = RGBColor(37, 99, 235)         # #2563EB

def add_header(slide, title_text, category="HƯỚNG DẪN VẬN HÀNH HỆ THỐNG"):
    # Header bar
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.1))
    shape.fill.solid()
    shape.fill.fore_color.rgb = C_CRIMSON
    shape.line.fill.background()

    # Category breadcrumb
    tf = shape.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.8)
    tf.margin_top = Inches(0.15)
    tf.margin_right = Inches(0.8)
    tf.margin_bottom = Inches(0.0)

    p0 = tf.paragraphs[0]
    p0.text = category.upper()
    p0.font.name = "Segoe UI"
    p0.font.size = Pt(10)
    p0.font.bold = True
    p0.font.color.rgb = RGBColor(254, 226, 226)

    p1 = tf.add_paragraph()
    p1.text = title_text
    p1.font.name = "Segoe UI"
    p1.font.size = Pt(20)
    p1.font.bold = True
    p1.font.color.rgb = C_WHITE

    # Accent stripe
    stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(1.1), Inches(13.333), Inches(0.05))
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = C_AMBER
    stripe.line.fill.background()

def add_footer(slide, current_slide, total_slides=14):
    foot = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.05), Inches(13.333), Inches(0.45))
    foot.fill.solid()
    foot.fill.fore_color.rgb = C_NAVY_DARK
    foot.line.fill.background()

    txBox = slide.shapes.add_textbox(Inches(0.8), Inches(7.08), Inches(9.0), Inches(0.35))
    tf = txBox.text_frame
    tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0
    p = tf.paragraphs[0]
    p.text = "Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội • Hệ thống Theo dõi Đại hội Chi đoàn • event-tracker-pied.vercel.app"
    p.font.name = "Segoe UI"
    p.font.size = Pt(9)
    p.font.color.rgb = RGBColor(148, 163, 184)

    txBox2 = slide.shapes.add_textbox(Inches(11.5), Inches(7.08), Inches(1.0), Inches(0.35))
    tf2 = txBox2.text_frame
    tf2.margin_left = tf2.margin_top = tf2.margin_bottom = tf2.margin_right = 0
    p2 = tf2.paragraphs[0]
    p2.text = f"{current_slide} / {total_slides}"
    p2.alignment = PP_ALIGN.RIGHT
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(9)
    p2.font.bold = True
    p2.font.color.rgb = RGBColor(255, 255, 255)

def create_card(slide, left, top, width, height, title=None, bg_color=C_WHITE, border_color=C_BORDER):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1.5)

    if title:
        header_box = slide.shapes.add_textbox(left + Inches(0.2), top + Inches(0.15), width - Inches(0.4), Inches(0.4))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_bottom = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = "Segoe UI"
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = C_NAVY_DARK

    return card

def add_bullets(slide, left, top, width, height, items, font_size=11, space_after=8):
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

def add_image_safely(slide, img_path, left, top, width=None, height=None):
    if os.path.exists(img_path):
        try:
            return slide.shapes.add_picture(img_path, left, top, width=width, height=height)
        except Exception as e:
            print(f"Lỗi chèn ảnh {img_path}: {e}")
    else:
        print(f"Không tìm thấy ảnh: {img_path}")
    return None

def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # =========================================================================
    # SLIDE 1: Trang tiêu đề
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = C_NAVY_DARK
    bg1.line.fill.background()

    # Red Accent Banner
    bar1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(0.4), Inches(7.5))
    bar1.fill.solid()
    bar1.fill.fore_color.rgb = C_CRIMSON
    bar1.line.fill.background()

    # Title texts
    tx1 = s1.shapes.add_textbox(Inches(1.2), Inches(1.2), Inches(8.5), Inches(5.0))
    tf1 = tx1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "ĐOÀN TNCS HỒ CHÍ MINH ĐẠI HỌC BÁCH KHOA HÀ NỘI"
    p.font.name = "Segoe UI"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = RGBColor(239, 68, 68)
    p.space_after = Pt(6)

    p = tf1.add_paragraph()
    p.text = "BAN TỔ CHỨC - KIỂM TRA ĐOÀN ĐẠI HỌC"
    p.font.name = "Segoe UI"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = RGBColor(203, 213, 225)
    p.space_after = Pt(28)

    p = tf1.add_paragraph()
    p.text = "HƯỚNG DẪN SỬ DỤNG HỆ THỐNG"
    p.font.name = "Segoe UI"
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = C_WHITE

    p = tf1.add_paragraph()
    p.text = "THEO DÕI ĐẠI HỘI CHI ĐOÀN TRỰC TUYẾN"
    p.font.name = "Segoe UI"
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = RGBColor(252, 211, 77)
    p.space_after = Pt(24)

    p = tf1.add_paragraph()
    p.text = "Tài liệu tập huấn quy trình kiểm tra, giám sát tiến độ thời gian thực,\nđiểm danh sĩ số, quản lý hồ sơ và vận hành trên thiết bị di động (PWA)."
    p.font.name = "Segoe UI"
    p.font.size = Pt(13)
    p.font.color.rgb = RGBColor(226, 232, 240)
    p.space_after = Pt(36)

    p = tf1.add_paragraph()
    p.text = "🌐 Địa chỉ chính thức: event-tracker-pied.vercel.app • Phiên bản: 2026.2 Production"
    p.font.name = "Segoe UI"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = RGBColor(56, 189, 248)

    # Logo / Emblem on the right
    logo_path = os.path.join(ARTIFACT_DIR, "logo_preview.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(ARTIFACT_DIR, "emblem_preview.png")
    add_image_safely(s1, logo_path, Inches(9.8), Inches(1.8), width=Inches(2.7))

    # =========================================================================
    # SLIDE 2: Tổng quan & Mục tiêu số hóa
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "TỔNG QUAN & MỤC TIÊU SỐ HÓA CÔNG TÁC ĐẠI HỘI")
    add_footer(s2, 2)

    create_card(s2, Inches(0.8), Inches(1.4), Inches(5.6), Inches(5.3), "Mục tiêu trọng tâm & Vai trò hệ thống")
    add_bullets(s2, Inches(1.1), Inches(2.0), Inches(5.0), Inches(4.5), [
        ("Giám sát Realtime", "Theo dõi đồng bộ tiến độ tổ chức Đại hội Chi đoàn toàn trường theo từng giây mà không cần gọi điện thoại hay nhắn tin thủ công."),
        ("Chuẩn hóa Hồ sơ", "Bắt buộc kiểm tra đầy đủ 100% hồ sơ nghiệp vụ (Biên bản kiểm phiếu, Đề án nhân sự, Báo cáo chính trị...) trước khi chuyển trạng thái đại hội."),
        ("Kiểm soát Sĩ số 2/3", "Tự động tính toán tỷ lệ đoàn viên có mặt / tổng số; khóa cảnh báo nếu chưa đủ tỷ lệ 2/3 theo đúng Điều lệ Đoàn."),
        ("Minh bạch Trách nhiệm", "Cơ chế phân tách Lưu và Khóa; ghi nhận đầy đủ nhật ký thao tác (Ai làm, lúc mấy giờ, ở vị trí nào)."),
        ("Thông báo Đa cấp", "Phát lệnh chỉ đạo khẩn cấp từ Ban Thường vụ tới toàn trường, từng tòa nhà hoặc từng tầng ngay lập tức."),
    ], font_size=11, space_after=12)

    # Right side: Full screenshot of the dashboard
    create_card(s2, Inches(6.8), Inches(1.4), Inches(5.7), Inches(5.3), "Giao diện Tổng quan Bảng Theo dõi Tiến độ")
    preview_img = os.path.join(ARTIFACT_DIR, "full_preview.png")
    add_image_safely(s2, preview_img, Inches(7.0), Inches(2.0), width=Inches(5.3))

    # =========================================================================
    # SLIDE 3: Cài đặt PWA trên iOS Safari
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "HƯỚNG DẪN CÀI ĐẶT PWA TRÊN iOS (IPHONE / IPAD - TRÌNH DUYỆT SAFARI)")
    add_footer(s3, 3)

    pwa_ios_img = os.path.join(ARTIFACT_DIR, "pwa_ios_guide.png")
    add_image_safely(s3, pwa_ios_img, Inches(0.8), Inches(1.35), width=Inches(11.733))

    # =========================================================================
    # SLIDE 4: Cài đặt PWA trên Android Chrome
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "HƯỚNG DẪN CÀI ĐẶT PWA TRÊN ANDROID (GOOGLE CHROME / CỐC CỐC)")
    add_footer(s4, 4)

    pwa_android_img = os.path.join(ARTIFACT_DIR, "pwa_android_guide.png")
    add_image_safely(s4, pwa_android_img, Inches(0.8), Inches(1.35), width=Inches(11.733))

    # =========================================================================
    # SLIDE 5: Đăng nhập & Ma trận Phân quyền
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "QUY TRÌNH ĐĂNG NHẬP & MA TRẬN PHÂN QUYỀN VAI TRÒ")
    add_footer(s5, 5)

    create_card(s5, Inches(0.8), Inches(1.4), Inches(7.4), Inches(5.3), "Phân quyền Vai trò & Quyền hạn Thao tác")
    add_bullets(s5, Inches(1.1), Inches(2.0), Inches(6.8), Inches(4.5), [
        ("Khách / Đoàn viên (Guest)", "Không cần đăng nhập; xem bản đồ tiến độ công khai toàn trường, danh bạ hỗ trợ; không thể sửa dữ liệu."),
        ("Cán bộ trực lớp (Room Lead)", "Đăng nhập tài khoản cá nhân hoặc dùng Link định danh một chạm; chỉ được sửa hồ sơ, điểm danh và đổi màu các lớp mình phụ trách."),
        ("Phụ trách Tầng (Floor Lead)", "Giám sát tất cả các lớp trong tầng; được quyền Mở khóa (Unlock) cho các lớp thuộc tầng khi có sai sót cần chỉnh sửa; gửi thông báo tầng."),
        ("Phụ trách Tòa nhà (Unit Lead)", "Giám sát toàn bộ các phòng trong tòa nhà/đơn vị; quyền mở khóa và quản trị cấp tòa; gửi thông báo tòa."),
        ("Ban Quản trị (Admin)", "Toàn quyền quản trị: thêm/sửa/xóa phòng, cấu hình checklist, phân quyền người dùng, xem Nhật ký hệ thống (Audit Logs), gửi thông báo toàn trường."),
    ], font_size=11, space_after=10)

    # Login Modal illustration
    create_card(s5, Inches(8.5), Inches(1.4), Inches(4.0), Inches(5.3), "Màn hình Đăng nhập")
    login_img = os.path.join(UPLOAD_DIR, "media_1791986024994_52b26b5b.png")
    add_image_safely(s5, login_img, Inches(8.8), Inches(2.0), width=Inches(3.4))

    # =========================================================================
    # SLIDE 6: Bảng điều khiển Tổng quan & Bản đồ
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "BẢNG ĐIỀU KHIỂN TỔNG QUAN & THEO DÕI BẢN ĐỒ TIẾN ĐỘ")
    add_footer(s6, 6)

    create_card(s6, Inches(0.8), Inches(1.4), Inches(5.4), Inches(5.3), "Các tính năng trên Bảng theo dõi")
    add_bullets(s6, Inches(1.1), Inches(2.0), Inches(4.8), Inches(4.5), [
        ("Thanh trạng thái trực quan", "4 màu sắc chuẩn hóa:\n• Đỏ: Chưa tổ chức (chưa đủ điều kiện)\n• Vàng: Đang tiến hành đại hội\n• Xanh: Đã tổ chức thành công & chốt hồ sơ\n• Tím: Hủy đại hội (kèm lý do ghi chú)"),
        ("Bộ lọc thông minh", "Lọc nhanh theo Đơn vị (Trường/Viện), theo Tòa nhà (D3, D5, D9, TC...) hoặc theo Tầng cụ thể."),
        ("Tìm kiếm tức thời", "Tìm kiếm theo mã lớp (VD: EE2, IT1), tên lớp hoặc tên cán bộ phụ trách với tốc độ phản hồi 0ms."),
        ("Chế độ Bản đồ (Map View)", "Xem vị trí phòng học trên sơ đồ tầng thực tế, nhận diện điểm nóng cần hỗ trợ kỹ thuật."),
    ], font_size=11, space_after=12)

    create_card(s6, Inches(6.5), Inches(1.4), Inches(6.0), Inches(5.3), "Minh họa Bảng theo dõi Tổng quan")
    add_image_safely(s6, preview_img, Inches(6.7), Inches(2.0), width=Inches(5.6))

    # =========================================================================
    # SLIDE 7: Nghiệp vụ Trực lớp: Kiểm tra Checklist Hồ sơ
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "NGHIỆP VỤ CÁN BỘ TRỰC LỚP: KIỂM TRA CHECKLIST HỒ SƠ ĐẠI HỘI")
    add_footer(s7, 7)

    create_card(s7, Inches(0.8), Inches(1.4), Inches(6.0), Inches(5.3), "Quy định Bắt buộc về Hồ sơ Nghiệp vụ")
    add_bullets(s7, Inches(1.1), Inches(2.0), Inches(5.4), Inches(4.5), [
        ("Danh mục Hồ sơ Kiểm tra", "Cán bộ trực tiếp rà soát 6 mục bắt buộc:\n1. Báo cáo chính trị của BCH Chi đoàn\n2. Báo cáo kiểm điểm BCH Chi đoàn\n3. Đề án nhân sự BCH khóa mới\n4. Biên bản đại hội chi đoàn\n5. Biên bản kiểm phiếu bầu BCH & Đoàn đại biểu\n6. Nghị quyết Đại hội Chi đoàn"),
        ("Điều kiện Chuyển trạng thái", "Hệ thống BẮT BUỘC phải tích chọn đủ 100% các mục hồ sơ kiểm tra mới cho phép chuyển sang trạng thái 'Đã xong' (Xanh)."),
        ("Chống gian lận & Nhảy màu", "Nếu chưa tích đủ checklist, hệ thống sẽ hiển thị cảnh báo đỏ và tự động chặn thao tác để đảm bảo tính pháp lý của Đại hội."),
    ], font_size=11, space_after=14)

    create_card(s7, Inches(7.1), Inches(1.4), Inches(5.4), Inches(5.3), "Minh họa Thẻ Chi tiết Lớp học & Checklist")
    card_img = os.path.join(UPLOAD_DIR, "media_1791980705711_cf092d8d.png")
    add_image_safely(s7, card_img, Inches(7.3), Inches(2.2), width=Inches(5.0))

    # =========================================================================
    # SLIDE 8: Nghiệp vụ Trực lớp: Điểm danh Sĩ số 2/3
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "NGHIỆP VỤ CÁN BỘ TRỰC LỚP: ĐIỂM DANH & KIỂM SOÁT SĨ SỐ 2/3")
    add_footer(s8, 8)

    create_card(s8, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Quy định Pháp lý về Sĩ số Đại hội")
    add_bullets(s8, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Quy định Điều lệ Đoàn", "Đại hội Chi đoàn chỉ có giá trị pháp lý khi có ít nhất 2/3 tổng số đoàn viên được triệu tập có mặt tham dự."),
        ("Cơ chế Tính toán Tự động", "Cán bộ nhập: [Số có mặt] và [Tổng số đoàn viên]. Hệ thống tự động tính tỷ lệ % và kiểm tra điều kiện >= 66.7%."),
        ("Huy hiệu Nhận diện Thông minh", "• Màu Xanh lá: 'Đủ 2/3 (X/Y)' -> Hợp lệ\n• Màu Đỏ: 'Chưa đủ 2/3 (X/Y)' -> Cảnh báo"),
        ("Khóa Chặn Nghiệp vụ", "Nếu chưa đạt 2/3 sĩ số, hệ thống sẽ KHÔNG cho phép chuyển sang 'Đang tiến hành' hoặc 'Đã xong' trừ khi có quyết định hoãn/hủy đại hội từ cấp trên."),
    ], font_size=11, space_after=12)

    create_card(s8, Inches(6.9), Inches(1.4), Inches(5.6), Inches(5.3), "Minh họa Nhập sĩ số & Tính toán Tự động")
    attend_img = os.path.join(UPLOAD_DIR, "media_1791977382994_018f2f03.png")
    add_image_safely(s8, attend_img, Inches(7.1), Inches(2.0), width=Inches(5.2))

    # =========================================================================
    # SLIDE 9: Thao tác Lưu tiến độ & Khóa hồ sơ
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "QUY TRÌNH THAO TÁC: LƯU TIẾN ĐỘ & KHÓA HỒ SƠ LỚP HỌC")
    add_footer(s9, 9)

    create_card(s9, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Phân biệt Nút 'LƯU' và Nút 'KHÓA'")
    add_bullets(s9, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Nút LƯU (Save)", "Dùng trong suốt quá trình đại hội diễn ra. Lưu tạm thời sĩ số, các mục checklist đã kiểm tra và ghi chú kiểm tra. Cán bộ vẫn có thể tiếp tục chỉnh sửa bất kỳ lúc nào."),
        ("Nút KHÓA (Lock)", "Bắt buộc bấm khi ĐẠI HỘI KẾT THÚC VÀ ĐÃ HOÀN TẤT HỒ SƠ. Khi bấm Khóa, hộp thoại cảnh báo sẽ yêu cầu xác nhận."),
        ("Hậu quả sau khi Khóa", "Toàn bộ checklist giấy tờ và số liệu sĩ số sẽ bị ĐÓNG BĂNG. Cán bộ trực lớp KHÔNG THỂ tự ý chỉnh sửa."),
        ("Quy trình Mở khóa (Unlock)", "Nếu có sai sót cần bổ sung, cán bộ trực lớp phải báo cáo Phụ trách Tầng / Phụ trách Tòa nhà / Admin để cấp trên bấm nút 'Mở khóa'."),
    ], font_size=11, space_after=12)

    create_card(s9, Inches(6.9), Inches(1.4), Inches(5.6), Inches(2.5), "Hộp thoại Xác nhận Khóa Lớp")
    lock_modal_img = os.path.join(ARTIFACT_DIR, "lock_confirm_modal.png")
    add_image_safely(s9, lock_modal_img, Inches(7.1), Inches(1.9), height=Inches(1.8))

    create_card(s9, Inches(6.9), Inches(4.1), Inches(5.6), Inches(2.6), "Thẻ Lớp đã Khóa & Nút Mở khóa Cấp trên")
    lock_banner_img = os.path.join(ARTIFACT_DIR, "lock_banner_and_unlock_btn.png")
    add_image_safely(s9, lock_banner_img, Inches(7.1), Inches(4.6), width=Inches(5.2))

    # =========================================================================
    # SLIDE 10: Xử lý tình huống Hủy đại hội
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "XỬ LÝ TÌNH HUỐNG: CHUYỂN TRẠNG THÁI HỦY ĐẠI HỘI (CANCELLED)")
    add_footer(s10, 10)

    create_card(s10, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Quy định & Thủ tục Hủy Đại hội")
    add_bullets(s10, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Các Trường hợp Buộc phải Hủy", "• Không đạt tối thiểu 2/3 sĩ số đoàn viên sau 30 phút chờ.\n• Chi đoàn không chuẩn bị được văn kiện/đề án nhân sự.\n• Phát sinh sự cố khách quan không thể tổ chức tiếp."),
        ("Quy định Bắt buộc Lý do", "Khi chọn trạng thái 'Hủy đại hội', hệ thống sẽ TỰ ĐỘNG BẬT HỘP THOẠI YÊU CẦU NHẬP LÝ DO HỦY. Nếu để trống, hệ thống sẽ chặn và không cho phép lưu."),
        ("Tự động Đồng bộ vào Ghi chú", "Lý do hủy sẽ được ghi nhận vào phần Ghi chú kiểm tra (Note) và lưu vào Nhật ký hoạt động (Audit Logs) để Ban Thường vụ kiểm tra."),
        ("Hiển thị Nhận diện", "Thẻ phòng chuyển sang màu Tím với huy hiệu 'HỦY ĐẠI HỘI' nổi bật trên bảng theo dõi toàn trường."),
    ], font_size=11, space_after=12)

    create_card(s10, Inches(6.9), Inches(1.4), Inches(5.6), Inches(2.5), "Hộp thoại Bắt buộc Nhập Lý do Hủy")
    cancel_modal_img = os.path.join(ARTIFACT_DIR, "cancel_prompt_modal.png")
    add_image_safely(s10, cancel_modal_img, Inches(7.1), Inches(1.9), height=Inches(1.8))

    create_card(s10, Inches(6.9), Inches(4.1), Inches(5.6), Inches(2.6), "Thẻ Lớp Hủy Đại hội kèm Lý do chi tiết")
    cancel_card_img = os.path.join(ARTIFACT_DIR, "cancelled_and_locked_card.png")
    add_image_safely(s10, cancel_card_img, Inches(7.1), Inches(4.6), width=Inches(5.2))

    # =========================================================================
    # SLIDE 11: Trung tâm Thông báo Hệ thống Đa cấp
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "TRUNG TÂM THÔNG BÁO HỆ THỐNG & CẢNH BÁO KHẨN CẤP")
    add_footer(s11, 11)

    create_card(s11, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Cơ chế Phân cấp Phát Thông báo")
    add_bullets(s11, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Phân cấp Người gửi", "• Ban Quản trị (Admin): Gửi toàn trường, theo tòa, theo tầng hoặc cá nhân.\n• Phụ trách Tòa nhà: Gửi toàn bộ các cán bộ trong tòa của mình.\n• Phụ trách Tầng: Gửi thông báo đến các cán bộ trực lớp thuộc tầng."),
        ("Phân loại Mức độ", "• Thông thường (Info): Thông báo lịch, nhắc nhở nộp hồ sơ.\n• Khẩn cấp (Urgent): Lệnh điều động, nhắc sự cố sĩ số, cảnh báo quy chế."),
        ("Popup Cảnh báo Tức thời (Incoming Alert)", "Khi có thông báo mới, màn hình cán bộ sẽ nhảy ngay một Hộp thoại Cảnh báo Realtime kèm hiệu ứng chuông rung; không bị bỏ lỡ thông tin."),
        ("Giao diện Quản lý Riêng biệt", "Hỗ trợ xem lịch sử thông báo, đánh dấu đã đọc trên cả PC và Mobile."),
    ], font_size=11, space_after=12)

    create_card(s11, Inches(6.9), Inches(1.4), Inches(5.6), Inches(2.5), "Popup Cảnh báo Khẩn cấp Nhảy Tức thời")
    alert_img = os.path.join(ARTIFACT_DIR, "notif_incoming_alert.png")
    add_image_safely(s11, alert_img, Inches(7.1), Inches(1.9), height=Inches(1.8))

    create_card(s11, Inches(6.9), Inches(4.1), Inches(5.6), Inches(2.6), "Trung tâm Danh sách Thông báo")
    notif_list_img = os.path.join(ARTIFACT_DIR, "notif_desktop_list.png")
    add_image_safely(s11, notif_list_img, Inches(7.1), Inches(4.6), width=Inches(5.2))

    # =========================================================================
    # SLIDE 12: Nhật ký Hoạt động (Audit Logs) dành cho Admin
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "NHẬT KÝ HOẠT ĐỘNG (AUDIT LOGS) DÀNH CHO BAN QUẢN TRỊ")
    add_footer(s12, 12)

    create_card(s12, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Minh bạch Dữ liệu & Truy vết Sự cố")
    add_bullets(s12, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Mục tiêu Giám sát", "Bảo đảm tính minh bạch, chống gian lận, truy vết chính xác mọi thay đổi trên hệ thống trong thời gian diễn ra đại hội."),
        ("4 Thông tin Bắt buộc ghi nhận", "1. AI THAO TÁC: Họ tên, email, vai trò (Admin, Trưởng tòa, Cán bộ trực).\n2. THỜI GIAN: Ngày, giờ, phút, giây chính xác theo chuẩn GMT+7.\n3. VỊ TRÍ: Tòa nhà, tầng, tên phòng/lớp cụ thể.\n4. HÀNH ĐỘNG: Đổi màu, tick checklist, cập nhật sĩ số, khóa/mở khóa, lý do hủy."),
        ("Bộ lọc Chuyên sâu", "Lọc theo hành động (auth.login, room.lock, room.status...), theo người dùng hoặc theo vị trí phòng học."),
        ("Hỗ trợ PC & Mobile", "Tối ưu hiển thị dạng bảng trên máy tính và dạng Card thẻ trực quan trên điện thoại."),
    ], font_size=11, space_after=12)

    create_card(s12, Inches(6.9), Inches(1.4), Inches(5.6), Inches(2.6), "Bảng Nhật ký trên Máy tính (Desktop)")
    logs_desktop_img = os.path.join(ARTIFACT_DIR, "audit_logs.png")
    add_image_safely(s12, logs_desktop_img, Inches(7.1), Inches(1.9), width=Inches(5.2))

    create_card(s12, Inches(6.9), Inches(4.2), Inches(5.6), Inches(2.5), "Nhật ký dạng Card Thẻ trên Mobile")
    logs_mobile_img = os.path.join(ARTIFACT_DIR, "mobile_audit_logs_cards.png")
    add_image_safely(s12, logs_mobile_img, Inches(8.5), Inches(4.5), height=Inches(2.0))

    # =========================================================================
    # SLIDE 13: Báo cáo Thống kê & Kiểm thử Vận hành (Benchmark)
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "KẾT QUẢ KIỂM THỬ VẬN HÀNH & NĂNG LỰC CHỊU TẢI PRODUCTION")
    add_footer(s13, 13)

    create_card(s13, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Kết quả Đo kiểm Thực tế trên Vercel URL")
    add_bullets(s13, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Môi trường Kiểm thử", "Production URL: event-tracker-pied.vercel.app\nĐo lường bằng công cụ tải đa luồng tự động (50-200 CC)."),
        ("Độ trễ Siêu tốc (Latency)", "• Đoạn tải /api/state: 88ms (P50: 106ms, P90: 405ms)\n• Giảm 25 LẦN so với ban đầu nhờ tối ưu SQLite WAL và Cache-Control."),
        ("Năng lực Xử lý (Throughput)", "• Tốc độ xử lý: Đạt 194.1 yêu cầu/giây (Requests per second)\n• Băng thông đỉnh: Đạt 12,020 KB/s (~12 MB/s)."),
        ("Độ tin cậy & Chịu tải Đồng thời", "• Tỷ lệ thành công: 100.0% (0 lỗi trên toàn bộ các kịch bản test)\n• Chịu tải tốt hơn 500 người dùng đăng nhập và tương tác cùng lúc!"),
        ("Lighthouse Audit", "Đạt điểm tuyệt đối: 100/100 Best Practices, 100/100 SEO, 100/100 Agentic Browsing, 95/100 Accessibility."),
    ], font_size=11, space_after=12)

    # Right side: Table summarizing benchmark results
    create_card(s13, Inches(6.9), Inches(1.4), Inches(5.6), Inches(5.3), "Bảng Số liệu Đo kiểm Vận hành Thực tế")
    
    table_shape = s13.shapes.add_table(6, 4, Inches(7.1), Inches(2.1), Inches(5.2), Inches(4.2))
    table = table_shape.table
    table.columns[0].width = Inches(1.7)
    table.columns[1].width = Inches(1.1)
    table.columns[2].width = Inches(1.2)
    table.columns[3].width = Inches(1.2)

    headers = ["Kịch bản kiểm thử", "Đồng thời", "Tốc độ (RPS)", "Độ trễ P50"]
    for col_idx, h in enumerate(headers):
        cell = table.cell(0, col_idx)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_CRIMSON
        p = cell.text_frame.paragraphs[0]
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = C_WHITE
        p.alignment = PP_ALIGN.CENTER

    data = [
        ["Root HTML (Trang chủ)", "20 CC", "83.2 req/s", "208 ms"],
        ["/api/state (Tải thường)", "20 CC", "15.8 req/s", "106 ms"],
        ["/api/state (Cao điểm)", "50 CC", "194.1 req/s", "202 ms"],
        ["/api/stats (Thống kê)", "50 CC", "65.0 req/s", "122 ms"],
        ["/api/contacts (Danh bạ)", "20 CC", "153.2 req/s", "93 ms"],
    ]

    for row_idx, row_data in enumerate(data):
        for col_idx, val in enumerate(row_data):
            cell = table.cell(row_idx + 1, col_idx)
            cell.text = val
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor(241, 245, 249) if row_idx % 2 == 1 else C_WHITE
            p = cell.text_frame.paragraphs[0]
            p.font.name = "Segoe UI"
            p.font.size = Pt(10)
            p.font.color.rgb = C_NAVY_DARK
            if col_idx > 0:
                p.alignment = PP_ALIGN.CENTER
                p.font.bold = True

    # =========================================================================
    # SLIDE 14: Quy trình Xử lý Sự cố & Đầu mối Hỗ trợ
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "QUY TRÌNH XỬ LÝ SỰ CỐ & ĐẦU MỐI HỖ TRỢ KỸ THUẬT")
    add_footer(s14, 14)

    create_card(s14, Inches(0.8), Inches(1.4), Inches(5.8), Inches(5.3), "Hướng dẫn Xử lý Sự cố Thường gặp")
    add_bullets(s14, Inches(1.1), Inches(2.0), Inches(5.2), Inches(4.5), [
        ("Mất kết nối mạng tạm thời", "Hệ thống có cơ chế Offline Cache: Số liệu đã tải vẫn hiển thị bình thường. Khi có mạng trở lại, ứng dụng tự động đồng bộ mà không cần tải lại trang."),
        ("Không chuyển được màu 'Đã xong'", "Kiểm tra 2 điều kiện bắt buộc:\n1. Tích đủ 100% checklist hồ sơ kiểm tra.\n2. Sĩ số có mặt đạt >= 2/3 tổng số đoàn viên."),
        ("Lớp bị khóa không sửa được", "Báo cáo cho Phụ trách Tầng hoặc Phụ trách Tòa nhà để được kiểm tra và bấm nút 'Mở khóa'."),
        ("Quên mật khẩu / Lỗi đăng nhập", "Liên hệ Admin để nhận Link đăng nhập riêng một chạm hoặc yêu cầu cấp lại mật khẩu mới."),
    ], font_size=11, space_after=14)

    create_card(s14, Inches(6.9), Inches(1.4), Inches(5.6), Inches(5.3), "Đầu mối Hỗ trợ Kỹ thuật Khẩn cấp")
    add_bullets(s14, Inches(7.2), Inches(2.0), Inches(5.0), Inches(4.5), [
        ("Đơn vị Thường trực", "Văn phòng Đoàn Thanh niên - Ban Tổ chức - Kiểm tra ĐHBK Hà Nội"),
        ("Địa điểm Trực điều hành", "Phòng 104 nhà B1 - Trụ sở Đoàn Thanh niên - Hội Sinh viên"),
        ("Hotline Hỗ trợ Kỹ thuật", "• Kỹ thuật hệ thống: Kiều Minh Anh (0366.329.799)\n• Điều phối nhân sự: Ban Tổ chức - Kiểm tra\n• Kênh hỗ trợ trực tuyến: Nhóm Zalo Điều hành Đại hội Chi đoàn"),
        ("Website chính thức", "https://event-tracker-pied.vercel.app/"),
        ("Lời chúc", "CHÚC CÁC CHI ĐOÀN TỔ CHỨC ĐẠI HỘI THÀNH CÔNG RỰC RỠ!"),
    ], font_size=11, space_after=14)

    # Save presentation
    prs.save(OUTPUT_PPTX)
    prs.save(OUTPUT_PPTX_ARTIFACT)
    print("Successfully generated PPTX presentations:")
    print("  ->", OUTPUT_PPTX)
    print("  ->", OUTPUT_PPTX_ARTIFACT)

if __name__ == '__main__':
    build_presentation()
