# STM32 智能消毒机后端接口规范 (v1)

## 1. 目标

- 前端先行：在后端未完成时，界面可通过 Mock 模式先运行。
- 前后端对齐：后端严格按本规范实现接口，前端可无缝联调。
- 设备模式说明：
  - 加热模式：手动设定固定时长，仅开启加热。
  - 消毒模式：手动设定固定时长，仅开启消毒灯。
  - 智能模式：加热和消毒灯同时启动，并依据温湿度阈值自动调节加热与风扇。

## 2. 基础约定

- 基础路径：/api/v1
- 请求类型：application/json
- 字符编码：utf-8
- 时间格式：ISO-8601（例如 2026-03-14T06:30:00.000Z）

## 3. 统一响应结构

所有接口均返回如下结构：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

- code = 0：成功
- code != 0：业务失败

推荐错误码：

- 1001：参数非法
- 1002：柜门打开，禁止启动
- 1003：设备已在运行
- 1004：设备当前为空闲
- 1005：阈值范围非法
- 1006：暂停/恢复状态非法
- 2001：控制器离线
- 2002：串口或 MQTT 下发失败

## 4. 枚举定义

### 4.1 模式 mode

- 加热模式
- 消毒模式
- 智能模式

### 4.2 设备状态

- machineRunning：是否运行中（true/false）
- paused：是否暂停（true/false）
- doorOpen：柜门是否打开（true/false）
- 执行器状态：
  - heaterOn
  - disinfectionOn
  - fanOn

## 5. 接口清单

## 5.1 获取实时运行状态

### 请求

- Method: GET
- Path: /disinfector/runtime-status

### 响应 data 示例

```json
{
  "machineRunning": true,
  "paused": false,
  "selectedMode": "智能模式",
  "duration": 20,
  "remainingSeconds": 0,
  "temperature": 31.2,
  "humidity": 58.4,
  "doorOpen": false,
  "heaterOn": true,
  "disinfectionOn": true,
  "fanOn": false,
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65,
  "updatedAt": "2026-03-14T06:30:00.000Z"
}
```

## 5.2 获取配置（阈值）

### 请求

- Method: GET
- Path: /disinfector/config

### 响应 data 示例

```json
{
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65
}
```

## 5.3 更新阈值

### 请求

- Method: PUT
- Path: /disinfector/thresholds

### 请求体

```json
{
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65
}
```

### 校验规则

- tempLow < tempHigh
- humidityLow < humidityHigh
- 建议范围：
  - 温度：10~60
  - 湿度：20~95

### 响应 data 示例

```json
{
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65
}
```

## 5.4 启动任务

### 请求

- Method: POST
- Path: /disinfector/tasks/start

### 请求体

```json
{
  "mode": "智能模式",
  "duration": 20,
  "thresholds": {
    "tempLow": 24,
    "tempHigh": 34,
    "humidityLow": 45,
    "humidityHigh": 65
  }
}
```

### 说明

- 加热模式、消毒模式：duration 必须 >= 5。
- 智能模式：后端可忽略 duration，持续运行直到停止。
- doorOpen = true 时必须返回 code=1002。

### 响应 data

返回与 runtime-status 相同结构，便于前端立即刷新。

## 5.5 暂停/继续任务

### 请求

- Method: POST
- Path: /disinfector/tasks/pause

### 请求体

```json
{
  "action": "pause"
}
```

action 可选值：

- pause
- resume

### 行为规则

- pause：保留任务上下文，临时关闭执行器。
- resume：在当前上下文上继续执行。
- 手动模式下，继续后应从 remainingSeconds 接续，不重置倒计时。
- 设备空闲时调用暂停/继续，可返回 code=1004 或 code=1006。

### 响应 data

返回与 runtime-status 相同结构。

## 5.6 停止任务

### 请求

- Method: POST
- Path: /disinfector/tasks/stop

### 请求体

```json
{}
```

### 响应 data

返回与 runtime-status 相同结构。

## 6. 智能模式控制规则（后端）

当 mode=智能模式：

- 启动时：
  - heaterOn = true
  - disinfectionOn = true
- 运行循环（建议 1~2 秒）：
  - temperature > tempHigh 时：heaterOn = false
  - temperature < tempLow 时：heaterOn = true
  - humidity > humidityHigh 或 temperature > tempHigh 时：fanOn = true
  - humidity <= humidityHigh 且 temperature <= tempHigh 时：fanOn = false

## 7. 实时更新建议

当前前端行为：

- 每 2~5 秒轮询 GET /disinfector/runtime-status。

可选升级：

- SSE：/disinfector/events
- WebSocket：/ws/disinfector

## 8. 幂等与并发建议

- 运行中重复调用启动：建议返回 code=1003。
- 空闲时重复调用停止：建议返回 code=1004。

## 9. 后端最小状态模型

```json
{
  "machineRunning": false,
  "paused": false,
  "selectedMode": "智能模式",
  "duration": 20,
  "remainingSeconds": 0,
  "temperature": 27.3,
  "humidity": 53.6,
  "doorOpen": false,
  "heaterOn": false,
  "disinfectionOn": false,
  "fanOn": false,
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65,
  "updatedAt": "2026-03-14T06:30:00.000Z"
}
```

## 10. 可直接给 AI 的后端提示词模板

```text
请为 STM32 智能消毒机实现后端（Node.js/Java/Python任选），严格按以下接口协议：
1) GET /api/v1/disinfector/runtime-status
2) GET /api/v1/disinfector/config
3) PUT /api/v1/disinfector/thresholds
4) POST /api/v1/disinfector/tasks/start
5) POST /api/v1/disinfector/tasks/pause
6) POST /api/v1/disinfector/tasks/stop

要求：
- 返回统一 JSON: { code, message, data }
- 支持三种模式：加热模式、消毒模式、智能模式
- 加热/消毒模式按 duration 倒计时，结束自动停止
- 智能模式启动加热和消毒灯，并根据温湿度阈值自动控制加热和风扇
- 支持任务暂停与继续（pause/resume）
- doorOpen=true 时禁止启动并返回业务错误码 1002
- 实现完整参数校验与错误码
- 提供可运行示例和接口测试样例（curl 或 Postman）
```

## 11. 前端联调开关

前端接口层支持 Mock/真实后端切换：

- VUE_APP_USE_MOCK_API=true（默认）：使用前端模拟接口
- VUE_APP_USE_MOCK_API=false：调用真实后端
- VUE_APP_API_BASE_URL=/api/v1（可自定义）

## 12. 全链路架构建议（Vue + Java + STM32 + ESP-01S）

你的目标是“实时状态显示 + 实时控制”，且不需要历史数据，这个场景可以只用 Redis，不用 MySQL。

推荐架构：

- Vue 前端：
  - HTTP：发起启动/停止/暂停/阈值设置。
  - WebSocket：接收实时状态推送（温湿度、门状态、执行器状态、当前模式）。
- Java 服务：
  - 对 Vue 提供 REST API（本规范 5.x）。
  - 对 STM32 提供设备通信通道（推荐 TCP 长连接，ESP-01S 透传）。
  - 将“最新状态”放 Redis，将“控制命令”放 Redis（可选 Stream/List）。
  - 将设备上报状态实时转发给 WebSocket 客户端。
- STM32 + ESP-01S（AT 固件）：
  - ESP-01S 负责联网和 TCP 透传。
  - STM32 负责传感器采集、执行器控制、协议打包/解析、命令 ACK。
- Redis：
  - 保存设备最新状态（Key-Value）。
  - 发布实时状态（Pub/Sub）或命令队列（Stream）。

结论：

- 只做实时控制与实时显示，用 Redis 足够。
- 暂时不需要 MySQL。
-

## 13. Java 与 STM32 通信方式（ESP-01S + AT 固件）

1. 采用TCP 长连接 + 自定义应用层协议

- ESP-01S AT 连接服务器 TCP 端口，进入透传。
- STM32 按协议上报状态、接收命令、返回 ACK。
- 优点：实现简单，时延低，可控性高。

## 14. STM32 需要上传的内容（最小必需）

建议每 1~2 秒上报一次状态（心跳+遥测）：

必传字段：

- deviceId：设备唯一 ID
- ts：设备时间戳（或单调计数）
- temperature：温度
- humidity：湿度
- doorOpen：柜门状态
- machineRunning：运行状态
- paused：暂停状态
- mode：当前模式（加热模式/消毒模式/智能模式）
- heaterOn：加热执行器状态
- disinfectionOn：消毒灯状态
- fanOn：风扇状态
- remainingSeconds：剩余时间（智能模式可为 0）
- faultCode：故障码（无故障传 0）

建议附加字段：

- fwVersion：固件版本
- wifiRssi：Wi-Fi 信号强度
- seq：递增序号（防乱序）

## 15. 通信格式建议（JSON 行协议，易调试）

为降低开发复杂度，建议使用“单行 JSON + \n”作为帧边界。

上行（STM32 -> Java）状态包示例：

```json
{"type":"status_report","deviceId":"cabinet-001","seq":1024,"ts":1710403200000,"temperature":31.2,"humidity":58.4,"doorOpen":false,"machineRunning":true,"paused":false,"mode":"智能模式","heaterOn":true,"disinfectionOn":true,"fanOn":false,"remainingSeconds":0,"faultCode":0}
```

下行（Java -> STM32）控制包示例：

```json
{"type":"control_cmd","cmdId":"c202603140001","deviceId":"cabinet-001","action":"start","mode":"智能模式","duration":20,"thresholds":{"tempLow":24,"tempHigh":34,"humidityLow":45,"humidityHigh":65}}
```

ACK（STM32 -> Java）示例：

```json
{"type":"ack","cmdId":"c202603140001","deviceId":"cabinet-001","ok":true,"code":0,"message":"ok","ts":1710403201000}
```

暂停/继续命令：

```json
{"type":"control_cmd","cmdId":"c202603140002","deviceId":"cabinet-001","action":"pause"}
{"type":"control_cmd","cmdId":"c202603140003","deviceId":"cabinet-001","action":"resume"}
```

停止命令：

```json
{"type":"control_cmd","cmdId":"c202603140004","deviceId":"cabinet-001","action":"stop"}
```

## 16. Java 服务内部建议（保证链路通畅）

核心模块：

- DeviceGateway（TCP）：管理设备连接、心跳超时、重连标记。
- CommandService：处理前端控制请求，生成 cmdId，下发设备。
- AckService：等待 ACK（建议超时 3~5 秒），更新命令结果。
- StatusService：处理设备上报，写 Redis 最新状态，并推送 WebSocket。

Redis Key 设计（建议）：

- `disinfector:state:{deviceId}`：Hash，保存最新状态。
- `disinfector:last_seen:{deviceId}`：String，最近在线时间戳。
- `disinfector:cmd:{cmdId}`：Hash，命令状态（pending/sent/ack/timeout）。
- `disinfector:ws:broadcast`：Pub/Sub 频道（可选）。

ACK 超时机制：

- 下发命令后状态先记 `pending`。
- 3~5 秒未收到 ACK，置为 `timeout`，接口返回失败或“已受理待设备响应”。
- 前端可继续通过 runtime-status 查询最终状态。

## 17. Vue 联调建议（你当前项目可直接对接）

- 启动/暂停/继续/停止/阈值保存：走 HTTP 接口（本规范 5.3~5.6）。
- 实时状态：
  - 可先保留轮询 `GET /runtime-status`（2~5 秒）。
  - 后续建议升级为 WebSocket 推送，页面更丝滑。
- UI 逻辑：
  - 收到后端状态即覆盖本地状态（以后端为准）。
  - 命令发送后先提示“已下发”，待 ACK 或状态变化再提示“执行成功”。

## 18. ESP-01S + AT 固件落地要点

- 固件建议：使用稳定版本 AT（确保 TCP 透传稳定）。
- 关键点：
  - 保持单连接长连，断线自动重连。
  - 透传模式下，STM32 做分包与粘包处理（按 \n 切帧）。
  - 心跳建议 5~10 秒（最简可复用状态上报）。
  - 设备 ID 固化在 STM32 Flash。

## 19. 是否可以不用 MySQL？

- Redis 就够用。
- 建议开启 AOF 持久化，避免服务重启后状态全丢。
-

## 20. 分阶段实施清单（建议按顺序）

1. 先打通 TCP 长连接：ESP-01S 上线、Java 收到 status_report。
2. 实现命令下发 + ACK：start/stop/pause/resume 全通。
3. Java 写 Redis 最新状态，前端 runtime-status 能看到设备实时变化。
4. Vue 接口切到真实后端（`VUE_APP_USE_MOCK_API=false`）。
5. 最后再做 WebSocket 推送优化（可选）。
## 21. 当前实现补充（2026-03）

### 21.1 设备维度

- 现有 REST 接口都支持可选查询参数 `deviceId`
- 当前前端默认传 `deviceId=STM-001`
- 未传时后端默认回退到 `STM-001`

示例：

```http
GET /api/v1/disinfector/runtime-status?deviceId=STM-001
GET /api/v1/disinfector/config?deviceId=STM-001
POST /api/v1/disinfector/tasks/stop?deviceId=STM-001
```

### 21.2 WiFi 配置接口

- Method: `PUT`
- Path: `/api/v1/disinfector/wifi-config`
- Query: `deviceId=STM-001`

请求体：

```json
{
  "ssid": "LabWiFi",
  "password": "12345678"
}
```

响应 data：

```json
{
  "deviceId": "STM-001",
  "ssid": "LabWiFi",
  "appliedAfterRestart": true
}
```

行为约定：

- 后端只负责将 WiFi 配置下发给设备并等待 ACK
- 设备收到后写入 Flash
- 当前会话不立即切换到新 WiFi
- 设备重启后才使用新 WiFi 配置联网

### 21.3 SSE 补充

- SSE 订阅路径为 `/api/v1/disinfector/stream?deviceId=STM-001`
- 首帧快照按请求中的 `deviceId` 返回对应设备状态
- 浏览器主动关闭连接时，后端应忽略常见断开异常，避免误记系统错误日志
