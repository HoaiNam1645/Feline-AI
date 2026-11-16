---
name: Feline AI
description: Nền tảng AI doanh nghiệp với ngôn ngữ editorial Việt hiện đại, ấm và rõ ràng.
colors:
  paper: "#f5efe4"
  paper-soft: "#fbf8f1"
  paper-deep: "#ede3d3"
  ink: "#302822"
  muted: "#75695e"
  wine: "#7f2028"
  wine-deep: "#5e111a"
  wine-soft: "#f3e2df"
  gold: "#c6933b"
  gold-soft: "#f5e8ca"
  action-gold: "#f1ce83"
  leaf: "#526a55"
  line: "#ded2c1"
  success: "#47725b"
  success-soft: "#dfebe1"
  danger: "#a13c43"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(42px, 4.6vw, 68px)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(31px, 3vw, 46px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.78
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  none: "0"
  compact: "7px"
  control: "10px"
  nav: "12px"
  card: "15px"
  feature: "16px"
  pill: "999px"
spacing:
  xs: "5px"
  sm: "8px"
  control: "12px"
  md: "16px"
  card: "24px"
  page: "38px"
  feature: "56px"
components:
  button-primary:
    backgroundColor: "{colors.action-gold}"
    textColor: "{colors.wine-deep}"
    rounded: "{rounded.control}"
    padding: "12px 17px"
  button-send:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.paper-soft}"
    rounded: "{rounded.control}"
    size: "44px"
  card-editorial:
    backgroundColor: "{colors.paper-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  field-default:
    backgroundColor: "{colors.paper-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 15px"
  nav-active:
    backgroundColor: "{colors.paper-deep}"
    textColor: "{colors.wine-deep}"
    rounded: "{rounded.nav}"
    padding: "0 12px"
    height: "44px"
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
---

# Design System: Feline AI

## Overview

**Creative North Star: "Tòa soạn điều hành Việt hiện đại"**

Feline AI vận hành như một tòa soạn điều hành điềm tĩnh: nền giấy ấm tạo cảm giác đáng tin, burgundy giữ vai trò mực chủ đạo, còn gold và leaf đánh dấu ưu tiên, trạng thái và hành động. Cảm hứng editorial Việt hiện đại thể hiện qua tỷ lệ chữ lớn, nhịp chia cột và vật liệu giấy; không vay mượn trang trí lễ hội hay chất Tết.

Đây là giao diện Operate nên biểu đạt nằm trong trật tự, độ tương phản và chi tiết tinh tế thay vì trang trí dày. Các màn hình quản trị có thể giàu dữ liệu nhưng vẫn restraint; các bề mặt dành cho User và Manager ưu tiên ngôn ngữ nghiệp vụ tự nhiên, chỉ để lộ thông tin cần thiết để hoàn thành công việc.

**Key Characteristics:**

- Nền giấy ngà ấm với lớp bề mặt sáng hơn, đường viền nâu nhạt và khoảng thở rộng.
- Burgundy là màu quyền lực có kiểm soát; gold và leaf chỉ làm điểm nhấn chức năng.
- Newsreader dẫn dắt tiêu đề lớn; Manrope giữ nhịp đọc nhanh cho điều khiển và dữ liệu.
- Sidebar sáng cố định tạo trục điều hướng; burgundy chỉ đánh dấu thương hiệu, hover và trạng thái đang chọn.
- Chat là không gian làm việc full-height, đọc thoáng và giữ composer ổn định ở đáy.

## Colors

Bảng màu có sắc độ của giấy, mực rượu vang và kim loại cũ; độ bão hòa được giữ vừa phải để dữ liệu và nội dung tiếng Việt luôn là trọng tâm.

### Primary

- **Mực Burgundy:** màu nhận diện chính cho sidebar, nút gửi, avatar, lựa chọn nổi bật và bubble của người dùng.
- **Burgundy Đậm:** dùng cho tiêu đề, chữ trên nền gold và các điểm neo thị giác cần độ tương phản cao.
- **Burgundy Phấn:** nền trạng thái hoặc icon nhẹ, không thay thế màu hành động chính.

### Secondary

- **Gold Biên Tập:** dùng có chủ đích cho CTA quan trọng, bullet, focus ring và chi tiết nhấn.
- **Gold Giấy:** nền nhấn ấm cho trạng thái trung tính hoặc nút hành động trên hero.
- **Gold Hành Động:** sắc gold rõ hơn dành riêng cho CTA trên hero burgundy.

### Tertiary

- **Leaf Trầm:** màu hỗ trợ cho chỉ số tích cực, dữ liệu lành mạnh và phân loại thứ cấp.
- **Xanh Thành Công:** chỉ báo trạng thái hoạt động; không dùng như màu thương hiệu thay thế burgundy.
- **Xanh Thành Công Nhạt:** nền tonal cho status pill tích cực.
- **Đỏ Cảnh Báo:** lỗi và trạng thái nguy hiểm, luôn đi kèm nhãn rõ nghĩa.

### Neutral

- **Giấy Nền:** nền canvas chính của ứng dụng.
- **Giấy Sáng:** bề mặt card, field và vùng chat cần độ sáng hơn canvas.
- **Giấy Sâu:** vùng điều hướng phụ, bảng và lớp phân tách ấm.
- **Mực Nâu:** màu chữ chính.
- **Mực Nhạt:** mô tả, metadata và chữ phụ.
- **Đường Giấy:** viền, divider và cấu trúc bảng.

### Named Rules

**The Burgundy Authority Rule.** Burgundy dành cho nhận diện, hành động chính và trạng thái đang chọn; không rải như màu trang trí trên mọi bề mặt.

**The No Tết Costume Rule.** Giữ chất Việt qua vật liệu, nhịp chữ và sắc độ trưởng thành; không thêm hoa mai, phong bao, họa tiết lễ hội hoặc ornament mùa vụ.

### Data Visualization

- Chuỗi dữ liệu chính dùng burgundy `#7f2028`; chuỗi tích cực hoặc doanh thu dùng leaf đậm `#3f624b`.
- Backlog dùng severity mapping cố định: `<24h` leaf, `24–48h` olive, `48–72h` ochre và `≥72h` danger. Không gán màu theo vị trí mảng dữ liệu.
- Dữ liệu phân loại dùng palette trầm ổn định theo tên danh mục; không tái sử dụng palette severity.
- Grid và trục dùng neutral ấm, tooltip dùng bề mặt giấy sáng. Biểu đồ luôn có legend hoặc nhãn, không truyền nghĩa chỉ bằng màu.

## Typography

**Display Font:** Newsreader (với Georgia và serif làm fallback)  
**Body Font:** Manrope (với sans-serif làm fallback)

**Character:** Newsreader mang chất biên tập, thẩm quyền và độ ấm cho các tiêu đề lớn. Manrope trung tính, gọn và dễ quét cho điều hướng, bảng, form, metadata và hội thoại dài.

### Hierarchy

- **Display** (600, fluid 42–68px, 0.98): hero và câu chào có tính định hướng; giới hạn ở một điểm nhấn lớn trên mỗi vùng.
- **Headline** (600, fluid 31–46px, 1.05): tiêu đề trang và empty-state quan trọng.
- **Title** (600, 24px, 1.15): card title, báo cáo và nhóm nội dung chính.
- **Body** (400, 13px, 1.78): nội dung nghiệp vụ và câu trả lời AI; đoạn đọc dài giữ chiều rộng tối đa khoảng 74ch.
- **Label** (700, 9px, tracking rộng): nhãn nhóm, trạng thái nhỏ và metadata; uppercase chỉ dùng cho taxonomy ngắn.

### Named Rules

**The Editorial Contrast Rule.** Newsreader tạo thẩm quyền ở tiêu đề; Manrope làm toàn bộ công việc vận hành. Không dùng display serif cho control, bảng hoặc metadata.

**The Vietnamese Readability Rule.** Không ép uppercase cho câu tiếng Việt dài và không giảm body copy dưới kích thước đã quan sát chỉ để nhồi thêm dữ liệu.

## Layout

Desktop dùng sidebar cố định rộng 248px với brand cố định và vùng menu cuộn độc lập; workspace nằm bên phải. Header cao 72px, sticky; body giới hạn khoảng 1500px ở màn hình dữ liệu nhưng bỏ giới hạn và chiếm toàn bộ chiều rộng ở chat. Padding trang điển hình là 34–38px, khoảng cách giữa các card khoảng 20px, và nội dung hero có khoảng thở lớn hơn đáng kể.

Dashboard dùng grid thích ứng: KPI giảm từ ba hoặc bốn cột xuống hai ở màn hình trung bình và một cột ở mobile; khối nội dung bất đối xứng trở thành một cột trước khi chật. Summary card dùng đường chia liên tục thay vì tạo một tập hợp hộp nổi rời rạc.

Tổng quan vận hành ưu tiên hai KPI chính là đơn tiếp nhận và doanh thu; Shipout, Backlog, phí và Remake nằm trong cụm hỗ trợ nhỏ hơn. Nhận định và ngoại lệ xuất hiện trước biểu đồ chi tiết; bảng seller là drill-down cuối luồng.

Chat dùng shell full-height dưới global header, với history rail khoảng 248–260px và workspace `minmax(0, 1fr)`. Trên mobile, rail trở thành drawer; message stream giữ full width, bubble không vượt quá 90%, và composer luôn ổn định ở đáy với textarea co giãn cùng nút gửi 44px.

**The Full-Width Mobile Rule.** Ở viewport nhỏ, loại bỏ giới hạn chiều rộng không cần thiết; ưu tiên một cột, vùng chạm rõ và composer không nhảy vị trí khi nhập liệu.

## Elevation & Depth

Hệ thống phẳng theo mặc định. Viền giấy và thay đổi tonal tạo cấu trúc chính; shadow chỉ xuất hiện ở hero, menu nổi, bubble người dùng, drawer và lớp cần tách khỏi mặt phẳng. Card nội dung thường không có shadow.

### Shadow Vocabulary

- **Editorial Ambient** (`0 18px 45px rgba(72, 42, 27, .09)`): hero và menu nổi cần cảm giác được nâng nhẹ.
- **Action Lift** (`0 12px 28px rgba(34, 5, 8, .20)`): CTA gold trên bề mặt burgundy.
- **Conversation Lift** (`0 12px 28px rgba(95, 19, 27, .16)`): bubble người dùng, chỉ để tách hội thoại khỏi nền giấy.
- **Composer Separation** (`0 -14px 30px rgba(83, 55, 35, .06)`): mép trên composer cố định.

### Named Rules

**The Flat-by-Default Rule.** Card ở trạng thái nghỉ dùng border và tonal layering; chỉ dùng shadow khi lớp thực sự nổi, trượt hoặc cần neo tương tác.

## Shapes

Form language là những khối chữ nhật mềm vừa phải: control 10–12px, card 15–16px, chip trạng thái dạng pill và avatar/icon tròn. KPI strip là ngoại lệ có chủ đích với góc vuông và divider liên tục để tạo nhịp editorial. Bubble chat có một góc nhỏ hơn ở phía người gửi, giúp định hướng hội thoại mà không cần ornament.

Đường viền mảnh, ấm và có độ tương phản thấp. Focus ring gold ba pixel nằm ngoài control để dễ nhận biết mà không phá vật liệu giấy.

## Components

### Buttons

- **Shape:** control mềm, gọn (10px); nút icon chat dùng kích thước vuông 44px.
- **Primary:** CTA trên hero dùng gold nhạt với chữ burgundy đậm; nút gửi dùng burgundy với icon giấy sáng.
- **Hover / Focus:** hover thay đổi tonal và nâng tối đa 1px; focus-visible dùng ring gold rõ, không dựa riêng vào màu.
- **Ghost:** nền trong suốt, chữ muted hoặc burgundy; chỉ thêm nền giấy khi hover.

### Chips

- **Style:** pill nhỏ, nền tonal nhạt và chữ có độ tương phản cao; success dùng leaf/green, warning dùng gold, failure dùng danger.
- **State:** luôn có nhãn văn bản; không truyền trạng thái bằng chấm màu đơn lẻ.

### Cards / Containers

- **Corner Style:** card tiêu chuẩn 15px; feature hoặc hero 16px; KPI strip có thể vuông.
- **Background:** giấy sáng hoặc alpha trắng ấm trên canvas giấy nền.
- **Shadow Strategy:** phẳng ở trạng thái nghỉ, theo quy tắc Elevation.
- **Border:** một pixel màu đường giấy.
- **Internal Padding:** thường 24–25px; giảm còn 17–18px trên mobile.

### Inputs / Fields

- **Style:** nền giấy sáng, viền ấm, radius 10–13px; nội dung dùng Manrope.
- **Focus:** viền chuyển về burgundy dịu kèm ring mờ; focus-visible toàn cục vẫn phải hiện rõ.
- **Error / Disabled:** lỗi dùng danger trên nền đỏ rất nhạt; disabled giảm tương phản nhưng giữ nội dung đọc được.

### Navigation

Sidebar sáng là trục điều hướng chính. Brand nằm cố định phía trên, menu cuộn độc lập bên dưới. Agent được nhóm thành module; các chức năng của Agent dùng lưới hai cột để giảm chiều cao và tăng khả năng quét. Hover dùng nền đỏ rất nhạt; active dùng burgundy có kiểm soát. Trên mobile, sidebar trở thành drawer có backdrop và giữ nguyên thứ tự thông tin.

### Conversation Workspace

Chat chiếm toàn bộ vùng làm việc dưới header. Lịch sử nằm trong rail riêng, câu trả lời dùng chiều rộng đọc tối đa khoảng 74ch, suggestion là nút viền giấy và composer neo đáy. User và Manager chỉ thấy ngôn ngữ nghiệp vụ: không hiển thị model, token, tool, API, Data Scope, capability hoặc mô tả hệ thống nội bộ. Admin có thể mở metadata quản trị, điểm nguồn và chi tiết audit khi cần.

**The Role-Safe Surface Rule.** Cùng một visual system nhưng độ chi tiết thông tin phụ thuộc role; metadata kỹ thuật là công cụ quản trị, không phải nội dung trang trí hay tín hiệu tin cậy cho người dùng cuối.

### Authentication

Màn đăng nhập dùng bố cục hai vùng trên desktop: vùng thương hiệu burgundy mang thông điệp phân quyền và vùng form giấy sáng phục vụ thao tác. Form phẳng, không dùng glass hoặc card nổi; mobile chuyển thành một luồng dọc với thông điệp trước và form ngay sau. Gold chỉ đánh dấu biểu tượng thương hiệu, leaf dành cho trạng thái bảo mật và burgundy dành cho hành động đăng nhập.

## Do's and Don'ts

### Do:

- **Do** dùng nền giấy ấm, divider mảnh và typography lớn để tạo thứ bậc trước khi thêm card hoặc màu.
- **Do** giữ burgundy hiếm và có thẩm quyền; dùng gold/leaf như ký hiệu chức năng có kiểm soát.
- **Do** giữ chat full-height, message stream rộng thoáng và composer ổn định trên desktop lẫn mobile.
- **Do** dùng tiếng Việt tự nhiên, nhãn trực tiếp và trạng thái luôn có văn bản.
- **Do** để Admin xem chi tiết quản trị cần thiết trong ngữ cảnh audit hoặc cấu hình.

### Don't:

- **Don't** sao chép chất Tết, ornament lễ hội hoặc biến bảng màu đỏ-vàng thành trang trí dày đặc.
- **Don't** biến dashboard thành lưới card nổi đồng đều; ưu tiên strip, divider và nhịp editorial restraint.
- **Don't** hiển thị model, token, tool, API, Data Scope, capability hoặc mô tả hệ thống nội bộ cho User và Manager.
- **Don't** dùng shadow cho mọi container hoặc animation liên tục; chuyển động chỉ hỗ trợ định hướng và phải tôn trọng reduced motion.
- **Don't** thu hẹp mobile thành bản desktop co lại; chuyển grid thành một cột, drawer hóa rail và bảo toàn vùng nhập liệu.
