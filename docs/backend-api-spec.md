# STM32 Smart Disinfector Backend API Spec (v1)

## 1. Goals
- Frontend first: UI can run immediately with mock mode.
- Backend alignment: backend should implement the exact endpoint contracts below.
- Modes:
  - 加热模式: manual fixed duration, heater on only.
  - 消毒模式: manual fixed duration, disinfection lamp on only.
  - 智能模式: heater + lamp start together, and controller auto-adjusts heater/fan based on temperature/humidity thresholds.

## 2. Base Info
- Base URL: `/api/v1`
- Content-Type: `application/json`
- Charset: `utf-8`
- Time format: ISO-8601 (`2026-03-14T06:30:00.000Z`)

## 3. Unified Response Format
All APIs return this format:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

- `code = 0`: success
- `code != 0`: business failure

Recommended error codes:
- `1001`: invalid params
- `1002`: door open, cannot start
- `1003`: machine already running
- `1004`: machine already idle
- `1005`: threshold range invalid
- `1006`: pause/resume state invalid
- `2001`: controller offline
- `2002`: serial/mqtt send failed

## 4. Enums
### 4.1 Mode
- `加热模式`
- `消毒模式`
- `智能模式`

### 4.2 Machine State
- `machineRunning`: `true | false`
- `paused`: `true | false`
- `doorOpen`: `true | false`
- Actuator state:
  - `heaterOn`
  - `disinfectionOn`
  - `fanOn`

## 5. API List

## 5.1 Get Runtime Status
### Request
- Method: `GET`
- Path: `/disinfector/runtime-status`

### Response `data`
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

## 5.2 Get Config (Thresholds)
### Request
- Method: `GET`
- Path: `/disinfector/config`

### Response `data`
```json
{
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65
}
```

## 5.3 Update Thresholds
### Request
- Method: `PUT`
- Path: `/disinfector/thresholds`

### Request body
```json
{
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65
}
```

### Validation rules
- `tempLow < tempHigh`
- `humidityLow < humidityHigh`
- Suggested range:
  - temp: `10~60`
  - humidity: `20~95`

### Response `data`
```json
{
  "tempLow": 24,
  "tempHigh": 34,
  "humidityLow": 45,
  "humidityHigh": 65
}
```

## 5.4 Start Task
### Request
- Method: `POST`
- Path: `/disinfector/tasks/start`

### Request body
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

### Notes
- For `加热模式` and `消毒模式`, `duration` must be `>= 5`.
- For `智能模式`, backend can ignore `duration` and run until stop.
- If `doorOpen = true`, return `code=1002`.

### Response `data`
Return the same structure as runtime-status for immediate UI refresh.

## 5.5 Pause / Resume Task
### Request
- Method: `POST`
- Path: `/disinfector/tasks/pause`

### Request body
```json
{
  "action": "pause"
}
```

`action` allowed values:
- `pause`
- `resume`

### Behavior rules
- `pause`: keep task context, stop actuators temporarily.
- `resume`: continue task context.
- For manual modes, countdown continues from `remainingSeconds`.
- If machine idle and trying to pause/resume, return `code=1004` or `code=1006`.

### Response `data`
Return the same structure as runtime-status.

## 5.6 Stop Task
### Request
- Method: `POST`
- Path: `/disinfector/tasks/stop`

### Request body
```json
{}
```

### Response `data`
Return the same structure as runtime-status.

## 6. Smart Mode Control Rules (Backend)
When mode is `智能模式`:
- Startup:
  - `heaterOn = true`
  - `disinfectionOn = true`
- Loop control (e.g. every 1~2s):
  - if `temperature > tempHigh`: `heaterOn = false`
  - if `temperature < tempLow`: `heaterOn = true`
  - if `humidity > humidityHigh` OR `temperature > tempHigh`: `fanOn = true`
  - if `humidity <= humidityHigh` AND `temperature <= tempHigh`: `fanOn = false`

## 7. Polling and Real-time
Current frontend behavior:
- Poll `GET /disinfector/runtime-status` every 2~5 seconds.

Optional upgrades:
- SSE: `/disinfector/events`
- WebSocket: `/ws/disinfector`

## 8. Idempotency and Concurrency
- `POST /tasks/start` while already running:
  - Recommended: return `code=1003`.
- `POST /tasks/stop` while idle:
  - Recommended: return `code=1004`.

## 9. Minimal Backend Data Model
Suggested runtime state object:

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

## 10. AI Prompt Template for Backend Coding
Use this prompt directly when asking AI to build backend:

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

## 11. Frontend Integration Toggle
Frontend API layer supports mock switch:
- `VUE_APP_USE_MOCK_API=true` (default): use frontend mock responses
- `VUE_APP_USE_MOCK_API=false`: call real backend APIs
- `VUE_APP_API_BASE_URL=/api/v1` (customizable)
