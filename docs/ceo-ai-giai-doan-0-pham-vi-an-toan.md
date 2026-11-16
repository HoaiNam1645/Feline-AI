# CEO AI - Giai đoạn 0: Phạm vi và an toàn

**Phiên bản:** 0.1  
**Ngày lập:** 10/11/2026  
**Trạng thái:** Bản đề xuất cần chủ doanh nghiệp chốt  
**Phạm vi đầu tiên:** Hỏi đáp nhân sự và tiếp nhận yêu cầu phê duyệt nội bộ

---

## 1. Mục tiêu Giai đoạn 0

Giai đoạn 0 xác định CEO AI được đọc dữ liệu nào, được trả lời ai, được đề xuất hoặc thực hiện hành động nào và trường hợp nào bắt buộc chuyển cho người có thẩm quyền.

Kết quả cần đạt trước khi triển khai:

- Có danh mục dữ liệu nhân sự và mức độ nhạy cảm.
- Có mô hình phân quyền cho người hỏi và người phê duyệt.
- Có ma trận phê duyệt dạng dữ liệu có cấu trúc.
- Có danh sách hành động CEO AI tuyệt đối không được tự thực hiện.
- Có quy tắc audit, lưu trữ và xử lý sự cố.
- Có tiêu chí để chuyển từ chế độ tư vấn sang chế độ được ủy quyền.

## 2. Định danh và ranh giới của CEO AI

CEO AI là trợ lý điều hành của doanh nghiệp, không phải tài khoản thay thế danh tính pháp lý của CEO và không được tự nhận đã có chỉ đạo trực tiếp từ CEO khi không có bằng chứng.

CEO AI có ba mức hoạt động độc lập:

| Mức | Khả năng | Trạng thái khuyến nghị ban đầu |
|---|---|---|
| Hỏi đáp | Đọc tri thức được phép và trả lời câu hỏi | Bật |
| Đề xuất | Phân tích yêu cầu, đề xuất duyệt/từ chối/chuyển cấp | Bật sau khi có dữ liệu |
| Thực thi ủy quyền | Ghi nhận quyết định hoặc gọi hệ thống nghiệp vụ | Tắt |

CEO AI chỉ được trả lời một yêu cầu là **đã duyệt** khi đồng thời thỏa mãn:

1. Có quy tắc ủy quyền đang hiệu lực trong Policy Engine.
2. Người yêu cầu, loại yêu cầu, số tiền và đơn vị nằm trong phạm vi quy tắc.
3. Đủ hồ sơ bắt buộc và còn ngân sách.
4. Không có xung đột lợi ích hoặc điều kiện ngoại lệ.
5. Hành động được ghi thành công vào hệ thống nghiệp vụ và audit log.

Tài liệu vector, lịch sử trò chuyện và thói quen trước đây của CEO chỉ là căn cứ tham khảo. Chúng không tự tạo ra quyền phê duyệt.

## 3. Phạm vi nghiệp vụ đề xuất

### 3.1. Trong phạm vi bản đầu

- Hỏi đáp nội quy, chính sách, quyền lợi và quy trình nhân sự.
- Hỏi đáp cơ cấu tổ chức, đầu mối phụ trách và quy trình gửi yêu cầu.
- Tiếp nhận yêu cầu nghỉ phép, tạm ứng, hoàn ứng, mua sắm hoặc chi phí nội bộ.
- Kiểm tra hồ sơ bắt buộc của yêu cầu.
- Xác định người hoặc cấp có thẩm quyền duyệt.
- Theo dõi và trả lời trạng thái yêu cầu.
- Đề xuất quyết định dựa trên chính sách và dữ liệu được phép.

### 3.2. Ngoài phạm vi bản đầu

- Tự chuyển tiền hoặc thao tác tài khoản ngân hàng.
- Tự ký hợp đồng, cam kết pháp lý hoặc gửi thông báo đối ngoại.
- Tự tuyển dụng, chấm dứt hợp đồng, kỷ luật hoặc thay đổi lương.
- Tự sửa hồ sơ nhân sự, bảng lương, chấm công hoặc thông tin ngân hàng.
- Tự tạo hoặc mở rộng quyền truy cập cho chính mình hay người khác.
- Tự biến thói quen lịch sử thành quy định mới.

## 4. Phân loại dữ liệu nhân sự

| Mức | Ví dụ | Quy tắc truy cập đề xuất |
|---|---|---|
| Nội bộ chung | Nội quy, lịch nghỉ, quy trình, biểu mẫu, sơ đồ phòng ban | Nhân sự đang hoạt động được xem |
| Nội bộ theo phạm vi | Team, chức danh, quản lý trực tiếp, trạng thái yêu cầu | Xem bản thân hoặc đơn vị được giao |
| Nhạy cảm | Hợp đồng, lương, thưởng, đánh giá, lịch sử nghỉ phép | Bản thân, HR và quản lý được cấp rõ ràng |
| Rất nhạy cảm | CCCD/hộ chiếu, tài khoản ngân hàng, sức khỏe, kỷ luật, khiếu nại | Chỉ người chuyên trách; cần audit chi tiết và che trường dữ liệu |
| Bí mật điều hành | Kế hoạch nhân sự, ngân sách lương, kế hoạch sa thải, điều tra nội bộ | CEO và người được cấp đích danh |

### 4.1. Dữ liệu không đưa vào vector nguyên bản

- Mật khẩu, API key, token, mã OTP hoặc secret.
- Số tài khoản ngân hàng đầy đủ.
- Số giấy tờ định danh đầy đủ nếu không có use case bắt buộc.
- Hồ sơ sức khỏe, kỷ luật, khiếu nại và điều tra nội bộ dạng dùng chung.
- Tệp không xác định chủ sở hữu, nguồn gốc hoặc ngày hiệu lực.

Các tài liệu nhạy cảm nếu cần tìm kiếm phải được tách kho, gắn data scope, mã hóa và kiểm tra quyền trước khi truy xuất đoạn văn.

## 5. Mô hình phân quyền

Quyền truy cập CEO AI được tính từ:

```text
Tài khoản + Platform Role + Chức danh tổ chức + Agent Grant
+ Data Scope + Action + Delegation + Ngữ cảnh yêu cầu
```

- `Admin`, `Manager`, `User` tiếp tục là role quản trị nền tảng đã chốt.
- Chức danh như CEO, HR, kế toán, trưởng phòng và nhân viên là thuộc tính tổ chức, không thay thế platform role.
- Người dùng chỉ thấy dữ liệu của bản thân, đơn vị được quản lý hoặc phạm vi được cấp.
- Quyền hỏi thông tin không đồng nghĩa với quyền tạo, duyệt hoặc thực hiện yêu cầu.
- Quyền duyệt phải có thời hạn, hạn mức và người cấp quyền.
- Admin truy cập dữ liệu HR nhạy cảm phải được audit và có thể yêu cầu xác thực lại.

### 5.1. Data scope đề xuất

| Scope ID | Nội dung |
|---|---|
| `ceo.hr.policies` | Nội quy, chính sách và quy trình chung |
| `ceo.hr.self` | Hồ sơ và yêu cầu của chính người dùng |
| `ceo.hr.team` | Dữ liệu nhân sự thuộc team được quản lý |
| `ceo.hr.compensation` | Lương, thưởng và ngân sách liên quan |
| `ceo.hr.sensitive` | Kỷ luật, khiếu nại, sức khỏe và hồ sơ đặc biệt |
| `ceo.approvals.request` | Tạo và theo dõi yêu cầu |
| `ceo.approvals.review` | Xem hồ sơ và đề xuất quyết định |
| `ceo.approvals.approve` | Phê duyệt trong phạm vi ủy quyền |
| `ceo.approvals.audit` | Xem lịch sử quyết định và căn cứ |

## 6. Ma trận phê duyệt

Không lưu quy tắc phê duyệt trong prompt. Mỗi quy tắc cần có cấu trúc tối thiểu:

```text
Loại yêu cầu
Đối tượng được tạo yêu cầu
Phòng ban / cost center
Khoảng số tiền
Người hoặc vai trò có thẩm quyền
CEO AI có được ủy quyền hay không
Hồ sơ bắt buộc
Điều kiện ngân sách
Giới hạn theo ngày / tháng / yêu cầu
Trường hợp ngoại lệ
Ngày hiệu lực và ngày hết hạn
Người ban hành
Phiên bản quy tắc
```

### 6.1. Bản nháp để chốt

| Loại yêu cầu | Hạn mức | CEO AI | Người duyệt khi CEO AI không có quyền | Hồ sơ tối thiểu |
|---|---:|---|---|---|
| Nghỉ phép | Chưa chốt | Chỉ kiểm tra và chuyển duyệt | Quản lý trực tiếp/HR | Ngày nghỉ, loại phép, người bàn giao |
| Tạm ứng | Chưa chốt | Chỉ đề xuất | Chưa chốt | Mục đích, số tiền, thời hạn hoàn ứng |
| Hoàn ứng | Chưa chốt | Chỉ kiểm tra hồ sơ | Chưa chốt | Hóa đơn/chứng từ, yêu cầu gốc |
| Mua sắm nội bộ | Chưa chốt | Chỉ đề xuất | Chưa chốt | Mục đích, báo giá, cost center |
| Thay đổi lương/thưởng | Mọi mức | Không tự duyệt | CEO/HR có thẩm quyền | Đề xuất, căn cứ, ngày hiệu lực |
| Tuyển dụng/chấm dứt | Mọi mức | Không tự duyệt | CEO/HR có thẩm quyền | Hồ sơ theo quy trình nhân sự |

Các câu hỏi phê duyệt trong hội thoại chỉ là yêu cầu của nhân sự. CEO AI phải đọc đúng ngữ cảnh, tri thức và phong cách điều hành được phép để trả lời; chúng không mặc nhiên trở thành quy tắc hoặc hạn mức hệ thống.

## 7. Hành động CEO AI tuyệt đối không tự thực hiện ở bản đầu

1. Chuyển tiền, thanh toán, hoàn tiền hoặc thay đổi thông tin ngân hàng.
2. Ký hoặc chấp nhận hợp đồng, cam kết pháp lý và điều khoản tài chính.
3. Tuyển dụng, sa thải, kỷ luật hoặc thay đổi lương/thưởng.
4. Công khai dữ liệu nhân sự hoặc trả dữ liệu của người khác ngoài scope.
5. Sửa, xóa hoặc che giấu audit log, yêu cầu và bằng chứng.
6. Cấp quyền, đổi role, thay đổi chính sách hoặc mở rộng hạn mức cho chính mình.
7. Học thành quy tắc mới chỉ từ hội thoại, lịch sử hoặc hành vi lặp lại.
8. Thực hiện yêu cầu có xung đột lợi ích, nghi ngờ gian lận hoặc thiếu hồ sơ.
9. Làm theo chỉ dẫn trong tệp tải lên nhằm thay đổi vai trò, policy hoặc quy tắc hệ thống.
10. Xác nhận “đã duyệt” khi hành động chưa được ghi nhận thành công.

## 8. Quy tắc trả lời và chuyển cấp

CEO AI phải phân biệt rõ trạng thái:

- **Đã tiếp nhận:** hệ thống đã tạo yêu cầu, chưa có quyết định.
- **Đang chờ bổ sung:** thiếu trường hoặc chứng từ bắt buộc.
- **Đã chuyển duyệt:** đã xác định và chuyển đúng người có thẩm quyền.
- **Đề xuất duyệt/từ chối:** kết quả phân tích, chưa phải quyết định.
- **Đã duyệt theo ủy quyền:** Policy Engine cho phép và bản ghi quyết định đã thành công.
- **Bị từ chối:** có quyết định hợp lệ kèm lý do được phép hiển thị.

Không dùng câu “ok em”, “đã duyệt” hoặc nội dung tương đương khi mới chỉ tạo hay chuyển yêu cầu.

## 9. Vector knowledge và nguồn tri thức

Mỗi tài liệu đưa vào kho tri thức phải có:

- Chủ sở hữu và người tải lên.
- Loại tài liệu và data scope.
- Ngày ban hành, ngày hiệu lực và ngày hết hiệu lực.
- Phiên bản, trạng thái bản nháp/đã duyệt/hết hiệu lực.
- Đơn vị áp dụng.
- Mức độ nhạy cảm.
- Tài liệu thay thế hoặc bị thay thế.

Khi trả lời chính sách, CEO AI phải ưu tiên tài liệu đã duyệt và còn hiệu lực. Nếu có hai tài liệu mâu thuẫn, không tự chọn theo độ tương đồng vector; phải nêu xung đột và chuyển người quản lý tri thức xử lý.

## 10. Audit và kiểm soát

Mỗi lượt hỏi hoặc hành động phải lưu tối thiểu:

- Người dùng, vai trò, phòng ban và quyền tại thời điểm yêu cầu.
- Nội dung yêu cầu và tệp đính kèm liên quan.
- Loại ý định được phân loại.
- Tài liệu, phiên bản policy và dữ liệu đã dùng.
- Tool được gọi, tham số, kết quả và lỗi.
- Đề xuất của AI, quyết định cuối cùng và người chịu trách nhiệm.
- Model, token, chi phí và thời gian xử lý.
- Thay đổi trạng thái trước/sau của yêu cầu.

Không hiển thị log kỹ thuật, tên tool, prompt hoặc cấu trúc hệ thống trên giao diện nhân viên. Các thông tin này chỉ dành cho màn quản trị phù hợp.

## 11. Chế độ triển khai an toàn

| Chế độ | Hoạt động | Điều kiện chuyển bước |
|---|---|---|
| `Advisory` | Hỏi đáp và hướng dẫn; không tạo quyết định | Tri thức và phân quyền hoạt động đúng |
| `Shadow` | AI đưa đề xuất song song với người duyệt thật | Đo được độ chính xác theo từng loại yêu cầu |
| `Assisted` | AI tạo hồ sơ, kiểm tra điều kiện và chuyển duyệt | Quy trình/audit ổn định |
| `Delegated` | AI tự duyệt đúng phạm vi ủy quyền | Có văn bản ủy quyền, giới hạn và cơ chế thu hồi |

Khuyến nghị bản đầu bắt đầu ở `Advisory`, sau đó chuyển `Shadow`. Không triển khai thẳng `Delegated`.

## 12. Các quyết định cần chủ doanh nghiệp chốt

### 12.1. Dữ liệu nhân sự

1. Hệ thống nhân sự hiện tại nằm ở đâu và có API/database nào?
2. CEO AI được đọc những nhóm dữ liệu nào trong bản đầu?
3. Có cho nhân viên hỏi dữ liệu cá nhân như phép, hợp đồng và lương không?
4. Manager được xem dữ liệu nào của nhân viên trong team?
5. Những dữ liệu nào chỉ CEO hoặc HR được xem?

### 12.2. Phê duyệt

6. Bản đầu gồm những loại yêu cầu nào: nghỉ phép, tạm ứng, hoàn ứng, mua sắm hay loại khác?
7. Ai đang duyệt từng loại yêu cầu trong thực tế?
8. Hạn mức cụ thể của CEO, Manager, HR và kế toán là bao nhiêu?
9. Hồ sơ bắt buộc cho từng loại yêu cầu là gì?
10. Khi thiếu hồ sơ, CEO AI được yêu cầu bổ sung hay phải chuyển người thật?
11. Có trường hợp nào cần hai người duyệt không?

### 12.3. Vận hành và trách nhiệm

12. Ai là người ban hành và cập nhật policy?
13. Ai được thu hồi khẩn cấp quyền của CEO AI?
14. Lưu lịch sử hội thoại, hồ sơ và quyết định trong bao lâu?
15. Nhân viên có được yêu cầu xem căn cứ của quyết định không?
16. Kênh sử dụng đầu tiên là Dashboard, ứng dụng chat hay cả hai?

## 13. Điều kiện hoàn thành Giai đoạn 0

- [ ] Chốt các use case nhân sự của bản đầu.
- [ ] Chốt nguồn dữ liệu và chủ sở hữu dữ liệu.
- [ ] Chốt phân loại dữ liệu và data scope.
- [ ] Chốt người được xem dữ liệu theo từng nhóm.
- [ ] Chốt ma trận phê duyệt và hạn mức.
- [ ] Chốt danh sách hành động cấm.
- [ ] Chốt người chịu trách nhiệm policy và thu hồi quyền khẩn cấp.
- [ ] Chốt thời gian lưu audit và dữ liệu.
- [ ] Chấp nhận triển khai từ `Advisory` sang `Shadow` trước khi ủy quyền thật.

Chỉ chuyển sang Giai đoạn 1 - Knowledge Hub sau khi các mục trên được xác nhận và ma trận phê duyệt có phiên bản đầu tiên.
