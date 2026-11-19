const groups = [
  { title: "Tổng quan hệ thống", items: [
    ["start", "Bắt đầu sử dụng"], ["roles", "Role và phân quyền"], ["navigation", "Điều hướng hệ thống"]
  ]},
  { title: "Chức năng chung", items: [
    ["overview", "Tổng quan"], ["tasks", "Task Manager"], ["daily-reports", "Báo cáo hằng ngày"], ["office", "Văn phòng 3D"]
  ]},
  { title: "CEO AI", items: [
    ["ceo-chat", "Chatbox"], ["ceo-knowledge", "Kho tri thức"], ["multi-agent", "Điều phối Multi-AI"]
  ]},
  { title: "TikTok AI", items: [
    ["tiktok-overview", "Tổng quan"], ["tiktok-chat", "Chatbox"], ["tiktok-knowledge", "Kho tri thức"]
  ]},
  { title: "Etsy AI", items: [
    ["etsy-overview", "Tổng quan"], ["etsy-chat", "Chatbox"], ["etsy-knowledge", "Kho tri thức"]
  ]},
  { title: "Kế toán AI", items: [
    ["accounting-overview", "Tổng quan tài chính"], ["accounting-chat", "Hỏi đáp"], ["accounting-knowledge", "Kho tri thức"]
  ]},
  { title: "Lemiex AI", items: [
    ["lemiex-overview", "Tổng quan xưởng"], ["lemiex-chat", "Chatbox"], ["lemiex-reports", "Báo cáo"], ["lemiex-backlog", "Backlog"]
  ]},
  { title: "Quản trị", items: [
    ["users", "Người dùng và phân quyền"], ["unanswered", "Câu hỏi chưa trả lời được"], ["sources", "Nguồn dữ liệu"], ["audit", "Nhật ký AI"]
  ]}
];

const docs = {
  start: {
    title: "Toàn cảnh Feline AI",
    summary: "Đây là điểm bắt đầu dành cho người chưa từng sử dụng hệ thống. Feline AI tập hợp công việc chung, các trợ lý theo phòng ban và khu vực quản lý trên cùng một nền tảng.",
    roles: [["Admin", "Quản lý toàn bộ hệ thống"], ["Manager", "Quản lý trong phạm vi được giao"], ["User", "Sử dụng chức năng và dữ liệu được cấp"]],
    features: [["Đăng nhập", "Sử dụng tài khoản do người quản trị cấp."], ["Chọn khu vực", "Mở chức năng chung hoặc Agent của phòng ban."], ["Làm việc", "Xem số liệu, hỏi AI, nhận công việc hoặc gửi báo cáo."], ["Đúng phạm vi", "Dữ liệu hiển thị phụ thuộc quyền của từng tài khoản."]],
    flow: [["Đăng nhập", "Mở hệ thống"], ["Chọn màn", "Vào đúng khu vực"], ["Thực hiện", "Xem hoặc cập nhật công việc"]]
  },
  roles: {
    title: "Role và phân quyền",
    summary: "Hệ thống có ba cấp role. Role quyết định mức quản lý chung; phòng ban, team và quyền Agent quyết định dữ liệu cụ thể được sử dụng.",
    roles: [["Admin", "Toàn quyền nền tảng"], ["Manager", "Quản lý Agent và phòng ban được giao"], ["User", "Làm việc theo phòng ban, team và dữ liệu được cấp"]],
    features: [["Admin", "Quản lý tài khoản, quyền truy cập, tri thức và hoạt động toàn hệ thống."], ["Manager", "Giao việc, theo dõi báo cáo và sử dụng các Agent thuộc phạm vi quản lý."], ["User", "Nhận việc, báo cáo và sử dụng Agent trong phạm vi cá nhân."], ["Giới hạn dữ liệu", "Hai người cùng role vẫn có thể nhìn thấy dữ liệu khác nhau nếu thuộc team khác nhau."]]
  },
  navigation: {
    title: "Điều hướng hệ thống",
    summary: "Menu được chia thành chức năng chung, các Agent theo phòng ban và khu vực quản trị. Những mục không có quyền sẽ không xuất hiện.",
    features: [["Chức năng chung", "Công việc, báo cáo và văn phòng dùng chung trong doanh nghiệp."], ["Không gian AI", "Mỗi Agent có màn tổng quan, chatbox và các chức năng riêng."], ["Quản trị", "Chỉ dành cho người có trách nhiệm quản lý hệ thống."], ["Tài khoản", "Đổi mật khẩu, xem thông tin cá nhân và đăng xuất."]]
  },
  overview: {
    title: "Tổng quan hệ thống",
    summary: "Màn hình đầu tiên sau khi đăng nhập, giúp người dùng nhìn nhanh các khu vực đang được cấp quyền và đi tới công việc cần xử lý.",
    features: [["Không gian được cấp", "Hiển thị các Agent và phòng ban người dùng có thể truy cập."], ["Hoạt động gần đây", "Theo dõi các công việc hoặc lần xử lý AI gần nhất."], ["Đi tới chức năng", "Mở nhanh màn hình phù hợp mà không cần tìm trong toàn bộ menu."]]
  },
  tasks: {
    title: "Task Manager",
    summary: "Nơi giao, nhận và theo dõi công việc theo phòng ban. Cách hiển thị dạng bảng Trello giúp nhìn rõ việc chưa làm, đang làm và đã hoàn thành.",
    roles: [["Admin", "Quản lý mọi phòng ban"], ["Manager", "Giao và quản lý việc trong phạm vi"], ["User", "Nhận và cập nhật công việc"]],
    features: [["Tạo công việc", "Ghi nội dung, mức ưu tiên, thời gian và phòng ban nhận việc."], ["Kéo thả trạng thái", "Chuyển công việc giữa các cột theo tiến độ thực tế."], ["Checklist", "Chia công việc thành các bước nhỏ và theo dõi số bước hoàn thành."], ["Theo dõi thời gian", "Ghi nhận lúc bắt đầu, hạn hoàn thành và thời gian thực hiện."], ["Tra cứu lịch sử", "Xem công việc theo ngày, tuần, tháng hoặc khoảng thời gian."]],
    flow: [["Giao việc", "Tạo task cho phòng ban"], ["Nhận việc", "Thành viên bắt đầu xử lý"], ["Cập nhật", "Checklist và tiến độ"], ["Hoàn thành", "Chốt kết quả công việc"]]
  },
  "daily-reports": {
    title: "Báo cáo hằng ngày",
    summary: "Nơi leader hoặc thành viên phụ trách gửi báo cáo của từng team. Báo cáo được sắp xếp theo team và ngày để quản lý dễ xem lại.",
    features: [["Báo cáo theo team", "Mỗi team có khu vực báo cáo riêng."], ["Xem theo ngày", "Chọn ngày cần kiểm tra thay vì chỉ xem hôm nay."], ["Gửi và xác nhận", "Người phụ trách gửi báo cáo, quản lý xác nhận đã xem."], ["Trao đổi", "Sếp, Manager và thành viên liên quan có thể bình luận trong báo cáo."]]
  },
  office: {
    title: "Văn phòng 3D",
    summary: "Không gian trực quan mô phỏng các phòng ban và Agent. Khi chọn một phòng, camera và khu vực làm việc bên cạnh thay đổi theo đúng phòng đó.",
    features: [["Khám phá văn phòng", "Xoay, kéo và phóng to để xem các khu vực."], ["Chọn phòng ban", "Mở CEO AI, TikTok AI, Etsy AI, Lemiex hoặc phòng điều hành."], ["Trò chuyện tại phòng", "Chatbox bên cạnh thay đổi theo Agent đang được chọn."], ["Theo dõi nhiệm vụ", "Nhân vật và trạng thái thể hiện quá trình tiếp nhận, xử lý và trả kết quả."], ["Phòng họp AI", "Mở không gian phối hợp nhiều Agent cho một mục tiêu chung."]]
  },
  "ceo-chat": {
    title: "CEO AI — Chatbox",
    summary: "Kênh hỏi đáp tri thức nội bộ và điều hành chung. CEO AI trả lời dựa trên tài liệu người dùng được phép xem và ghi rõ nguồn khi có căn cứ.",
    features: [["Hỏi đáp nội bộ", "Hỏi về chính sách, quy trình, đầu mối hoặc tri thức công ty."], ["Lịch sử trò chuyện", "Mỗi cuộc trò chuyện được lưu để tiếp tục ở lần sau."], ["Trích dẫn nguồn", "Câu trả lời cho biết tài liệu được sử dụng."], ["Ghi nhận câu hỏi thiếu", "Nếu chưa có dữ liệu, hệ thống lưu lại để Admin bổ sung thay vì tự đoán."]]
  },
  "ceo-knowledge": {
    title: "CEO AI — Kho tri thức",
    summary: "Nơi Admin đưa tài liệu nội bộ vào CEO AI và quyết định phòng ban nào được phép đọc từng tài liệu.",
    features: [["Thêm tài liệu", "Đưa nội quy, quy trình hoặc tài liệu điều hành vào hệ thống."], ["Phiên bản và hiệu lực", "Theo dõi bản mới, ngày áp dụng và người phụ trách."], ["Phân quyền đọc", "Chọn phòng ban được phép sử dụng nội dung."], ["Cập nhật tri thức", "Lập chỉ mục lại khi tài liệu thay đổi."]]
  },
  "multi-agent": {
    title: "CEO AI — Điều phối Multi-AI",
    summary: "Nơi giao một mục tiêu chung để CEO AI phân công cho các Agent phù hợp, sau đó tổng hợp thành một kế hoạch hoặc biên bản chung.",
    features: [["Chọn Agent tự động", "CEO AI xác định phòng ban cần tham gia dựa trên nội dung mục tiêu."], ["Chọn Agent thủ công", "Người dùng có thể chỉ định TikTok, Etsy hoặc Lemiex."], ["Theo dõi tiến độ", "Hiển thị Agent nào đang xử lý, đã gửi báo cáo hoặc gặp lỗi."], ["Biên bản chung", "CEO AI tổng hợp kết quả nhưng vẫn giữ báo cáo riêng của từng Agent."], ["Đúng quyền", "Chỉ Agent và dữ liệu đã được cấp mới được tham gia."]],
    flow: [["Giao mục tiêu", "CEO AI tiếp nhận"], ["Phân công", "Agent chuyên môn xử lý"], ["Tổng hợp", "CEO AI lập biên bản"], ["Kết quả", "Xem kế hoạch và báo cáo thành phần"]]
  },
  "tiktok-overview": {
    title: "TikTok AI — Tổng quan",
    summary: "Màn theo dõi hoạt động kinh doanh TikTok của G9B và CashStorm theo thời gian thực hoặc lần phân tích gần nhất.",
    features: [["Số đơn và doanh thu", "Xem kết quả chính theo khoảng thời gian."], ["Theo team và store", "So sánh hoạt động giữa các phạm vi được cấp."], ["Trạng thái đơn", "Theo dõi phân bổ đơn trong quá trình xử lý."], ["Hiệu suất seller", "Xem đóng góp của từng seller trong phạm vi được phép."], ["Phân tích mới", "Yêu cầu hệ thống lấy số liệu mới nhất khi cần."]]
  },
  "tiktok-chat": {
    title: "TikTok AI — Chatbox",
    summary: "Trợ lý dành cho phòng Sell TikTok, có thể trả lời cả tri thức vận hành và số liệu thuộc team, store được cấp quyền.",
    features: [["Hỏi dữ liệu", "Hỏi về đơn, doanh thu, team, store và fulfillment."], ["Hỏi quy trình", "Tra cứu cách làm việc từ tài liệu TikTok đã được duyệt."], ["Phân quyền theo team", "Manager hoặc User không thể xem team ngoài phạm vi."], ["Lịch sử và streaming", "Lưu phiên trò chuyện và hiển thị câu trả lời trong lúc AI đang soạn."]]
  },
  "tiktok-knowledge": {
    title: "TikTok AI — Kho tri thức",
    summary: "Khu vực Admin quản lý tài liệu nghiệp vụ của phòng Sell TikTok để Agent sử dụng khi trả lời.",
    features: [["Tải tài liệu", "Thêm quy trình, hướng dẫn và kinh nghiệm vận hành."], ["Quản lý phiên bản", "Giữ thông tin về bản tài liệu đang áp dụng."], ["Quyền đọc", "Giới hạn tài liệu theo phòng ban hoặc nhóm phù hợp."], ["Cập nhật Agent", "Đưa nội dung mới vào phạm vi trả lời của TikTok AI."]]
  },
  "etsy-overview": {
    title: "Etsy AI — Tổng quan",
    summary: "Màn theo dõi tình hình kinh doanh Etsy từ dữ liệu hệ thống phòng ban, giúp quản lý xem nhanh đơn hàng và kết quả theo phạm vi được cấp.",
    features: [["Kết quả kinh doanh", "Xem số đơn, doanh thu và biến động theo thời gian."], ["Theo shop và seller", "So sánh các shop hoặc người phụ trách."], ["Trạng thái đơn", "Theo dõi đơn đang nằm ở giai đoạn nào."], ["Làm mới dữ liệu", "Lấy lần phân tích mới khi cần kiểm tra tình hình hiện tại."]]
  },
  "etsy-chat": {
    title: "Etsy AI — Chatbox",
    summary: "Trợ lý dành cho phòng Sell Etsy, kết hợp dữ liệu kinh doanh và tài liệu nghiệp vụ để trả lời theo đúng phạm vi người dùng.",
    features: [["Hỏi dữ liệu", "Hỏi số đơn, doanh thu, shop, seller và tình trạng vận hành."], ["Hỏi tri thức", "Tra cứu quy trình và kinh nghiệm từ kho tài liệu Etsy."], ["Theo phạm vi được cấp", "Chỉ trả lời dữ liệu người dùng được phép xem."], ["Lịch sử trò chuyện", "Lưu các phiên hỏi đáp để tiếp tục hoặc kiểm tra lại."]]
  },
  "etsy-knowledge": {
    title: "Etsy AI — Kho tri thức",
    summary: "Nơi Admin quản lý tài liệu vận hành Etsy để Agent có căn cứ trả lời cho đội ngũ.",
    features: [["Thêm tài liệu", "Đưa quy trình, hướng dẫn và kinh nghiệm Etsy vào hệ thống."], ["Ngày hiệu lực", "Xác định tài liệu nào đang được áp dụng."], ["Người phụ trách", "Ghi rõ người hoặc phòng ban chịu trách nhiệm nội dung."], ["Phân quyền", "Chỉ đúng nhóm được phép mới sử dụng tài liệu."]]
  },
  "accounting-overview": {
    title: "Kế toán AI — Tổng quan tài chính",
    summary: "Màn hình giúp Phòng Kế toán theo dõi dòng tiền và các đầu việc tài chính trong kỳ đã chọn. Toàn bộ số liệu được lấy ở chế độ chỉ đọc trong phạm vi tài khoản được cấp.",
    roles: [["Admin", "Xem toàn bộ phạm vi được quản lý"], ["Manager Kế toán", "Theo dõi và đối chiếu số liệu của phòng"], ["User được cấp quyền", "Xem đúng phạm vi tài chính được giao"]],
    features: [["Chọn kỳ báo cáo", "Xem hôm nay, 7 ngày, tháng này, tháng trước hoặc một khoảng ngày cụ thể."], ["Dòng tiền và thu chi", "Theo dõi dòng tiền ròng, tổng thu, tổng chi và số giao dịch trong kỳ."], ["Yêu cầu mua hàng", "Xem các đề nghị gần đây cùng giá trị và trạng thái xử lý."], ["Công nợ", "Theo dõi khoản còn phải thu, hạn thanh toán và số tiền đã thu."], ["Tình trạng dữ liệu", "Biết thời điểm số liệu được cập nhật gần nhất theo giờ Việt Nam."]],
    flow: [["Chọn kỳ", "Xác định khoảng thời gian"], ["Xem tổng quan", "Đọc dòng tiền và chỉ số chính"], ["Đối chiếu", "Kiểm tra mua hàng và công nợ"]]
  },
  "accounting-chat": {
    title: "Kế toán AI — Hỏi đáp",
    summary: "Kênh hỏi đáp dành cho Phòng Kế toán, kết hợp số liệu chỉ đọc với tài liệu nghiệp vụ đang áp dụng trong đúng phạm vi người dùng được phép xem.",
    features: [["Hỏi số liệu", "Hỏi về thu chi, giao dịch, yêu cầu mua hàng, tài khoản, công nợ hoặc quy đổi tiền."], ["Hỏi quy trình", "Tra cứu hướng dẫn và chính sách từ tài liệu Kế toán đã được duyệt."], ["Theo đúng phạm vi", "Câu trả lời chỉ sử dụng dữ liệu và tài liệu tài khoản được cấp quyền đọc."], ["Giữ lịch sử", "Lưu các cuộc trao đổi để tiếp tục hoặc xem lại khi cần."], ["Nêu rõ căn cứ", "Hiển thị nguồn và kỳ dữ liệu khi câu trả lời dựa trên số liệu hoặc tài liệu."]]
  },
  "accounting-knowledge": {
    title: "Kế toán AI — Kho tri thức",
    summary: "Khu vực dành cho Admin quản lý quy trình, chính sách và tài liệu nghiệp vụ mà Kế toán AI được phép sử dụng khi trả lời.",
    features: [["Thêm tài liệu", "Đưa quy trình, biểu mẫu và hướng dẫn Kế toán vào hệ thống."], ["Phiên bản và hiệu lực", "Theo dõi bản đang áp dụng, thời gian hiệu lực và người phụ trách."], ["Quyền đọc", "Giới hạn tài liệu theo phòng ban hoặc nhóm được phép sử dụng."], ["Tìm và kiểm tra", "Tìm nội dung đã lưu và kiểm tra tài liệu trước khi đưa vào sử dụng."], ["Cập nhật tri thức", "Bổ sung phiên bản mới khi quy trình hoặc chính sách thay đổi."]]
  },
  "lemiex-overview": {
    title: "Lemiex AI — Tổng quan xưởng",
    summary: "Màn theo dõi tình hình vận hành xưởng fulfillment, tập trung vào số đơn, doanh thu, shipout, backlog và hiệu suất seller.",
    features: [["Số đơn và doanh thu", "Theo dõi hai kết quả chính của xưởng."], ["Tiến độ xử lý", "Xem đơn mới, item, shipout và các trạng thái vận hành."], ["Backlog", "Nhìn nhanh lượng việc tồn và tuổi đơn."], ["Seller", "Xem bảng xếp hạng và đóng góp theo seller."], ["Biểu đồ", "So sánh số liệu bằng biểu đồ cột, tròn và bảng chi tiết."]]
  },
  "lemiex-chat": {
    title: "Lemiex AI — Chatbox",
    summary: "Trợ lý vận hành xưởng, hỗ trợ hỏi số liệu, tìm đơn hàng, sản phẩm, tồn kho và các vấn đề fulfillment.",
    features: [["Hỏi số liệu linh hoạt", "Hỏi theo ngày, khoảng thời gian hoặc nội dung vận hành cụ thể."], ["Tìm đơn hàng", "Tra cứu bằng ID đơn, ref_id hoặc tracking."], ["Sản phẩm và tồn kho", "Hỏi sản phẩm đang có và số lượng còn lại theo quyền."], ["Ảnh và tệp", "Tải ảnh sản phẩm hoặc tài liệu để AI phân tích cùng dữ liệu xưởng."], ["Streaming và lịch sử", "Theo dõi câu trả lời trực tiếp và tiếp tục các phiên cũ."]]
  },
  "lemiex-reports": {
    title: "Lemiex AI — Báo cáo",
    summary: "Nơi xem lại các báo cáo vận hành xưởng được dựng từ số liệu theo từng ngày.",
    features: [["Chọn ngày", "Mở báo cáo của ngày cần kiểm tra."], ["Số liệu tổng hợp", "Xem đơn, doanh thu, shipout, backlog và các chỉ số chính."], ["Nhận định", "Đọc phần phân tích và điểm cần chú ý từ Lemiex AI."], ["Xem lại lịch sử", "So sánh các ngày mà không phải chạy lại toàn bộ quá trình."]]
  },
  "lemiex-backlog": {
    title: "Lemiex AI — Backlog",
    summary: "Màn theo dõi các đơn chưa hoàn thành, được chia theo trạng thái và thời gian tồn để đội vận hành ưu tiên xử lý.",
    features: [["Tổng backlog", "Xem số đơn đang còn trong quy trình."], ["Tuổi đơn", "Chia nhóm theo thời gian tồn để nhận biết đơn cần ưu tiên."], ["Theo trạng thái", "Xác định backlog đang tập trung ở bước nào."], ["Chọn ngày", "Xem lại tình hình backlog tại các mốc đã có dữ liệu."]]
  },
  users: {
    title: "Người dùng và phân quyền",
    summary: "Màn dành cho Admin để tạo tài khoản, sắp xếp người dùng theo phòng ban và cấp đúng Agent, dữ liệu, chức năng cần sử dụng.",
    features: [["Danh sách tài khoản", "Xem Admin, Manager và User trong hệ thống."], ["Tạo và chỉnh sửa", "Cập nhật tên, email, role, phòng ban và team."], ["Cấp quyền Agent", "Chọn Agent và chức năng người dùng được phép sử dụng."], ["Giới hạn dữ liệu", "Giới hạn team, store hoặc phạm vi dữ liệu cụ thể."], ["Khóa tài khoản", "Ngăn truy cập khi tài khoản không còn được sử dụng."]]
  },
  unanswered: {
    title: "Câu hỏi chưa trả lời được",
    summary: "Nơi Admin xem các câu hỏi mà AI chưa có đủ dữ liệu hoặc tài liệu để trả lời chính xác.",
    features: [["Danh sách câu hỏi", "Xem câu hỏi, người hỏi và Agent đã tiếp nhận."], ["Phân loại thiếu hụt", "Nhận biết đang thiếu tài liệu, số liệu hay chức năng."], ["Theo người dùng", "Xem nhu cầu thực tế của từng nhóm sử dụng."], ["Bổ sung tri thức", "Dùng danh sách này để ưu tiên cập nhật tài liệu hoặc dữ liệu."]]
  },
  sources: {
    title: "Nguồn dữ liệu",
    summary: "Màn dành cho Admin theo dõi những hệ thống đang cung cấp dữ liệu cho các Agent và tình trạng kết nối hiện tại.",
    features: [["Danh sách nguồn", "Xem các hệ thống đang được kết nối với Feline AI."], ["Tình trạng hoạt động", "Biết nguồn nào đang sẵn sàng hoặc gặp vấn đề."], ["Phạm vi sử dụng", "Xem nguồn đang phục vụ Agent hoặc phòng ban nào."], ["An toàn dữ liệu", "Ưu tiên kết nối chỉ đọc đối với dữ liệu nghiệp vụ."]]
  },
  audit: {
    title: "Nhật ký AI",
    summary: "Nơi Admin kiểm tra lịch sử hoạt động của AI để biết ai đã hỏi gì, Agent nào xử lý và yêu cầu có thành công hay không.",
    features: [["Lịch sử yêu cầu", "Xem thời gian, người gửi và Agent tiếp nhận."], ["Trạng thái xử lý", "Biết yêu cầu hoàn thành, bị dừng hay gặp lỗi."], ["Kiểm tra sự cố", "Dùng thông tin lỗi để tìm nguyên nhân khi hệ thống trả lời không thành công."], ["Theo dõi sử dụng", "Xem mức sử dụng AI phục vụ quản lý và tối ưu vận hành."]]
  }
};

window.productDocsData = { groups, docs };

if (document.querySelector("#docs-nav")) {
const flatItems = groups.flatMap((group) => group.items.map(([id, label]) => ({ id, label, group: group.title })));
const nav = document.querySelector("#docs-nav");
const documentNode = document.querySelector("#document");
const breadcrumb = document.querySelector("#breadcrumb");
const search = document.querySelector("#docs-search");
const sidebar = document.querySelector("#sidebar");
const backdrop = document.querySelector("#sidebar-backdrop");
const modeButtons = document.querySelectorAll("[data-mode]");
const planImport = document.querySelector("#plan-import");
const planStorageKey = "feline-product-roadmap-v1";
let activeMode = "current";

const defaultPlan = [
  { id: "common", name: "Chức năng chung", items: [] },
  { id: "ceo", name: "CEO AI", items: [] },
  { id: "tiktok", name: "TikTok AI", items: [] },
  { id: "etsy", name: "Etsy AI", items: [] },
  { id: "lemiex", name: "Lemiex AI", items: [] },
  { id: "admin", name: "Quản trị", items: [] }
];
let plan = loadPlan();

function loadPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(planStorageKey));
    return Array.isArray(saved) ? saved : structuredClone(defaultPlan);
  } catch { return structuredClone(defaultPlan); }
}

function savePlan(message = "Đã lưu kế hoạch trên thiết bị này") {
  localStorage.setItem(planStorageKey, JSON.stringify(plan));
  queueMicrotask(() => showPlanToast(message));
}

function renderNav(query = "") {
  if (activeMode === "planned") return renderPlanNav(query);
  const normalized = query.trim().toLocaleLowerCase("vi");
  const visible = groups.map((group) => ({ ...group, items: group.items.filter(([id, label]) => {
    const doc = docs[id];
    const searchable = [group.title, label, doc?.title, doc?.summary, ...(doc?.features || []).flat(), ...(doc?.roles || []).flat()].filter(Boolean).join(" ").toLocaleLowerCase("vi");
    return !normalized || searchable.includes(normalized);
  }) })).filter((group) => group.items.length);
  nav.innerHTML = visible.length ? visible.map((group) => `<section class="nav-group"><span class="nav-group-title">${group.title}</span>${group.items.map(([id, label]) => `<button class="nav-item" data-doc="${id}">${label}</button>`).join("")}</section>`).join("") : `<div class="nav-empty">Không tìm thấy màn hình phù hợp.</div>`;
  nav.querySelectorAll("[data-doc]").forEach((button) => button.addEventListener("click", () => openDoc(button.dataset.doc)));
  markActive();
}

function renderPlanNav(query = "") {
  const normalized = query.trim().toLocaleLowerCase("vi");
  const branches = plan.filter((branch) => !normalized || `${branch.name} ${branch.items.map((item) => `${item.name} ${item.description}`).join(" ")}`.toLocaleLowerCase("vi").includes(normalized));
  nav.innerHTML = branches.length ? `<section class="nav-group"><span class="nav-group-title">Chức năng sẽ phát triển</span>${branches.map((branch) => `<button class="nav-item" data-plan-branch="${branch.id}">${escapeHtml(branch.name)}</button>`).join("")}</section>` : `<div class="nav-empty">Không tìm thấy nhánh kế hoạch phù hợp.</div>`;
  nav.querySelectorAll("[data-plan-branch]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(`[data-branch-card="${button.dataset.planBranch}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    closeSidebar();
  }));
}

function openDoc(id, updateHash = true) {
  if (activeMode !== "current") setMode("current", false);
  documentNode.classList.remove("plan-page");
  const doc = docs[id] || docs.start;
  const item = flatItems.find((entry) => entry.id === id) || flatItems[0];
  const index = flatItems.findIndex((entry) => entry.id === item.id);
  const next = flatItems[index + 1];
  breadcrumb.textContent = `${item.group} / ${item.label}`;
  document.title = `${doc.title} — Feline AI`;
  documentNode.innerHTML = `
    <header class="document-head">
      <h1>${doc.title}</h1>
      <p>${doc.summary}</p>
      <div class="document-meta"><span class="meta-chip live">Đang sử dụng</span><span class="meta-chip">Cập nhật 19/11/2026</span></div>
    </header>
    ${id === "start" ? `<section class="doc-section"><h2>Hệ thống được chia như thế nào?</h2><div class="system-map"><div class="map-root">Feline AI</div><div class="map-groups"><div class="map-branch"><strong>Chức năng chung</strong><span>Công việc, báo cáo hằng ngày và văn phòng 3D.</span></div><div class="map-branch"><strong>Các trợ lý AI</strong><span>CEO, TikTok, Etsy, Kế toán và Lemiex phục vụ từng lĩnh vực riêng.</span></div><div class="map-branch"><strong>Quản trị</strong><span>Tài khoản, quyền truy cập, nguồn dữ liệu và lịch sử hoạt động.</span></div></div></div></section>` : ""}
    ${doc.roles ? `<section class="doc-section"><h2>Ai sử dụng màn này?</h2><div class="role-strip">${doc.roles.map(([name, copy]) => `<div class="role"><strong>${name}</strong><span>${copy}</span></div>`).join("")}</div></section>` : ""}
    <section class="doc-section"><h2>Chức năng chính</h2><ul class="feature-list">${doc.features.map(([name, copy]) => `<li><strong>${name}</strong><span>${copy}</span></li>`).join("")}</ul></section>
    ${doc.flow ? `<section class="doc-section"><h2>Cách sử dụng nhanh</h2><div class="quick-flow">${doc.flow.map(([name, copy]) => `<div class="flow-step"><strong>${name}</strong>${copy}</div>`).join("")}</div></section>` : ""}
    <div class="update-note"><strong>Tài liệu sống:</strong> Khi màn hình có chức năng mới hoặc thay đổi cách sử dụng, nội dung tại đây sẽ được cập nhật theo phiên bản thực tế.</div>
    ${next ? `<button class="next-doc" data-next="${next.id}"><span>Màn tiếp theo<strong>${next.label}</strong></span><b>→</b></button>` : ""}
  `;
  documentNode.querySelector("[data-next]")?.addEventListener("click", (event) => openDoc(event.currentTarget.dataset.next));
  if (updateHash) history.replaceState(null, "", `#${item.id}`);
  markActive();
  documentNode.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
}

function setMode(mode, render = true) {
  activeMode = mode;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  search.value = "";
  search.placeholder = mode === "planned" ? "Tìm trong kế hoạch phát triển" : "Tìm màn hình hoặc chức năng";
  if (mode === "planned") {
    history.replaceState(null, "", "#planned");
    renderPlan();
    renderPlanNav();
  } else if (render) {
    openDoc("start");
  } else {
    renderNav();
  }
  closeSidebar();
}

function renderPlan(options = {}) {
  const { resetScroll = true, scrollY = window.scrollY, focusBranchId = null } = options;
  breadcrumb.textContent = "Chức năng sẽ phát triển";
  document.title = "Chức năng sẽ phát triển — Feline AI";
  documentNode.classList.add("plan-page");
  documentNode.innerHTML = `
    <header class="document-head">
      <h1>Chức năng sẽ phát triển</h1>
      <p>Sơ đồ riêng để ghi lại các ý tưởng và chức năng dự kiến theo từng khu vực của Feline AI. Nội dung tại đây chưa phải chức năng đang có trên hệ thống.</p>
      <div class="document-meta"><span class="meta-chip">Kế hoạch tương lai</span><span class="meta-chip">Có thể thêm và xóa</span></div>
      <div class="plan-toolbar"><button class="primary" id="export-plan">Tải bản kế hoạch</button><button id="import-plan">Nhập bản kế hoạch</button><button id="reset-plan">Khôi phục kế hoạch mặc định</button></div>
      <p class="plan-local-note">Bản thử hiện lưu trên thiết bị đang sử dụng. Dùng “Tải bản kế hoạch” để sao lưu hoặc chuyển nội dung sang máy khác.</p>
    </header>
    <section class="plan-tree">
      <div class="plan-root">Feline AI — Kế hoạch phát triển</div>
      <div class="plan-branches" id="plan-branches">${plan.map(planBranchMarkup).join("")}</div>
      <form class="plan-add-branch" id="add-plan-branch"><label><span>Tên nhánh phát triển mới</span><input name="name" maxlength="80" placeholder="Ví dụ: Finance AI" required></label><button>Thêm nhánh</button></form>
    </section>
    <div class="plan-toast" id="plan-toast" role="status"></div>
  `;
  bindPlanEvents();
  if (focusBranchId) requestAnimationFrame(() => document.querySelector(`[data-branch-card="${focusBranchId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  else if (resetScroll) { documentNode.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  else requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
}

function planBranchMarkup(branch) {
  return `<section class="plan-branch" data-branch-card="${branch.id}">
    <div class="plan-branch-head"><strong>${escapeHtml(branch.name)}</strong><button type="button" data-remove-branch="${branch.id}">Xóa nhánh</button></div>
    <div class="plan-items">${branch.items.length ? branch.items.map((item) => `<div class="plan-item"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.description || "Chưa có mô tả")}</span><button type="button" data-remove-item="${branch.id}:${item.id}" aria-label="Xóa ${escapeHtml(item.name)}">×</button></div>`).join("") : `<div class="plan-empty">Chưa có chức năng dự kiến trong nhánh này.</div>`}</div>
    <form class="plan-add-item" data-add-item="${branch.id}"><label><span>Tên chức năng</span><input name="name" maxlength="100" placeholder="Ví dụ: Phân tích chiến dịch" required></label><label><span>Mô tả ngắn</span><input name="description" maxlength="240" placeholder="Chức năng này sẽ làm gì?"></label><button>Thêm</button></form>
  </section>`;
}

function bindPlanEvents() {
  documentNode.querySelectorAll("[data-add-item]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const branch = plan.find((item) => item.id === form.dataset.addItem);
    if (!branch) return;
    branch.items.push({ id: `feature-${Date.now()}`, name: String(data.get("name")).trim(), description: String(data.get("description")).trim() });
    savePlan();
    renderPlan({ resetScroll: false, focusBranchId: branch.id });
    renderPlanNav();
  }));
  documentNode.querySelectorAll("[data-remove-item]").forEach((button) => button.addEventListener("click", () => {
    const [branchId, itemId] = button.dataset.removeItem.split(":");
    const branch = plan.find((item) => item.id === branchId);
    if (!branch) return;
    const item = branch.items.find((entry) => entry.id === itemId);
    if (!item || !confirm(`Xóa chức năng “${item.name}” khỏi kế hoạch?`)) return;
    branch.items = branch.items.filter((item) => item.id !== itemId);
    savePlan("Đã xóa chức năng khỏi kế hoạch");
    renderPlan({ resetScroll: false, focusBranchId: branch.id });
    renderPlanNav();
  }));
  documentNode.querySelectorAll("[data-remove-branch]").forEach((button) => button.addEventListener("click", () => {
    const branch = plan.find((entry) => entry.id === button.dataset.removeBranch);
    if (!branch || !confirm(`Xóa nhánh “${branch.name}” cùng ${branch.items.length} chức năng dự kiến?`)) return;
    const scrollY = window.scrollY;
    plan = plan.filter((entry) => entry.id !== branch.id);
    savePlan("Đã xóa nhánh kế hoạch");
    renderPlan({ resetScroll: false, scrollY });
    renderPlanNav();
  }));
  documentNode.querySelector("#add-plan-branch").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = `branch-${Date.now()}`;
    plan.push({ id, name: String(data.get("name")).trim(), items: [] });
    savePlan("Đã thêm nhánh phát triển");
    renderPlan({ resetScroll: false, focusBranchId: id });
    renderPlanNav();
  });
  documentNode.querySelector("#export-plan").addEventListener("click", exportPlan);
  documentNode.querySelector("#import-plan").addEventListener("click", () => planImport.click());
  documentNode.querySelector("#reset-plan").addEventListener("click", () => {
    if (!confirm("Khôi phục kế hoạch mặc định? Toàn bộ chức năng bạn đã nhập trên thiết bị này sẽ bị xóa.")) return;
    plan = structuredClone(defaultPlan);
    savePlan("Đã làm mới kế hoạch");
    renderPlan();
    renderPlanNav();
  });
}

function exportPlan() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), branches: plan }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Ke_hoach_phat_trien_Feline_AI.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showPlanToast("Đã tải bản kế hoạch");
}

function showPlanToast(message) {
  const toast = document.querySelector("#plan-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function normalizeImportedPlan(imported) {
  if (!imported || !Array.isArray(imported.branches) || imported.branches.length > 50) throw new Error("Cấu trúc nhánh không hợp lệ.");
  return imported.branches.map((branch, branchIndex) => {
    if (!branch || typeof branch.name !== "string" || !branch.name.trim() || branch.name.length > 80 || !Array.isArray(branch.items) || branch.items.length > 200) {
      throw new Error(`Nhánh số ${branchIndex + 1} không hợp lệ.`);
    }
    return {
      id: `imported-branch-${branchIndex}-${Date.now()}`,
      name: branch.name.trim(),
      items: branch.items.map((item, itemIndex) => {
        if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 100 || (item.description != null && (typeof item.description !== "string" || item.description.length > 240))) {
          throw new Error(`Chức năng số ${itemIndex + 1} trong nhánh “${branch.name}” không hợp lệ.`);
        }
        return { id: `imported-item-${branchIndex}-${itemIndex}-${Date.now()}`, name: item.name.trim(), description: (item.description || "").trim() };
      })
    };
  });
}

function markActive() {
  const id = location.hash.slice(1) || "start";
  nav.querySelectorAll("[data-doc]").forEach((button) => button.classList.toggle("active", button.dataset.doc === id));
}

function openSidebar() { sidebar.classList.add("open"); backdrop.classList.add("show"); }
function closeSidebar() { sidebar.classList.remove("open"); backdrop.classList.remove("show"); }

search.addEventListener("input", () => renderNav(search.value));
modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
planImport.addEventListener("change", async () => {
  const file = planImport.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("File lớn hơn 1 MB.");
    const imported = JSON.parse(await file.text());
    plan = normalizeImportedPlan(imported);
    savePlan("Đã nhập bản kế hoạch");
    renderPlan();
    renderPlanNav();
  } catch (error) { alert(`Không thể nhập bản kế hoạch. ${error instanceof Error ? error.message : "Vui lòng chọn đúng file đã xuất từ trang này."}`); }
  planImport.value = "";
});
document.querySelector("#open-sidebar").addEventListener("click", openSidebar);
document.querySelector("#close-sidebar").addEventListener("click", closeSidebar);
backdrop.addEventListener("click", closeSidebar);
window.addEventListener("hashchange", () => location.hash === "#planned" ? setMode("planned") : openDoc(location.hash.slice(1) || "start", false));

if (location.hash === "#planned") setMode("planned");
else { renderNav(); openDoc(location.hash.slice(1) || "start", false); }
}
