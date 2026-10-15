import os
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\phamv\.gemini\antigravity\brain\0e621399-7ded-426a-8568-e2d941443cb6"

def get_font(size, bold=False):
    # Try Windows system fonts
    font_paths = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\tahoma.ttf"
    ]
    if bold:
        font_paths = [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\tahomabd.ttf"
        ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except:
                pass
    return ImageFont.load_default()

def create_ios_pwa_guide():
    w, h = 1200, 700
    img = Image.new('RGB', (w, h), color='#F8FAFC')
    draw = ImageDraw.Draw(img)

    # Header Banner
    draw.rectangle([0, 0, w, 90], fill='#B91C1C')
    f_title = get_font(28, bold=True)
    f_sub = get_font(16)
    draw.text((40, 20), "HƯỚNG DẪN CÀI ĐẶT PWA TRÊN iOS (IPHONE / IPAD - TRÌNH DUYỆT SAFARI)", fill='#FFFFFF', font=f_title)
    draw.text((40, 56), "Đưa hệ thống ra Màn hình chính & Màn hình chờ - Chạy toàn màn hình như App gốc", fill='#FEE2E2', font=f_sub)

    # 4 Steps Cards
    card_w = 260
    card_h = 540
    start_x = 40
    gap = 25
    y = 120

    steps = [
        {
            "step": "BƯỚC 1",
            "title": "Mở Safari",
            "icon": "🌐",
            "accent": "#2563EB",
            "bullets": [
                "Mở trình duyệt Safari trên iPhone/iPad.",
                "Truy cập địa chỉ:",
                "event-tracker-pied.vercel.app",
                "Đợi hệ thống tải xong giao diện chính."
            ],
            "tip": "Lưu ý: Bắt buộc dùng Safari để hỗ trợ tính năng Add to Home Screen trên iOS."
        },
        {
            "step": "BƯỚC 2",
            "title": "Bấm nút Chia sẻ",
            "icon": "📤",
            "accent": "#0D9488",
            "bullets": [
                "Tìm thanh công cụ ở cạnh dưới màn hình.",
                "Nhấn biểu tượng Chia sẻ (Share):",
                "[ Ô vuông có mũi tên chỉ lên ↑ ]",
                "Bảng tùy chọn tác vụ sẽ trượt lên từ dưới."
            ],
            "tip": "Nếu thanh công cụ bị ẩn, chạm nhẹ vào cạnh dưới màn hình để hiển thị lại."
        },
        {
            "step": "BƯỚC 3",
            "title": "Chọn Thêm vào MH",
            "icon": "➕",
            "accent": "#D97706",
            "bullets": [
                "Cuộn danh sách tác vụ xuống.",
                "Tìm và nhấn vào mục:",
                "\"Thêm vào MH chính\"",
                "(Add to Home Screen)",
                "Có biểu tượng dấu [+] hình vuông."
            ],
            "tip": "Tùy phiên bản iOS, mục này có thể nằm ở dòng thứ 2 hoặc thứ 3 trong menu."
        },
        {
            "step": "BƯỚC 4",
            "title": "Xác nhận Thêm",
            "icon": "✅",
            "accent": "#059669",
            "bullets": [
                "Màn hình xác nhận xuất hiện.",
                "Tên gợi ý: \"Theo dõi Đại hội\"",
                "Bấm nút \"Thêm\" (Add) ở góc trên bên phải.",
                "Icon ứng dụng lập tức xuất hiện trên màn hình chính!"
            ],
            "tip": "Mở app từ Màn hình chính: Tự động chạy toàn màn hình, không bị che bởi thanh URL!"
        }
    ]

    for i, s in enumerate(steps):
        cx = start_x + i * (card_w + gap)
        # Card Background
        draw.rounded_rectangle([cx, y, cx + card_w, y + card_h], radius=16, fill='#FFFFFF', outline='#E2E8F0', width=2)
        # Step Badge
        draw.rounded_rectangle([cx + 15, y + 15, cx + 110, y + 45], radius=8, fill=s['accent'])
        draw.text((cx + 25, y + 20), s['step'], fill='#FFFFFF', font=get_font(14, bold=True))
        
        # Title
        draw.text((cx + 15, y + 60), s['title'], fill='#0F172A', font=get_font(20, bold=True))
        
        # Divider
        draw.line([cx + 15, y + 95, cx + card_w - 15, y + 95], fill='#F1F5F9', width=2)

        # Bullets
        by = y + 110
        f_body = get_font(13)
        for b in s['bullets']:
            draw.text((cx + 15, by), f"• {b}", fill='#334155', font=f_body)
            by += 28

        # Tip Box
        draw.rounded_rectangle([cx + 12, y + card_h - 140, cx + card_w - 12, y + card_h - 15], radius=10, fill='#F8FAFC', outline='#E2E8F0', width=1)
        draw.text((cx + 20, y + card_h - 132), "💡 Ghi chú quan trọng:", fill=s['accent'], font=get_font(12, bold=True))
        
        # Word wrap tip text
        tip_lines = []
        words = s['tip'].split()
        cur_line = ""
        for w_item in words:
            if len(cur_line + " " + w_item) < 32:
                cur_line += " " + w_item if cur_line else w_item
            else:
                tip_lines.append(cur_line)
                cur_line = w_item
        if cur_line:
            tip_lines.append(cur_line)
            
        ty = y + card_h - 110
        for tl in tip_lines[:4]:
            draw.text((cx + 20, ty), tl, fill='#64748B', font=get_font(11))
            ty += 18

    out_path = os.path.join(ARTIFACT_DIR, "pwa_ios_guide.png")
    img.save(out_path, quality=95)
    print("Created:", out_path)

def create_android_pwa_guide():
    w, h = 1200, 700
    img = Image.new('RGB', (w, h), color='#F8FAFC')
    draw = ImageDraw.Draw(img)

    # Header Banner
    draw.rectangle([0, 0, w, 90], fill='#0F172A')
    f_title = get_font(28, bold=True)
    f_sub = get_font(16)
    draw.text((40, 20), "HƯỚNG DẪN CÀI ĐẶT PWA TRÊN ANDROID (GOOGLE CHROME / CỐC CỐC)", fill='#FFFFFF', font=f_title)
    draw.text((40, 56), "Cài đặt ứng dụng 1-chạm vào Màn hình chính & Màn hình chờ - Hoạt động siêu tốc", fill='#94A3B8', font=f_sub)

    card_w = 260
    card_h = 540
    start_x = 40
    gap = 25
    y = 120

    steps = [
        {
            "step": "BƯỚC 1",
            "title": "Mở Chrome",
            "icon": "🌐",
            "accent": "#EA580C",
            "bullets": [
                "Mở trình duyệt Google Chrome (hoặc Cốc Cốc, Samsung Internet).",
                "Truy cập đường dẫn chính thức:",
                "event-tracker-pied.vercel.app",
                "Hệ thống tải dữ liệu vào bộ nhớ đệm."
            ],
            "tip": "Chrome trên Android tự động nhận diện PWA và chuẩn bị gói cài đặt offline."
        },
        {
            "step": "BƯỚC 2",
            "title": "Menu 3 Chấm",
            "icon": "⋮",
            "accent": "#2563EB",
            "bullets": [
                "Tìm góc trên cùng bên phải màn hình trình duyệt.",
                "Nhấn biểu tượng Menu 3 chấm dọc:",
                "[ ⋮ ] (Tùy chọn trình duyệt)",
                "Menu tác vụ mở rộng sẽ thả xuống."
            ],
            "tip": "Ở một số dòng máy, Chrome sẽ tự động hiển thị thanh banner thông báo \"Cài đặt ứng dụng\" ở đáy màn hình."
        },
        {
            "step": "BƯỚC 3",
            "title": "Cài đặt Ứng dụng",
            "icon": "📲",
            "accent": "#7C3AED",
            "bullets": [
                "Trong danh sách menu sổ xuống:",
                "Tìm mục: \"Cài đặt ứng dụng\"",
                "(Install App)",
                "Hoặc: \"Thêm vào màn hình chính\"",
                "(Add to Home Screen)."
            ],
            "tip": "Cả hai tùy chọn đều tích hợp app trực tiếp vào hệ điều hành Android."
        },
        {
            "step": "BƯỚC 4",
            "title": "Hoàn tất Cài đặt",
            "icon": "🎉",
            "accent": "#059669",
            "bullets": [
                "Hộp thoại xác nhận xuất hiện:",
                "Bấm nút \"Cài đặt\" (Install).",
                "Hệ điều hành Android sẽ tạo biểu tượng ứng dụng độc lập.",
                "Mở từ màn hình chính: Không có thanh URL, chạy toàn màn hình cực mượt!"
            ],
            "tip": "Hỗ trợ Standby & chạy nền: Nhận thông báo khẩn cấp và cập nhật trạng thái tức thời."
        }
    ]

    for i, s in enumerate(steps):
        cx = start_x + i * (card_w + gap)
        draw.rounded_rectangle([cx, y, cx + card_w, y + card_h], radius=16, fill='#FFFFFF', outline='#E2E8F0', width=2)
        draw.rounded_rectangle([cx + 15, y + 15, cx + 110, y + 45], radius=8, fill=s['accent'])
        draw.text((cx + 25, y + 20), s['step'], fill='#FFFFFF', font=get_font(14, bold=True))
        draw.text((cx + 15, y + 60), s['title'], fill='#0F172A', font=get_font(20, bold=True))
        draw.line([cx + 15, y + 95, cx + card_w - 15, y + 95], fill='#F1F5F9', width=2)

        by = y + 110
        f_body = get_font(13)
        for b in s['bullets']:
            draw.text((cx + 15, by), f"• {b}", fill='#334155', font=f_body)
            by += 28

        draw.rounded_rectangle([cx + 12, y + card_h - 140, cx + card_w - 12, y + card_h - 15], radius=10, fill='#F8FAFC', outline='#E2E8F0', width=1)
        draw.text((cx + 20, y + card_h - 132), "💡 Ghi chú quan trọng:", fill=s['accent'], font=get_font(12, bold=True))
        
        tip_lines = []
        words = s['tip'].split()
        cur_line = ""
        for w_item in words:
            if len(cur_line + " " + w_item) < 32:
                cur_line += " " + w_item if cur_line else w_item
            else:
                tip_lines.append(cur_line)
                cur_line = w_item
        if cur_line:
            tip_lines.append(cur_line)
            
        ty = y + card_h - 110
        for tl in tip_lines[:4]:
            draw.text((cx + 20, ty), tl, fill='#64748B', font=get_font(11))
            ty += 18

    out_path = os.path.join(ARTIFACT_DIR, "pwa_android_guide.png")
    img.save(out_path, quality=95)
    print("Created:", out_path)

if __name__ == '__main__':
    create_ios_pwa_guide()
    create_android_pwa_guide()
