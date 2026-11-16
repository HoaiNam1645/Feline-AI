# Feline AI — Đặc tả chức năng và phân quyền theo role

**Phiên bản:** 1.0  
**Ngày chốt:** 02/11/2026  
**Trạng thái:** Đã chốt để triển khai  
**Phạm vi:** Dashboard, API, Agent Runtime, dữ liệu, báo cáo, audit và phê duyệt

---

## 1. Mục đích

Tài liệu này chốt mô hình người dùng và chức năng theo role cho nền tảng Feline AI. Mục tiêu là:

- Quản lý được nhiều AI theo từng domain, không thiết kế riêng cho Lemiex AI.
- Giới hạn agent, capability và dữ liệu theo đúng trách nhiệm người dùng.
- Cho phép Manager tự quản lý User trong phạm vi được Admin giao nhưng không thể tự nâng quyền.
- Giữ toàn bộ thay đổi quyền, lần chạy AI, tool call và phê duyệt trong audit log.
- Làm nguồn chuẩn cho thiết kế database, API, Dashboard và kiểm thử phân quyền.

## 2. Kết luận sau khi rà soát tài liệu cũ

### 2.1. Các nội dung tiếp tục giữ nguyên

- Dashboard responsive là kênh quản trị chính; truy cập từ xa qua Tailscale và vẫn phải đăng nhập riêng.
- Agent không truy cập trực tiếp database nguồn và không tự viết SQL.
- Metrics Engine định nghĩa KPI dùng chung cho Agent và Dashboard.
- Data Gateway/connector là cổng dữ liệu; tài khoản nguồn ưu tiên chỉ đọc.
- Tool chạy qua allowlist, có audit và chịu kiểm soát bởi mức rủi ro `R0–R3`.
- API key, mật khẩu và secret không xuất hiện trong mã nguồn, prompt hoặc response frontend.

### 2.2. Quyết định mới thay thế nội dung cũ

| Nội dung cũ | Quyết định mới |
|---|---|
| “Group xem tất cả” | Không còn là chính sách chung. Mỗi người chỉ xem agent và data scope được cấp. |
| Role và phân quyền dự kiến ở Giai đoạn 3 | Đưa lên triển khai ngay sau Dashboard nền tảng vì hệ thống đã định hướng nhiều agent. |
| Dashboard tối giản cho một Agent | Dashboard cấp nền tảng hiển thị nhiều agent; mỗi agent có menu và dữ liệu riêng. |
| Người dùng/vai trò chưa chốt | Chốt 3 role: `Admin`, `Manager`, `User`. |

### 2.3. Telegram và kênh nhóm

- Báo cáo gửi vào group chỉ được chứa data scope mà toàn bộ thành viên hợp lệ trong group đều được phép xem.
- Hỏi đáp có dữ liệu phân quyền riêng phải thực hiện qua Dashboard hoặc private chat đã liên kết tài khoản.
- Không dùng một group chung để trả dữ liệu nhạy cảm khác nhau theo từng người.
- Khi triển khai Telegram, `telegram_user_id` phải liên kết với một tài khoản Feline AI đang hoạt động.

## 3. Ba role đã chốt

### 3.1. Admin — toàn quyền nền tảng

Admin quản lý toàn bộ nền tảng, người dùng, agent, nguồn dữ liệu, cấu hình, audit và chính sách.

Admin được phép:

- Tạo, sửa, bật/tắt và gán chủ sở hữu cho agent.
- Tạo tài khoản, đổi role, khóa tài khoản và thu hồi phiên đăng nhập.
- Gán agent, capability, data scope và action cho Manager/User.
- Quản lý connector, lịch chạy, ngân sách, model và cấu hình hệ thống.
- Xem audit toàn hệ thống, usage và chi phí.
- Phê duyệt hành động theo chính sách `R1–R3`.

Giới hạn bắt buộc:

- Không được xóa hoặc hạ quyền Admin cuối cùng.
- “Toàn quyền” không bỏ qua hard safety: không SQL tự do, không bypass tool allowlist, không tự động mở PII đã bị loại khỏi source view.
- Secret chỉ hiển thị trạng thái đã cấu hình; giá trị hiện tại không được trả lại frontend.

### 3.2. Manager — quản lý theo Agent

Manager chỉ quản lý các agent mà Admin đã giao.

Manager được phép trong agent được giao:

- Xem dashboard, báo cáo, dữ liệu và audit theo data scope của chính mình.
- Chạy capability được cấp.
- Gán User vào agent và cấp quyền nằm trong phạm vi Manager đang sở hữu.
- Thu hồi quyền User trong agent mình quản lý.
- Xem usage, lỗi và hoạt động của agent được giao.
- Phê duyệt `R1`; có thể phê duyệt `R2` nếu Admin cấp action `approve` và Policy cho phép.

Manager không được phép:

- Tạo Admin hoặc Manager khác.
- Tự thêm agent/data/capability cho chính mình.
- Cấp cho User quyền lớn hơn phạm vi của mình.
- Xem hoặc sửa API key, mật khẩu connector và secret.
- Thay đổi cấu hình toàn nền tảng.
- Phê duyệt `R3`.

### 3.3. User — sử dụng theo Agent và Data Scope

User chỉ thấy và sử dụng agent, capability, dữ liệu được cấp cụ thể.

User có thể được cấp:

- Xem dashboard hoặc báo cáo của agent.
- Chạy capability `R0` được cho phép.
- Hỏi đáp trong phạm vi metric/query đã duyệt.
- Xem lịch sử chạy của chính mình hoặc lịch sử được chia sẻ trong agent.
- Xuất báo cáo nếu có action `export`.

User không được phép:

- Cấp quyền cho người khác.
- Quản lý agent, connector, model hoặc ngân sách.
- Xem secret hoặc audit toàn hệ thống.
- Phê duyệt hành động `R1–R3`.
- Truy cập dữ liệu ngoài data scope dù biết URL hoặc run ID.

## 4. Role không phải là toàn bộ quyền

Quyết định truy cập phải được tính từ năm thành phần:

```text
User + Role + Agent + Capability + Data Scope + Action
```

Role xác định trần quản trị. Quyền thực tế được xác định theo từng assignment.

Ví dụ:

```text
Manager A
  Agent: Lemiex AI
  Capabilities: daily-review, backlog-investigation
  Data scopes: operations-basic, operations-costs
  Actions: view, run, export, manage-members, approve-r1

User B
  Agent: Lemiex AI
  Capabilities: daily-review
  Data scopes: operations-basic
  Actions: view
```

User B không thấy chi phí, không chạy backlog investigation và không quản lý thành viên dù cùng truy cập Lemiex AI.

## 5. Mô hình Data Scope

Một data scope có thể giới hạn theo:

| Thành phần | Ví dụ |
|---|---|
| Domain | Xưởng Lemiex, Sales, Finance |
| Nguồn | `shop-test`, hệ thống bán hàng, kế toán |
| Dataset/metric | KPI cơ bản, backlog, chi phí, lợi nhuận |
| Field | Ẩn tên, email, địa chỉ, API key |
| Row scope | Xưởng, team, kênh bán hàng, khu vực |
| Time range | 30 ngày, 12 tháng, không giới hạn |
| Aggregation | Chỉ số tổng hợp hoặc chi tiết đơn |

### 5.1. Data scope ban đầu cho Lemiex AI

| Scope ID | Nội dung | Mặc định |
|---|---|---|
| `lemiex.operations.basic` | Đơn, item, workflow, shipout, backlog, remake, data quality | Manager/User được cấp |
| `lemiex.operations.costs` | Chi phí fulfillment đã được duyệt | Chỉ cấp riêng |
| `lemiex.operations.detail` | Chi tiết vận hành theo đơn qua view đã loại PII | Chỉ cấp khi cần |
| `lemiex.operations.audit` | Run, tool call, token và lỗi trong Lemiex AI | Manager được cấp; User tùy chọn |

Không role nào được truy cập trực tiếp bảng nguồn hoặc PII đã bị loại khỏi connector view.

## 6. Danh mục action chuẩn

| Action | Ý nghĩa |
|---|---|
| `view` | Xem màn hình, báo cáo hoặc dữ liệu |
| `run` | Chạy capability |
| `export` | Xuất/tải báo cáo |
| `approve` | Duyệt hành động theo Policy |
| `manage_members` | Gán/thu hồi User trong agent |
| `manage_agent` | Sửa cấu hình agent |
| `manage_data_scope` | Tạo/sửa phạm vi dữ liệu |
| `manage_sources` | Quản lý connector và secret |
| `view_audit` | Xem audit được phép |
| `view_cost` | Xem token, usage và chi phí |
| `manage_platform` | Cấu hình toàn nền tảng |

Mặc định từ chối nếu không có assignment phù hợp.

## 7. Ma trận chức năng theo role

Ký hiệu: `Toàn bộ` = toàn nền tảng; `Theo scope` = chỉ trong assignment; `Không` = không được phép.

| Nhóm chức năng | Admin | Manager | User |
|---|---:|---:|---:|
| Đăng nhập, đổi mật khẩu, đăng xuất | Toàn bộ | Cá nhân | Cá nhân |
| Xem Dashboard chung | Toàn bộ | Agent được giao | Agent được cấp |
| Xem danh mục Agent | Toàn bộ | Agent được giao | Agent được cấp |
| Xem Dashboard Agent | Toàn bộ | Theo scope | Theo scope |
| Xem báo cáo | Toàn bộ | Theo data scope | Theo data scope |
| Xem KPI/metric | Toàn bộ | Theo data scope | Theo data scope |
| Xem chi phí nghiệp vụ | Toàn bộ | Khi được cấp | Khi được cấp |
| Xem token/chi phí AI | Toàn bộ | Agent được giao | Khi được cấp |
| Chạy capability R0 | Toàn bộ | Khi được cấp | Khi được cấp |
| Hỏi đáp với Agent | Toàn bộ | Khi được cấp | Khi được cấp |
| Xuất báo cáo | Toàn bộ | Khi được cấp | Khi được cấp |
| Xem run/tool call | Toàn bộ | Agent được giao | Run của mình hoặc được chia sẻ |
| Xem audit toàn hệ thống | Toàn bộ | Không | Không |
| Xem audit theo Agent | Toàn bộ | Agent được giao | Khi được cấp |
| Tạo/sửa/bật tắt Agent | Toàn bộ | Không | Không |
| Quản lý capability/tool allowlist | Toàn bộ | Không | Không |
| Quản lý User trong Agent | Toàn bộ | Theo scope | Không |
| Tạo hoặc khóa User | Toàn bộ | Không | Không |
| Gán role Admin/Manager | Toàn bộ | Không | Không |
| Gán Agent/Data Scope | Toàn bộ | User trong phạm vi của mình | Không |
| Quản lý connector/secret | Toàn bộ | Không | Không |
| Quản lý model, budget, scheduler | Toàn bộ | Không | Không |
| Phê duyệt R1 | Có | Khi được cấp | Không |
| Phê duyệt R2 | Có | Khi Policy + Admin cho phép | Không |
| Phê duyệt R3 | Có, bắt buộc xác thực lại | Không | Không |

## 8. Chức năng Dashboard theo role

### 8.1. Menu Admin

```text
Tổng quan
  - Chung
  - Hoạt động AI
AI Agents
  - Từng Agent
      - Tổng quan
      - Báo cáo
      - Dữ liệu/Backlog
      - Run history
Quản trị
  - Người dùng
  - Role & quyền
  - Nguồn dữ liệu
  - Agent Registry
  - Audit
  - Usage & chi phí
  - Cấu hình
```

### 8.2. Menu Manager

```text
Tổng quan
  - Chung trong phạm vi được giao
  - Hoạt động AI
AI Agents
  - Chỉ các Agent được giao
      - Tổng quan
      - Báo cáo
      - Dữ liệu được phép
      - Thành viên
      - Audit theo Agent
```

### 8.3. Menu User

```text
Tổng quan
AI Agents
  - Chỉ các Agent được cấp
      - Các submenu tương ứng action/data scope
Lịch sử của tôi
```

Frontend chỉ ẩn menu để cải thiện trải nghiệm; backend vẫn phải kiểm tra quyền ở mọi API.

## 9. Quy tắc cấp và thu hồi quyền

1. Mặc định từ chối.
2. Admin có thể cấp mọi assignment hợp lệ.
3. Manager chỉ cấp User trong agent/data/action mà Manager đang sở hữu.
4. Manager không thể cấp `manage_agent`, `manage_sources`, `manage_platform` hoặc role cao hơn.
5. Thu hồi agent phải đồng thời thu hồi capability, data scope và phiên truy cập liên quan.
6. Tài khoản bị khóa phải mất quyền ở request kế tiếp; không chờ token hết hạn dài.
7. Mọi thay đổi quyền lưu người thực hiện, trước/sau thay đổi, lý do và thời gian.
8. Quyền tạm thời phải có `expires_at` và tự hết hạn.
9. Không cho phép người dùng tự sửa assignment của chính mình.

## 10. Quan hệ với mức rủi ro AI R0–R3

Role người dùng và risk level là hai lớp độc lập:

| Risk | Ví dụ | Quy tắc role |
|---|---|---|
| R0 | Đọc dữ liệu, tính KPI, soạn báo cáo | User/Manager chạy khi được cấp `run` |
| R1 | Tạo task, thông báo nội bộ | Manager/Admin có thể duyệt theo Policy |
| R2 | Gửi ra ngoài, thay đổi giá trong hạn mức | Admin hoặc Manager được cấp rõ ràng |
| R3 | Chuyển tiền, xóa dữ liệu, thay đổi quyền | Chỉ Admin; xác thực lại, có thể yêu cầu hai người duyệt |

Role không tự động cho phép hành động. Policy Engine vẫn kiểm tra agent, capability, tool, tham số, hạn mức và approval.

## 11. Service Identity

API, worker, scheduler và connector sử dụng `Service Identity`, không dùng tài khoản người thật.

- Không xuất hiện trong lựa chọn role trên Dashboard.
- Chỉ có permission kỹ thuật tối thiểu.
- Credential có vòng đời và có thể rotate.
- Mọi job vẫn ghi `service_identity_id` và `triggered_by_user_id` nếu do người dùng kích hoạt.

## 12. Mô hình dữ liệu cần triển khai

Các entity tối thiểu:

```text
User
RoleAssignment
Session
AgentDefinition
CapabilityDefinition
DataScope
AgentAccessGrant
ApprovalGrant
AccessAuditEvent
ServiceIdentity
```

`AgentAccessGrant` tối thiểu gồm:

```text
user_id
agent_id
capability_ids[]
data_scope_ids[]
actions[]
granted_by
expires_at
created_at
revoked_at
```

Không lưu permission dưới dạng chuỗi không kiểm soát; dùng danh mục action có version.

## 13. API chức năng cần có

### Xác thực

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/change-password`

### Agent Registry

- `GET /agents`
- `GET /agents/:agentId`
- `GET /agents/:agentId/capabilities`
- `GET /agents/:agentId/my-access`

### Quản lý người dùng và quyền

- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `POST /admin/access-grants`
- `PATCH /admin/access-grants/:id`
- `DELETE /admin/access-grants/:id`
- `GET /admin/access-audit`

Manager dùng endpoint scope theo agent, không dùng API toàn hệ thống:

- `GET /agents/:agentId/members`
- `POST /agents/:agentId/members`
- `PATCH /agents/:agentId/members/:userId`
- `DELETE /agents/:agentId/members/:userId`

## 14. Quy tắc bảo mật bắt buộc

- Mật khẩu hash bằng Argon2id hoặc bcrypt với cấu hình được kiểm thử.
- Khóa tạm thời sau nhiều lần đăng nhập sai; mọi lần sai ghi audit và rate limit.
- Session/cookie `HttpOnly`, `Secure`, `SameSite`; CSRF protection nếu dùng cookie.
- Không tin role hoặc data scope do frontend gửi lên.
- Mọi truy vấn dữ liệu phải nhận scope từ access context phía server.
- Object-level authorization: biết `runId`, `reportId` hoặc `agentId` không đồng nghĩa được xem.
- Secret mã hóa khi lưu, mask trên UI, không ghi log.
- PII bị loại ở connector/view vẫn giữ nguyên, Admin không mặc định mở lại.
- Remote access qua Tailscale; không mở database, Redis hoặc trang quản trị trực tiếp ra Internet.

## 15. Audit bắt buộc

Phải ghi audit cho:

- Đăng nhập thành công/thất bại, đăng xuất, khóa tài khoản.
- Tạo/sửa/khóa User.
- Đổi role, cấp hoặc thu hồi access grant.
- Chạy agent/capability, tool call, model, token và chi phí.
- Xem hoặc xuất data scope nhạy cảm.
- Tạo và quyết định approval.
- Thay đổi connector, model, budget, scheduler hoặc Agent Registry.

Audit bảo mật không cho Manager/User sửa hoặc xóa.

## 16. Thứ tự triển khai đã chốt

### Đợt A — nền phân quyền

1. User, đăng nhập, session và khóa đăng nhập sai.
2. Ba role `Admin`, `Manager`, `User`.
3. Agent Registry động và API `/agents`.
4. Data Scope và Access Grant.
5. Guard kiểm tra Agent + Capability + Data Scope + Action.
6. Dashboard sinh menu từ access context.

### Đợt B — quản trị

1. Màn hình người dùng và phân quyền Admin.
2. Màn hình thành viên theo Agent cho Manager.
3. Audit thay đổi quyền.
4. Usage và chi phí theo Agent.

### Đợt C — hành động có phê duyệt

1. Policy Engine `R1–R3`.
2. Approval inbox.
3. Xác thực lại cho R3.
4. Quyền tạm thời và hạn mức.

## 17. Tiêu chí nghiệm thu

- Admin thấy toàn bộ agent; Manager/User chỉ thấy agent được cấp.
- API trả `403` khi truy cập agent, report, run hoặc data scope ngoài quyền, kể cả gọi URL trực tiếp.
- Manager không thể cấp User quyền vượt quá phạm vi của mình.
- User không thể gọi capability không được cấp.
- Thu hồi quyền có hiệu lực ngay ở request tiếp theo.
- Menu Dashboard khớp access context nhưng không được dùng như lớp bảo mật duy nhất.
- Mọi lần cấp/thu hồi quyền có audit trước/sau.
- Secret không xuất hiện trong API response, frontend bundle hoặc log.
- Kiểm thử ngang quyền và leo thang quyền đều đạt.

## 18. Quyết định cuối cùng

Feline AI sử dụng đúng ba role người dùng:

1. **Admin:** toàn quyền quản trị nền tảng.
2. **Manager:** quản lý theo Agent, chỉ trong phạm vi Admin giao.
3. **User:** sử dụng theo Agent, Capability, Data Scope và Action được cấp.

Mọi quyền mặc định bị từ chối. Manager không thể tự nâng quyền hoặc cấp vượt phạm vi. Hard safety của dữ liệu và Agent Runtime áp dụng cho tất cả role, kể cả Admin.

